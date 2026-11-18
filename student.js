// 单词学习系统 · 学生端：本周学习、测验、错词本、拼图地图
const Stu = (() => {
  let D = null, tab = 'study';
  let queue = [], flipped = false, again = new Set(), mode = 'new';   // mode: new 学没学过的 / all 再过一遍
  let T = null, ans = [], qi = 0;                                      // 进行中的测验

  const cards = () => D.cards || [];
  const unlearned = () => cards().filter(c => c.st === 'assigned');
  const lsKey = id => 'vocab_ans_' + id;
  const save = () => { try { if (T) localStorage.setItem(lsKey(T.id), JSON.stringify(ans)); } catch (e) {} };
  const restore = id => { try { return JSON.parse(localStorage.getItem(lsKey(id)) || 'null'); } catch (e) { return null; } };
  const forget = id => { try { localStorage.removeItem(lsKey(id)); } catch (e) {} };

  function start(d) { D = d; resetQueue(); render(); }
  async function reload() { try { D = await rpc('stu_load'); } catch (e) { fail(e); } resetQueue(); render(); }
  function resetQueue() { queue = (mode === 'all' ? cards() : unlearned()).map(c => c.id); flipped = false; again = new Set(); }
  // 换到地图/错词本时重新拿数据，但不打乱正在学的这一轮
  async function keepQueue(fn) {
    const q = queue.slice(), f = flipped, a = new Set(again);
    try { D = await rpc('stu_load'); } catch (e) { fail(e); }
    const ids = new Set(cards().map(c => c.id));
    queue = q.filter(id => ids.has(id)); flipped = f && queue.length > 0; again = a;
    render();
  }

  function header() {
    const w = D.week, L = w.kind === 'L', tot = cards().length, done = tot - unlearned().length;
    const daily = Math.ceil(tot / Math.max(1, D.cfg.days));
    const tabs = [['study', '学习'], ['test', '测验'], ['err', '错词本'], ['map', '地图']];
    return '<header class="top"><div class="wrap">' +
      '<div class="row"><div class="brand"><b>' + esc(D.me.name) + '</b><span>第 ' + w.no + ' 周 · ' + (L ? '学新词' : '回顾周') + ' · ' + md(w.start) + '～' + md(w.end) + (w.extended ? '（已延长）' : '') + '</span></div></div>' +
      '<div class="seg" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (tab === k) + '">' + n + (k === 'err' && D.errbook.length ? ' ' + D.errbook.length : '') + '</button>').join('') + '</div>' +
      (L && tab === 'study' ? '<div class="prog"><span>本周学过 ' + done + ' / ' + tot + ' · 每天约 ' + daily + ' 个</span><div class="track"><div class="fill" style="width:' + (tot ? done / tot * 100 : 0) + '%"></div></div></div>' : '') +
      '</div></header>';
  }

  function render() {
    stopAudio();
    let body = '';
    if (tab === 'study') body = studyHTML();
    else if (tab === 'test') body = testHTML();
    else if (tab === 'err') body = errHTML();
    else body = mapHTML();
    $('app').innerHTML = header() + '<main class="wrap">' + body + '</main>';
    if (tab === 'study' && flipped && queue.length) play(aud(queue[0]));
  }

  // ── 学习 ──
  function studyHTML() {
    const w = D.week;
    if (w.today < w.start) return '<div class="box"><h2>还没开始</h2><div class="muted">第 1 周从 ' + md(w.start) + ' 开始，到时候再来。</div></div>';
    if (w.kind === 'R') return '<div class="box"><h2>这周是回顾周</h2><div class="muted">这周不学新词。把前几周的词再过一遍，然后去「测验」做回顾测（从学过的词里抽题，及格线 ' + D.cfg.revPass + '%）。</div><div><button class="btn main" data-tab="test">去回顾测</button></div></div>' +
      (D.errbook.length ? '<div class="box"><h2>先看看错过的词</h2><div class="muted">一共 ' + D.errbook.length + ' 个，在「错词本」里。</div><div><button class="gbtn" data-tab="err">打开错词本</button></div></div>' : '');
    if (!cards().length) return '<div class="box"><h2>这周没有新词</h2><div class="muted">可能是这个范围的词已经全部学完了，或者老师给你暂停了一周。</div></div>';
    if (!queue.length) {
      const tested = (D.tests || []).some(x => x.done && (x.parts || []).includes('week'));
      const canMore = D.cfg.addOn && !(D.tests || []).some(x => x.started && (x.parts || []).includes('week'));
      return '<div class="card"><h2>' + (mode === 'all' ? '这一遍过完了' : '本周的 ' + cards().length + ' 个词都学过了') + '</h2>' +
        '<div class="muted">' + (tested ? '周测已经考完了。' : '学完记得去做周测：本周的词全部都考，及格线 ' + D.cfg.pass + '%。') + '</div>' +
        '<div class="form">' +
        (!tested ? '<button class="btn main" data-tab="test">去周测</button>' : '') +
        '<button class="btn" data-act="all">从头再过一遍</button>' +
        (canMore ? '<button class="btn" data-act="more">再来一组（' + D.cfg.addN + ' 个，算进本周、一起考）</button>' : '') +
        '</div></div>';
    }
    const c = cards().find(x => x.id === queue[0]);
    if (!flipped) {
      return '<div class="card front" id="front" tabindex="0" role="button" aria-label="翻面看答案"><div class="chips"><span class="chip">' + esc(c.lvl) + '</span>' +
        (again.has(c.id) ? '<span class="chip bad">再来一次</span>' : '') + (D.cards.find(x => x.id === c.id && x.wrong > 0) ? '<span class="chip warn">错过的词</span>' : '') + '</div>' +
        '<div class="big" lang="ja">' + esc(c.w) + '</div><div class="hint">先想一想意思，再点一下翻面</div></div>' +
        '<div class="bar one"><button class="btn main" data-act="flip">翻面看答案 <span class="k">空格</span></button></div>' +
        '<div class="muted" style="text-align:center">这一轮还剩 ' + queue.length + ' 个</div>';
    }
    return '<div class="card">' + cardBack(c) + '</div>' +
      '<div class="bar"><button class="btn no" data-rate="no">不会 <span class="k">1</span></button><button class="btn" data-rate="mid">模糊 <span class="k">2</span></button><button class="btn ok" data-rate="ok">会了 <span class="k">3</span></button></div>';
  }
  function flip() { if (!queue.length || flipped) return; flipped = true; render(); }
  function rate(a) {
    if (!flipped || !queue.length) return;
    stopAudio();
    const id = queue.shift(), c = cards().find(x => x.id === id);
    if (c && c.st === 'assigned') { c.st = 'learned'; rpc('stu_rate', { wid: id }).catch(fail); }
    if (a !== 'ok') { again.add(id); queue.splice(Math.min(a === 'no' ? 2 : 5, queue.length), 0, id); if (queue.length === 1) toast('只剩这一个词了，再来一次'); }
    flipped = false; render(); window.scrollTo({ top: 0 });
  }
  async function more(btn) {
    busy(btn, true);
    try { const r = await rpc('stu_more'); toast('加了 ' + r.added + ' 个新词'); mode = 'new'; await reload(); }
    catch (e) { fail(e); busy(btn, false); }
  }

  // ── 测验 ──
  const KN = { week: '周测', review: '回顾测', quarter: '季度测', year: '年测' };
  const tName = x => (x.parts && x.parts.length > 1) ? x.parts.map(p => KN[p]).join('＋') + '（合成一场）' : (KN[x.kind] || '测验');
  function tDesc(x) {
    const w = D.week, un = unlearned().length, c = D.cfg, out = [];
    for (const p of (x.parts || [x.kind])) {
      if (p === 'week') out.push('本周词单里的 ' + cards().length + ' 个词全部都考' + (un ? '（还有 ' + un + ' 个没学过' + (c.untaught === 'next' ? '，这次不考，挪到下周）' : '，也会考到，最好先学完）') : ''));
      if (p === 'review') out.push('从前几周学过的词里抽 ' + c.revN + ' 个左右（以前错过的一定会抽到）');
      if (p === 'quarter') out.push('从最近这段时间学过的词里抽 ' + c.qN + ' 个左右');
      if (p === 'year') out.push('从这一年学过的词里抽 ' + c.yN + ' 个左右');
    }
    return out.join('；') + '。每个词一题，选择题，及格线 ' + x.pass + '%。';
  }
  function testHTML() {
    const w = D.week, list = D.tests || [];
    if (w.today < w.start) return '<div class="box"><h2>还没开始</h2></div>';
    if (T) return quizHTML();
    let h = list.length > 1 ? '<div class="muted">这周有 ' + list.length + ' 场测验，按顺序一场一场考。</div>' : '';
    list.forEach((x, i) => {
      if (x.done) {
        h += '<div class="card"><h2>' + tName(x) + ' 考完了</h2><div class="stats">' +
          '<div class="stat"><b>' + x.score + ' / ' + x.total + '</b><span>答对</span></div>' +
          '<div class="stat"><b>' + Math.floor(x.score * 100 / x.total) + '%</b><span>正确率</span></div>' +
          '<div class="stat"><b>' + (x.passed ? '及格' : x.manual ? '老师放行' : '没及格') + '</b><span>结果</span></div></div>' +
          ((x.parts || []).includes('week') && !(x.passed || x.manual) ? '<div class="muted">错的词会按老师的设置带到下一周再学。</div>' : '') + '</div>';
      } else {
        const before = list.slice(0, i).some(y => !y.done);
        h += '<div class="card"><h2>' + tName(x) + '</h2><div class="muted">' + tDesc(x) + '<br>开始以后可以中途退出，答过的题会记在这台手机上；交卷后就不能再改了。</div>' +
          '<div><button class="btn main" data-act="tstart" data-kd="' + esc(x.kind) + '"' + (before ? ' disabled' : '') + '>' + (x.started ? '接着考' : '开始') + '</button>' + (before ? ' <span class="muted">先考完上面那场</span>' : '') + '</div></div>';
      }
    });
    if (list.length && list.every(x => x.done)) h += '<div class="muted">' + md(new Date(new Date(w.end + 'T00:00:00').getTime() + 86400000)) + '自动进入下一周。' + (D.errbook.length ? ' <button class="link" data-tab="err">看错词本</button>' : '') + '</div>';
    if (D.history.length) {
      h += '<div class="box"><h2>以前的成绩</h2><div class="scroll"><table class="t"><tr><th>周</th><th>类型</th><th>成绩</th><th>结果</th></tr>' +
        D.history.map(x => '<tr><td>第 ' + x.no + ' 周</td><td>' + (KN[x.kind] || x.kind) + '</td><td>' + (x.total ? x.score + ' / ' + x.total : '没考') + '</td><td>' +
          (x.total ? (x.passed ? '<span class="chip ok">及格</span>' : x.manual ? '<span class="chip">放行</span>' : '<span class="chip bad">没及格</span>') : '—') + '</td></tr>').join('') + '</table></div></div>';
    }
    return h;
  }
  async function tstart(btn) {
    busy(btn, true);
    try {
      T = await rpc('stu_test_start', { kd: btn.dataset.kd || null });
      const x = (D.tests || []).find(y => y.kind === T.kind); if (x) { x.started = true; x.id = T.id; }
      ans = restore(T.id) || new Array(T.items.length).fill(null);
      qi = Math.max(0, ans.findIndex(a => a === null)); if (qi < 0) qi = 0;
      render();
    } catch (e) { fail(e); busy(btn, false); }
  }
  function quizHTML() {
    const it = T.items[qi], n = T.items.length, answered = ans.filter(a => a !== null).length;
    const zhq = it.t === 'cj', jpOpt = it.t !== 'jc';
    const ask = { jc: '这个词是什么意思？', cj: '哪个日语词是这个意思？', kr: '这个词怎么读？' }[it.t];
    return '<div class="prog"><span>第 ' + (qi + 1) + ' / ' + n + ' 题 · 已答 ' + answered + '</span><div class="track"><div class="fill" style="width:' + answered / n * 100 + '%"></div></div></div>' +
      '<div class="card"><div class="muted">' + ask + '</div><div class="q' + (zhq ? ' zhq' : '') + '" lang="' + (zhq ? 'zh' : 'ja') + '">' + esc(it.q) + '</div>' +
      '<div class="opts">' + it.o.map((o, j) => '<button type="button" class="opt' + (jpOpt ? ' jpo' : '') + (ans[qi] === j ? ' sel' : '') + '" data-opt="' + j + '"' + (jpOpt ? ' lang="ja"' : '') + '>' + esc(o) + '</button>').join('') + '</div></div>' +
      '<div class="bar two"><button class="btn" data-act="prev"' + (qi === 0 ? ' disabled' : '') + '>上一题</button>' +
      (qi < n - 1 ? '<button class="btn" data-act="next">下一题</button>' : '<button class="btn main" data-act="submit">交卷</button>') + '</div>' +
      '<div style="text-align:center"><button class="link" data-act="quit">先退出，等会儿再考</button>' + (answered === n && qi < n - 1 ? ' · <button class="link" data-act="submit">全部答完了，交卷</button>' : '') + '</div>';
  }
  function pick(j) {
    ans[qi] = j; save();
    if (qi < T.items.length - 1) { render(); setTimeout(() => { qi++; render(); }, 220); } else render();
  }
  async function submit(btn) {
    const left = ans.filter(a => a === null).length;
    if (left && !submit.sure) { submit.sure = true; toast('还有 ' + left + ' 题没答，没答的算错。确定交卷就再点一次'); setTimeout(() => submit.sure = false, 4000); return; }
    submit.sure = false; busy(btn, true);
    try {
      const r = await rpc('stu_test_submit', { tid: T.id, ans: ans.map(a => a === null ? -1 : a) });
      forget(T.id); T = null;
      await reload();
      resultModal(r);
    } catch (e) { fail(e); busy(btn, false); }
  }
  function resultModal(r) {
    const pct = Math.floor(r.score * 100 / r.total);
    modal('<h2>' + (r.passed ? '及格了！' : '这次没及格') + '</h2><div class="stats"><div class="stat"><b>' + r.score + ' / ' + r.total + '</b><span>答对</span></div><div class="stat"><b>' + pct + '%</b><span>正确率</span></div><div class="stat"><b>' + r.pass + '%</b><span>及格线</span></div></div>' +
      (r.wrong.length ? '<div class="lab">答错的 ' + r.wrong.length + ' 个（已放进错词本）</div><div class="list">' + r.wrong.map(c => '<div class="it"><span><span class="nm" lang="ja">' + esc(c.w) + '</span> <span class="muted" lang="ja">' + esc(c.r) + '</span></span><span class="sub">' + esc(c.m) + '</span></div>').join('') + '</div>' : '<div class="muted">全部答对了。</div>') +
      '<button class="btn main" data-close>好的</button>');
  }

  // ── 错词本 ──
  function errHTML() {
    if (!D.errbook.length) return '<div class="box"><h2>错词本是空的</h2><div class="muted">测验答错的词会放到这里。</div></div>';
    return '<div class="muted">一共 ' + D.errbook.length + ' 个，最近错的在前面。</div>' +
      D.errbook.map(c => '<div class="card">' + cardBack(c, { chip: '<span class="chip warn">错过 ' + c.wrong + ' 次</span>' + (c.st === 'correct' ? ' <span class="chip ok">后来答对了</span>' : '') }) + '</div>').join('');
  }

  // ── 拼图地图 ──
  function mapHTML() {
    const c = D.cfg, si = LV.indexOf(c.start);
    const skipped = l => c.mode === 'only' ? !(c.only || []).includes(l) : c.mode === 'step' ? LV.indexOf(l) < si : false;
    let h = '<div class="muted">学过的词先半亮，测验答对了全亮。</div>';
    for (const l of LV) {
      const m = D.map[l];
      if (!m) { h += '<div class="box"><h2>' + l + ' <small>还没有放进词库</small></h2></div>'; continue; }
      const half = new Set(m.half), full = new Set(m.full), sk = skipped(l);
      let cells = ''; for (let i = 1; i <= m.total; i++) cells += '<i' + (full.has(i) ? ' class="f"' : half.has(i) ? ' class="h"' : '') + '></i>';
      h += '<div class="box"><h2>' + l + ' <small>' + (sk ? '已掌握（不用学）' : '全亮 ' + full.size + ' · 半亮 ' + half.size + ' · 共 ' + m.total) + '</small></h2><div class="map' + (sk ? ' done' : '') + '" aria-label="' + l + ' 共 ' + m.total + ' 个词，全亮 ' + full.size + ' 个">' + cells + '</div></div>';
    }
    return h;
  }

  document.addEventListener('click', e => {
    if (!D || $('app').dataset.role === 'adm') return;
    const t = e.target;
    const tb = t.closest('[data-tab]'); if (tb) {
      if (T && tb.dataset.tab !== 'test') { T = null; }
      tab = tb.dataset.tab; window.scrollTo({ top: 0 });
      if (tab === 'map' || tab === 'err') { keepQueue(reload); } else render();
      return;
    }
    if (t.closest('#front')) { flip(); return; }
    const r = t.closest('[data-rate]'); if (r) { rate(r.dataset.rate); return; }
    const o = t.closest('[data-opt]'); if (o && T) { pick(+o.dataset.opt); return; }
    const a = t.closest('[data-act]'); if (!a || a.disabled) return;
    const act = a.dataset.act;
    if (act === 'flip') flip();
    else if (act === 'all') { mode = 'all'; resetQueue(); render(); }
    else if (act === 'more') more(a);
    else if (act === 'tstart') tstart(a);
    else if (act === 'prev') { qi = Math.max(0, qi - 1); render(); }
    else if (act === 'next') { qi = Math.min(T.items.length - 1, qi + 1); render(); }
    else if (act === 'quit') { T = null; render(); toast('答过的题记在这台手机上了，回来点「接着考」'); }
    else if (act === 'submit') submit(a);
  });
  document.addEventListener('keydown', e => {
    if (!D || $('app').dataset.role === 'adm' || document.querySelector('.modal')) return;
    if (tab === 'study' && !flipped && (e.key === ' ' || e.key === 'Enter') && queue.length && !e.target.closest('button')) { e.preventDefault(); flip(); }
    else if (tab === 'study' && flipped && ['1', '2', '3'].includes(e.key)) rate({ 1: 'no', 2: 'mid', 3: 'ok' }[e.key]);
    else if (T && ['1', '2', '3', '4'].includes(e.key) && T.items[qi].o[+e.key - 1] !== undefined) pick(+e.key - 1);
  });
  return { start };
})();
