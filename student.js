// 单词学习系统 · 学生端：本周学习、测验、错词本、拼图地图
const Stu = (() => {
  let D = null, tab = 'study';
  let queue = [], flipped = false, again = new Set(), mode = 'new';   // mode: new 本周还没练的＋今天要再练的 / all 再过一遍 / rev 今天的复习
  let revDone = new Set();
  let listView = false, pin = null;                                    // 「看本周全部词」列表；pin = 从列表里点的那张卡（排在最前面）
  let saving = false, starting = false, submitting = false, syncing = false, stored = true, canStore = true, stale = null, lastSync = Date.now();
  let T = null, ans = [], qi = 0;                                      // 进行中的测验
  // 当场判对错：res 服务器给的结果；srv 服务器上已经记下的题；pend 没收到确认的题 → 当时选的选项（网络断了、回复丢了，不知道记没记下）；
  // answering / fetching：正在等回复的那一次请求（带请求编号，旧请求回来时先核对，免得打乱后来的请求）
  let instant = false, res = [], srv = new Set(), pend = new Map(), answering = null, fetching = null, fetchBad = new Set(), reqNo = 0, checking = false, syncBad = false;
  const WAIT = 15000;                                                  // 判一题最多等 15 秒；等不到当作回复丢了（不知道记没记下）
  const memAns = new Map();                                            // 答案在这个页面里也留一份（浏览器存不了时还能接着考）
  const memRes = new Map();                                            // 当场判过的结果在这个页面里留一份（回看、接着考时不用再取）
  // 错词本页签上的数：服务器给的错词本＋这次打开后服务器确认「已经记进错词本」（判题回复 inbook）的词 → 确认的时间。
  // 重新读取回来时用服务器的列表校准：列表里已经有的、或者在读取发出之前就确认的（服务器说不在本里）都去掉，只留读取发出后才确认的
  const errNew = new Map();
  let ebRef = null, ebIds = new Set();
  const errN = () => {
    if (D.errbook !== ebRef) { ebRef = D.errbook; ebIds = new Set((D.errbook || []).map(c => c.id)); }
    let n = ebIds.size; for (const id of errNew.keys()) if (!ebIds.has(id)) n++; return n;
  };
  const unsaved = new Map();                                           // 答案没能存进浏览器的试卷 → 属于哪一周（关页面前要提醒）
  let loadSeq = 0, loadOk = 0;                                         // 读取的请求编号：先发后到的旧回复不用

  const cards = () => D.cards || [];
  const pool = () => mode === 'rev' ? (D.review || []) : cards();
  const revLeft = () => (D.review || []).filter(c => !revDone.has(c.id));
  const todo = () => cards().filter(c => !c.done).concat(cards().filter(c => c.done && c.again));
  const doneN = () => cards().filter(c => c.done).length;
  const unlearned = () => cards().filter(c => c.st === 'assigned');
  const lsKey = id => 'vocab_ans_' + id;
  try { localStorage.setItem('vocab_probe', '1'); localStorage.removeItem('vocab_probe'); } catch (e) { canStore = false; }
  const save = () => {
    if (!T) return;
    memAns.set(T.id, ans.slice());
    try { localStorage.setItem(lsKey(T.id), JSON.stringify(ans)); stored = true; unsaved.delete(T.id); }
    catch (e) { stored = false; if (!instant) unsaved.set(T.id, T.week || D.week.id); }   // 当场判对错时答案记在服务器上，存不进浏览器也不会丢
  };
  // 恢复答到一半的答案：数量、选项都要对得上，不对的当没答
  const check = (a, items) => Array.isArray(a) && a.length === items.length ? a.map((x, i) => Number.isInteger(x) && x >= 0 && x < items[i].o.length ? x : null) : null;
  const restore = (id, items) => {
    const m = check(memAns.get(id), items); if (m) return m;
    try { return check(JSON.parse(localStorage.getItem(lsKey(id)) || 'null'), items); } catch (e) { return null; }
  };
  const forget = id => { memAns.delete(id); memRes.delete(id); unsaved.delete(id); try { localStorage.removeItem(lsKey(id)); } catch (e) {} };

  // 换上新数据：日期变了就清掉「今天复习过的」；换周了就清掉已经过期的那些卷子的答案和关页提醒
  function apply(d) {
    if (D && D.week && d.week && d.week.today !== D.week.today) { revDone = new Set(); if (mode === 'rev') mode = 'new'; }
    if (D && D.week && d.week && d.week.id !== D.week.id) for (const [tid, wid] of [...unsaved]) if (wid !== d.week.id) { unsaved.delete(tid); memAns.delete(tid); }
    D = d; stale = null; lastSync = Date.now();
  }
  function start(d) { apply(d); resetQueue(); render(); }
  // 读取一次：比后面发出的请求还晚回来的、比页面上已经显示的日期或周还旧的，都不用（返回 null）
  const behind = d => !!(D && D.week && d.week && (d.week.today < D.week.today || (d.week.today === D.week.today && d.week.no < D.week.no)));
  async function load() {
    const my = ++loadSeq, sent = Date.now();
    const d = await rpc('stu_load', { cv: CV }, { obj: true });
    if (my < loadOk || behind(d)) return null;
    loadOk = my;
    const ids = new Set((d.errbook || []).map(c => c.id));
    for (const [id, at] of errNew) if (ids.has(id) || at < sent) errNew.delete(id);
    return d;
  }
  // 重新读取；失败时保留现在的词单，页面上给一个「重新读取」
  async function reload(failMsg) {
    try { const d = await load(); if (d) { apply(d); resetQueue(); render(); } return true; }
    catch (e) { stale = (failMsg || '重新读取没成功') + '（' + e.message + '）'; render(); return false; }
  }
  function resetQueue() { queue = (mode === 'rev' ? revLeft() : mode === 'all' ? cards() : todo()).map(c => c.id); flipped = false; again = new Set(); }
  // 换到进度/错词本时，只更新这两页用到的数据；正在学的这一轮不动
  async function refreshSide(want) {
    let d; try { d = await load(); } catch (e) { fail(e); return; }
    if (!d) return;
    newer(d);   // 和其它读取走同一套：换周、换日、同一天各自处理（词单变了也会更新，不会被这次局部刷新挡掉）
  }
  // 拿到更新的数据：换周、换日、同一天（别的设备学过）分别处理
  function newer(d) {
    const weekChanged = d.week.id !== D.week.id || d.week.no !== D.week.no || d.week.waiting !== D.week.waiting;
    const dayChanged = d.week.today !== D.week.today;
    if (weekChanged) {
      if (T && T.week !== d.week.id) { T = null; toast('上一周的测验已经结束（没交的没有记成绩），现在是第 ' + d.week.no + ' 周'); }
      else if (!d.week.waiting) toast('已经到第 ' + d.week.no + ' 周了');
      mode = 'new'; revDone = new Set(); apply(d); resetQueue(); render(); return;
    }
    if (dayChanged) {
      apply(d); if (!T) { resetQueue(); render(); }
      toast('新的一天，今天的复习和任务已经更新'); return;
    }
    // 同一天：别的设备可能学过。词单没变就只更新每张卡的状态，正在学的这一轮顺序不打乱
    const ids = x => (x.cards || []).map(c => c.id).join();
    if (ids(d) !== ids(D) || mode === 'rev') {
      if (T || (tab === 'study' && flipped)) { ['map', 'errbook', 'stats', 'class', 'history', 'tests', 'myplan', 'plans', 'req'].forEach(k => D[k] = d[k]); lastSync = Date.now(); return; }
      apply(d); resetQueue(); render(); return;
    }
    const by = Object.fromEntries(d.cards.map(c => [c.id, c]));
    cards().forEach(c => { const n = by[c.id]; if (n) Object.assign(c, { st: n.st, done: n.done, again: n.again, wrong: n.wrong }); });
    ['map', 'errbook', 'stats', 'class', 'history', 'tests', 'review', 'week', 'myplan', 'plans', 'req'].forEach(k => D[k] = d[k]);
    lastSync = Date.now();
    // 从列表里点过来、排在最前面的那张卡（可能已经练过）留在最前面
    if (mode === 'new' && !flipped) { const need = todo().map(c => c.id), set = new Set(need), keep = pin && queue[0] === pin ? pin : null; queue = queue.filter(id => set.has(id) || id === keep).concat(need.filter(id => !queue.includes(id))); }
    if (!T && !(tab === 'study' && flipped)) render();
  }
  // 从后台回到这个页面（微信里隔天打开等）：日期变了、或者隔了 5 分钟以上，就和服务器核对一次
  async function checkFresh() {
    if (!D || syncing || submitting || saving || starting || document.querySelector('.modal')) return;
    if (tokyoToday() === D.week.today && Date.now() - lastSync < 5 * 60 * 1000) return;
    syncing = true;
    let d; try { d = await load(); } catch (e) { syncing = false; return; }
    syncing = false; if (d) newer(d);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('app').dataset.role !== 'adm') checkFresh(); });
  window.addEventListener('pageshow', e => { if (e.persisted && $('app').dataset.role !== 'adm') checkFresh(); });
  window.addEventListener('focus', () => { if ($('app').dataset.role !== 'adm') checkFresh(); });

  function header() {
    const w = D.week, L = w.kind === 'L', tot = cards().length, done = doneN(), en = errN();
    const tabs = [['study', '学习'], ['test', '测验'], ['err', '错词本'], ['map', '进度']];
    return '<header class="top"><div class="wrap">' +
      '<div class="row"><div class="brand"><b>' + esc(D.me.name) + '</b><span>第 ' + w.no + ' 周 · ' + (L ? '学新词' : '回顾周') + ' · ' + md(w.start) + '～' + md(w.end) + (w.extended ? '（已延长）' : '') + '</span></div>' + (D.stats ? '<span class="chip' + (D.stats.streak ? ' ok' : '') + '">连续 ' + D.stats.streak + ' 天</span>' : '') + '</div>' +
      '<div class="seg" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (tab === k) + '">' + n + (k === 'err' && en ? ' ' + en : '') + '</button>').join('') + '</div>' +
      (L && tot && tab === 'study' && mode !== 'rev' && !w.waiting ? '<div class="prog"><span>本周练过 ' + done + ' / ' + tot + '</span><div class="track"><div class="fill" style="width:' + (done / tot * 100) + '%"></div></div></div>' : '') +
      '</div></header>';
  }

  function render() {
    stopAudio();
    let body = '';
    if (tab === 'study') body = studyHTML();
    else if (tab === 'test') body = testHTML();
    else if (tab === 'err') body = errHTML();
    else body = mapHTML();
    $('app').innerHTML = header() + '<main class="wrap">' + (stale ? '<div class="warnbox">' + esc(stale) + ' <button class="gbtn" data-act="reload">重新读取</button></div>' : '') + body + '</main>';
    if (tab === 'test' && T && instant) needRes();
  }

  // ── 学习 ──
  // 三个数字各指什么：本周词单（新词＋上周错词＋追加）、每个学习日大约学几个、今天先复习几个
  function weekLine() {
    const w = D.week, n = cards().length, nc = cards().filter(c => c.src === 'carry').length, ne = cards().filter(c => c.src === 'extra').length;
    const parts = [nc ? '上周错词 ' + nc : '', '新词 ' + (n - nc - ne), ne ? '追加 ' + ne : ''].filter(Boolean).join('、');
    return '<div class="wkline"><span class="muted">本周词单 ' + n + ' 个（' + parts + '）· 每个学习日约 ' + Math.ceil(n / Math.max(1, num(D.cfg.days, 5))) + ' 个</span>' + listBtn() + '</div>';
  }
  const listBtn = () => '<button type="button" class="gbtn" data-act="list">看本周全部词</button>';
  // 本周全部词：只显示写法和状态（不显示读音、意思，免得变成看答案）；点一个词就从这张卡开始练
  function listHTML() {
    const cs = cards(), nNot = cs.filter(c => !c.done).length, nAgain = cs.filter(c => c.done && c.again).length;
    const cell = c => {
      const s = !c.done ? ['', '还没练'] : c.again ? ['bad', '今天要再练'] : ['ok', '练过'];
      const from = c.src === 'carry' ? '<span class="chip warn">上周错词</span>' : c.src === 'extra' ? '<span class="chip">追加</span>' : '';
      return '<button type="button" class="wc' + (s[0] ? ' ' + s[0] : '') + '" data-wid="' + esc(c.id) + '" aria-label="' + esc(c.w) + '，' + s[1] + '，点一下从这个词开始练"><b lang="ja">' + esc(c.w) + '</b><span class="tags"><span class="chip' + (s[0] ? ' ' + s[0] : '') + '">' + s[1] + '</span>' + from + '</span></button>';
    };
    return '<div class="box"><div class="row"><h2 class="lh">本周全部词 <small>' + cs.length + ' 个</small></h2><button type="button" class="gbtn" data-act="unlist">返回学习</button></div>' +
      '<div class="muted">还没练 ' + nNot + ' · 练过 ' + (cs.length - nNot - nAgain) + ' · 今天要再练 ' + nAgain + '。点一个词，就从这个词开始练。</div>' +
      '<div class="wl">' + cs.map(cell).join('') + '</div></div>' +
      '<div class="bar one"><button type="button" class="btn" data-act="unlist">返回学习</button></div>';
  }
  // 从列表点一个词：这张卡排到最前面（在队列里就挪过来，不在的——比如已经练过的——就插到最前面）
  function jumpTo(id) {
    if (!cards().some(c => c.id === id)) return;
    queue = [id].concat(queue.filter(x => x !== id));
    pin = id; flipped = false; listView = false; render(); window.scrollTo({ top: 0 });
  }
  function revBox() {
    const n = revLeft().length;
    if (!D.cfg.srsOn || mode === 'rev') return '';
    if (!n) return (D.review || []).length ? '<div class="note">今天该复习的词都复习完了。</div>' : '';
    return '<div class="box"><h2>今天先复习 ' + n + ' 个 <small>学过的词按遗忘曲线回来；每次点「会了」，下次隔得更久（1、2、4、7、15 天）</small></h2><div><button class="btn main" data-act="rev">先复习这 ' + n + ' 个</button></div></div>';
  }
  function studyHTML() {
    const w = D.week;
    if (w.waiting || w.today < w.start) return '<div class="box"><h2>还没开始</h2><div class="muted">第 1 周从 ' + md(w.start) + ' 开始，到时候再来。</div></div>';
    if (mode === 'rev') {
      if (!queue.length) return '<div class="card"><h2>今天的复习做完了</h2><div class="muted">「会了」的词会隔得越来越久再出现；「不会」「不太确定」的明天再来。</div><div><button class="btn main" data-act="back">' + (w.kind === 'L' && todo().length ? '继续学本周的词' : '好的') + '</button></div></div>';
      return cardHTML(pool().find(x => x.id === queue[0]), '复习');
    }
    const top = revBox();
    if (w.kind === 'R') return top + '<div class="box"><h2>这周是回顾周</h2><div class="muted">这周不学新词。把前几周的词再过一遍，然后去「测验」做回顾测（从学过的词里抽题，及格线 ' + num(D.cfg.revPass, 95) + '%）。</div><div><button class="btn main" data-tab="test">去回顾测</button></div></div>' +
      (D.errbook.length ? '<div class="box"><h2>先看看错过的词</h2><div class="muted">一共 ' + D.errbook.length + ' 个，在「错词本」里。</div><div><button class="gbtn" data-tab="err">打开错词本</button></div></div>' : '');
    if (!cards().length) return top + '<div class="box"><h2>这周没有新词</h2><div class="muted">' + (rangeEmpty() ? '你的学习范围（' + esc(rangeLv().join('、')) + '）还没有放进词库，老师放进去以后，打开这个页面就会自动发词。' : '可能是这个范围的词已经全部学完了，或者老师给你暂停了一周。') + '</div></div>';
    if (listView) return listHTML();
    if (!queue.length) {
      const tested = (D.tests || []).some(x => x.done && (x.parts || []).includes('week'));
      const canMore = D.cfg.addOn && !(D.tests || []).some(x => x.started && (x.parts || []).includes('week'));
      return top + '<div class="card"><h2>' + (mode === 'all' ? '这一遍过完了' : '本周的 ' + cards().length + ' 个词都练过了') + '</h2>' +
        '<div class="muted">' + (tested ? '周测已经考完了。' : '学完记得去做周测：本周词单里的词全部都考，及格线 ' + num(D.cfg.pass, 95) + '%。') + '</div>' +
        '<div class="form">' +
        (!tested ? '<button class="btn main" data-tab="test">去周测</button>' : '') +
        '<button class="btn" data-act="all">从头再过一遍</button>' +
        (canMore ? '<button class="btn" data-act="more">再来一组（' + num(D.cfg.addN, 20) + ' 个，算进本周、一起考）</button>' : '') +
        '<button class="btn" data-act="list">看本周全部词，挑一个再练</button>' +
        '</div></div>';
    }
    return (flipped ? '' : top + weekLine()) + cardHTML(cards().find(x => x.id === queue[0]), '');
  }
  function cardHTML(c, tag) {
    if (!c) { resetQueue(); return '<div class="box"><h2>这张卡找不到了</h2><div><button class="btn" data-act="reload">重新读取</button></div></div>'; }
    if (!flipped) {
      const left = mode === 'rev' ? '今天的复习还剩 ' + queue.length + ' 个' : mode === 'all' ? '这一遍还剩 ' + queue.length + ' 个' : '本周还剩 ' + todo().length + ' 个没练完';
      return '<div class="card front" id="front" tabindex="0" role="button" aria-label="翻面看答案"><div class="chips"><span class="chip">' + esc(c.lvl) + '</span>' +
        (tag ? '<span class="chip ok">' + tag + '</span>' : '') + (again.has(c.id) || c.again ? '<span class="chip bad">今天再练一次</span>' : '') +
        (c.src === 'carry' ? '<span class="chip warn">上周错词</span>' : c.wrong > 0 ? '<span class="chip warn">错过的词</span>' : '') + '</div>' +
        '<div class="big" lang="ja">' + esc(c.w) + '</div><div class="hint">先想一想意思，再点一下翻面</div></div>' +
        '<div class="bar one"><button class="btn main" data-act="flip">翻面看答案 <span class="k">空格</span></button></div>' +
        '<div class="muted center">' + left + '</div>';
    }
    return '<div class="card">' + cardBack(c) + '</div>' +
      '<div class="bar"><button class="btn no" data-rate="no">不会 <span class="k">1</span></button><button class="btn" data-rate="mid">不太确定 <span class="k">2</span></button><button class="btn ok" data-rate="ok">会了 <span class="k">3</span></button></div>' +
      '<div class="muted small center">「不会」「不太确定」的词，今天还会再出现</div>';
  }
  function flip() { if (!queue.length || flipped || listView || tab !== 'study') return; flipped = true; render(); play(aud(queue[0])); }
  // 先存好再翻到下一张：没存上就留在这张，可以再点一次
  async function rate(a) {
    if (!flipped || !queue.length || saving) return;
    const id = queue[0], m0 = mode, D0 = D, c = pool().find(x => x.id === id);
    const need = mode === 'rev' ? !revDone.has(id) : !!c && (!c.done || c.again || a !== 'ok');
    if (need) {
      saving = true; document.querySelectorAll('[data-rate]').forEach(b => b.disabled = true);
      try { if (mode === 'rev') await rpc('stu_review', { wid: id, rating: a }); else await rpc('stu_rate', { wid: id, rating: a }); }
      catch (e) {
        saving = false; document.querySelectorAll('[data-rate]').forEach(b => b.disabled = false);
        if (/不在本周的词单|还没开始|停用/.test(e.message)) { toast(e.message); reload(); return; }
        toast('没存上：' + e.message + '。再点一次试试'); return;
      }
      saving = false;
      // 等回复的时候页面数据已经换过了（重新读取、换日、换周）：新数据里已经是服务器的状态，什么都不改
      if (D !== D0) { render(); return; }
      if (m0 === 'rev') revDone.add(id);
      else if (c) { if (c.st === 'assigned') c.st = 'learned'; if (!c.done) { c.done = true; D.week.done = num(D.week.done) + 1; } c.again = a !== 'ok'; }
      bumpStreak();
      // 换了学习方式、或者队首已经不是这张：只记下结果，不动现在的队列
      if (mode !== m0 || queue[0] !== id) { render(); return; }
    }
    stopAudio();
    queue.shift(); if (pin === id) pin = null;
    if (a !== 'ok') { again.add(id); queue.splice(Math.min(a === 'no' ? 2 : 5, queue.length), 0, id); if (queue.length === 1) toast('只剩这一个词了，再来一次'); }
    flipped = false; render(); window.scrollTo({ top: 0 });
  }
  // 学习范围（逐级、只学某几档时）在词库里有没有词
  function rangeLv() { const c = D.cfg; return c.mode === 'only' ? (c.only || []) : c.mode === 'step' ? LV.slice(Math.max(0, LV.indexOf(c.start))) : LV; }
  function rangeEmpty() { return rangeLv().every(l => !D.map[l]); }
  // 今天第一次学，顶部的连续天数马上加 1（服务器那边已经记了打卡）
  function bumpStreak() {
    const s = D.stats; if (!s) return;
    s.last30 = s.last30 || [];
    if (!s.last30.includes(D.week.today)) { s.last30.push(D.week.today); s.streak++; s.days = (s.days || 0) + 1; }
  }
  async function more(btn) {
    busy(btn, true);
    let r;
    try { r = await rpc('stu_more', {}, { obj: true }); } catch (e) { fail(e); busy(btn, false); return; }
    toast('加了 ' + num(r.added) + ' 个新词'); mode = 'new';
    await reload('已经加了 ' + num(r.added) + ' 个新词，但重新读取词单没成功');
  }

  // ── 测验 ──
  const KN = { week: '周测', review: '回顾测', quarter: '季度测', year: '年测' };
  const tName = x => (x.parts && x.parts.length > 1) ? x.parts.map(p => KN[p]).join('＋') + '（合成一场）' : (KN[x.kind] || '测验');
  function tDesc(x) {
    const c = D.cfg, un = unlearned().length, parts = x.parts || [x.kind], lines = [];
    let n = 0;
    if (parts.includes('week')) n += cards().length - (c.untaught === 'next' ? un : 0);
    const big = Math.max(parts.includes('review') ? num(c.revN, 100) : 0, parts.includes('quarter') ? num(c.qN, 150) : 0, parts.includes('year') ? num(c.yN, 300) : 0);
    const cnt = x.n ? '本次 ' + x.n + ' 题' : big ? '本次约 ' + Math.max(n, big) + ' 题' : '本次 ' + n + ' 题';
    lines.push('<b>' + cnt + '｜答对 ' + num(x.pass, 95) + '% 及格</b>');
    if (parts.includes('week')) lines.push('本周词单里的词全部都考（含上周错词、追加的）' + (un ? (c.untaught === 'next' ? '；还有 ' + un + ' 个没学的词，这次不考，挪到下周' : '；还有 ' + un + ' 个没学的词，这次也会考，最好先学完') : '') + '。');
    if (parts.includes('review')) lines.push('从前几周学过的词里抽题' + (c.revMust === false ? '' : '，前几周错过的一定会抽到') + (D.week.kind === 'R' && D.week.ncarry ? '，带过来的 ' + D.week.ncarry + ' 个错词也一起考' : '') + '。');
    if (parts.includes('quarter')) lines.push('季度测：从最近这段时间学过的词里抽题。');
    if (parts.includes('year')) lines.push('年测：从这一年学过的词里抽题。');
    if (c.instant === true) {
      const wy = JN.filter(([t]) => (c.whyT || {})[t]).map(([, nm]) => nm);
      lines.push('每题选了<b>马上告诉你对不对</b>，选了就不能改' + (wy.length ? '；' + wy.join('、') + '题还会显示解析' : '') + '。答错的词马上放进错词本。');
      lines.push('开始后可以中途退出，回来点「接着考」：答过的题都记下了（换手机也在）。');
    } else lines.push(canStore ? '开始后可以中途退出，用<b>同一部手机、同一个浏览器</b>回来点「接着考」；交卷后不能再改。' : '<span class="bad">这个浏览器不能保存答案</span>：开始后请一次答完再离开，中途关掉页面答案会丢。');
    return lines.map(l => '<div>' + l + '</div>').join('');
  }
  const JN = [['yomi', '漢字読み'], ['hyoki', '表記'], ['bunmyaku', '文脈規定'], ['iikae', '言い換え'], ['yoho', '用法']];
  function testHTML() {
    const w = D.week, list = D.tests || [];
    if (w.waiting || w.today < w.start) return '<div class="box"><h2>还没开始</h2><div class="muted">第 1 周从 ' + md(w.start) + ' 开始。</div></div>';
    if (T) return quizHTML();
    if (!list.length) return '<div class="box"><h2>这周没有测验</h2></div>';
    let h = list.length > 1 ? '<div class="muted">这周有 ' + list.length + ' 场测验，按顺序一场一场考。</div>' : '';
    list.forEach((x, i) => {
      if (x.done) {
        h += '<div class="card"><h2>' + tName(x) + ' 考完了</h2><div class="stats">' +
          '<div class="stat"><b>' + num(x.score) + ' / ' + num(x.total) + '</b><span>答对</span></div>' +
          '<div class="stat"><b>' + (x.total ? Math.floor(x.score * 100 / x.total) : 0) + '%</b><span>正确率</span></div>' +
          '<div class="stat"><b>' + (x.passed ? '及格' : x.manual ? '老师放行' : '没及格') + '</b><span>结果</span></div></div>' +
          ((x.parts || []).includes('week') && !(x.passed || x.manual) ? '<div class="muted">错的词会按老师的设置带到下一周再学。</div>' : '') + '</div>';
      } else {
        const before = list.slice(0, i).some(y => !y.done);
        h += '<div class="card"><h2>' + tName(x) + '</h2><div class="muted tdesc">' + tDesc(x) + '</div>' +
          '<div><button class="btn main" data-act="tstart" data-kd="' + esc(x.kind) + '"' + (before ? ' disabled' : '') + '>' + (x.started ? '接着考' : '开始') + '</button>' + (before ? ' <span class="muted">先考完上面那场</span>' : '') + '</div></div>';
      }
    });
    if (list.length && list.every(x => x.done)) h += '<div class="muted">' + md(addDays(w.end, 1)) + '自动进入下一周。' + (D.errbook.length ? ' <button class="link" data-tab="err">看错词本</button>' : '') + '</div>';
    if ((D.history || []).length) {
      h += '<div class="box"><h2>以前的成绩</h2><div class="scroll"><table class="t"><tr><th>周</th><th>类型</th><th>成绩</th><th>结果</th></tr>' +
        D.history.map(x => '<tr><td>第 ' + num(x.no) + ' 周</td><td>' + esc(KN[x.kind] || x.kind) + '</td><td>' + (x.total ? num(x.score) + ' / ' + num(x.total) : '没考') + '</td><td>' +
          (x.total ? (x.passed ? '<span class="chip ok">及格</span>' : x.manual ? '<span class="chip">放行</span>' : '<span class="chip bad">没及格</span>') : '—') + '</td></tr>').join('') + '</table></div></div>';
    }
    return h;
  }
  async function tstart(btn) {
    if (starting) return;
    starting = true; document.querySelectorAll('[data-act="tstart"]').forEach(b => b.disabled = true);
    try {
      const r = await rpc('stu_test_start', { kd: btn.dataset.kd || null, cv: CV }, { obj: true });
      if (!r.id || !Array.isArray(r.items) || !r.items.length || !r.items.every(i => i && Array.isArray(i.o) && i.o.length >= 2)) throw new Error('试卷没有读出来，请刷新页面再试');
      T = r; T.week = r.week_id || D.week.id;   // 这张卷属于哪一周（页面还停在上周时，以卷为准）
      const x = (D.tests || []).find(y => y.kind === T.kind); if (x) { x.started = true; x.id = T.id; x.n = T.items.length; }
      const n = T.items.length;
      instant = r.instant === true;
      ans = restore(T.id, T.items) || new Array(n).fill(null);
      // 当场判对错：服务器上已经记下的题以服务器为准（换了手机、浏览器也接得上）；判过的结果这个页面里有就直接用，没有的看到时再取
      srv = new Set(); pend = new Map(); fetchBad = new Set(); answering = null; fetching = null; syncBad = false;   // 旧请求回来时会核对编号，不会动这些
      if (instant && Array.isArray(r.picks) && r.picks.length === n)
        r.picks.forEach((v, i) => { if (Number.isInteger(v) && v >= 0 && v < T.items[i].o.length) { ans[i] = v; srv.add(i); } });
      const old = memRes.get(T.id) || [];
      res = Array.from({ length: n }, (_, i) => srv.has(i) && old[i] && old[i].mine === ans[i] ? old[i] : null);
      memRes.set(T.id, res);
      qi = ans.findIndex(a => a === null); if (qi < 0) qi = n - 1;
      stored = true; save();
      starting = false; render(); window.scrollTo({ top: 0 });
      if (T.week !== D.week.id) reload();   // 页面还停在上一周：卷是本周的，把页面也换到本周（卷不动）
    } catch (e) { starting = false; T = null; fail(e); render(); }
  }
  // 题型：问法、题干、选项的样子
  const QT = {
    jc: '这个词是什么意思？', cj: '哪个日语词是这个意思？', kr: '这个词怎么读？',
    yomi: '画线的词怎么读？', hyoki: '画线的词用汉字怎么写？', bunmyaku: '（　）里放哪个最合适？',
    iikae: '哪个和画线部分的意思最接近？', yoho: '这个词用得对的是哪一句？',
  };
  const qText = it => it.s ? (it.t === 'kr' ? '画线的词在这句里怎么读？' : '画线的词在这句里是什么意思？') : (QT[it.t] || '');
  const isJ = t => ['yomi', 'hyoki', 'bunmyaku', 'iikae', 'yoho'].includes(t);
  const sentHTML = (q, cls) => '<div class="qs' + (cls || '') + '" lang="ja">' + rb(q).replace(/（　）/g, '<span class="blank">（　　）</span>') + '</div>';
  const stemHTML = it => it.s ? sentHTML(it.s) : isJ(it.t) && it.t !== 'yoho' ? sentHTML(it.q)
    : '<div class="q' + (it.t === 'cj' ? ' zhq' : '') + '" lang="' + (it.t === 'cj' ? 'zh' : 'ja') + '">' + esc(it.q) + '</div>';
  const optHTML = (it, o) => isJ(it.t) ? rb(o) : esc(o);
  const jpOpt = t => t !== 'jc';
  // rs：当场判过的结果（选的标红/绿、正确的标绿）；lock：这题的选项不能再点
  function qBody(it, sel, rs, lock) {
    return '<div class="muted">' + qText(it) + '</div>' + stemHTML(it) +
      '<div class="opts' + (it.t === 'yoho' ? ' long' : '') + (rs ? ' judged' : '') + '" role="group" aria-label="选项">' + it.o.map((o, j) => {
        let cls = 'opt' + (jpOpt(it.t) ? ' jpo' : ''), no = String(j + 1), say = '';
        if (rs) { if (j === rs.a) { cls += ' right'; no = '✓'; say = '（正确答案）'; } else if (j === rs.mine) { cls += ' wrong'; no = '✗'; say = '（你选的，错了）'; } }
        else if (sel === j) cls += ' sel';
        return '<button type="button" class="' + cls + '" data-opt="' + j + '" aria-pressed="' + (sel === j) + '"' + (lock ? ' disabled' : '') + (jpOpt(it.t) ? ' lang="ja"' : '') + '><span class="no">' + no + '</span>' + optHTML(it, o) + (say ? '<span class="sr">' + say + '</span>' : '') + '</button>';
      }).join('') + '</div>';
  }
  // 当场判对错的这一题下面显示什么：结果和解析 / 正在判 / 正在取回 / 没取回来
  function verdictHTML(rs) {
    if (rs) return '<div class="vd ' + (rs.ok ? 'ok' : 'bad') + '" role="status">' + (rs.ok ? '答对了' : '答错了，正确答案是第 ' + (rs.a + 1) + ' 个') + '</div>' + (rs.why ? '<div class="why">' + esc(rs.why) + '</div>' : '');
    if (answering && answering.i === qi) return '<div class="vd muted" role="status">正在记答案……</div>';
    if (pend.has(qi)) return '<div class="vd warn" role="status">还没确认是否记下（网络不稳定）。刚才选的是第 ' + (pend.get(qi) + 1) + ' 个，点「再试一次」用同一个答案再记一次 <button type="button" class="gbtn" data-act="retry">再试一次</button></div>';
    if (srv.has(qi)) return fetchBad.has(qi) ? '<div class="vd muted" role="status">这题已经记下了，结果没取回来 <button type="button" class="gbtn" data-act="refetch">再取一次</button></div>' : '<div class="vd muted" role="status">正在取回这题的结果……</div>';
    if (ans[qi] !== null) return '<div class="small muted">上次选的这个还没判对错，点一个选项就判（选了就不能改）</div>';
    return '<div class="small muted">选了马上告诉你对不对，选了就不能改</div>';
  }
  function quizHTML() {
    const it = T.items[qi], n = T.items.length, answered = ans.filter(a => a !== null).length, last = qi === n - 1;
    const rs = instant ? res[qi] : null, lock = instant && (srv.has(qi) || !!answering || pend.has(qi));
    const sel = pend.has(qi) ? pend.get(qi) : answering && answering.i === qi ? answering.choice : ans[qi];   // 还没确认的选择也标出来
    return (!instant && (!stored || !canStore) ? '<div class="warnbox"><b>答案没能存到这个浏览器</b>（浏览器不允许保存或空间满了）。请先留在这里答完、交卷；关掉或刷新页面，答过的题会丢。</div>' : '') +
      (syncBad ? '<div class="vd warn" role="status">没能核对另一台设备的答题情况（网络不稳定），先别交卷。<button type="button" class="gbtn" data-act="resync">再试一次</button></div>' : '') +
      '<div class="prog"><span>第 ' + (qi + 1) + ' / ' + n + ' 题 · 已答 ' + answered + '</span><div class="track"><div class="fill" style="width:' + answered / n * 100 + '%"></div></div></div>' +
      '<div class="card">' + qBody(it, sel, rs, lock) + (instant ? verdictHTML(rs) : '') + '</div>' +
      '<div class="bar two"><button class="btn" data-act="prev"' + (qi === 0 ? ' disabled' : '') + '>上一题</button>' +
      (!last ? '<button class="btn' + (sel !== null ? ' main' : '') + '" data-act="next">' + (sel !== null ? '下一题' : '跳过，下一题') + '</button>' : '<button class="btn main" data-act="submit">交卷</button>') + '</div>' +
      '<div class="center"><button class="link" data-act="quit">先退出，等会儿再考</button>' + (answered === n && !last ? ' · <button class="link" data-act="submit">全部答完了，交卷</button>' : '') + '</div>';
  }
  // 选了就标出来，不自动跳题（点「下一题」才往下走，不会一下跳过两题）
  // 当场判对错时：先问服务器（等回复时选项不能点），回来了才标红绿，不在本地先判。
  //   服务器明确拒绝（4xx）：这次没记下，可以重新选；网络断了、回复丢了、回复不对：不知道记没记下 → 保留这次选择，用同一个选项再试，
  //   最后以服务器返回的 mine 为准（服务器已经记下的话会原样返回第一次的）
  const goodRes = (r, i) => !!r && r.i === i && Number.isInteger(r.mine) && Number.isInteger(r.a) && typeof r.ok === 'boolean'
    && r.mine >= 0 && r.mine < T.items[i].o.length && r.a >= 0 && r.a < T.items[i].o.length;
  const gone = e => /交过|过期|找不到这次测验/.test(e.message);
  const sure = e => !e.net && e.status >= 400 && e.status < 500;
  // 拿到服务器的结果（第一次判、重试、取回旧结果都走这里）：服务器说这题已经记进错词本（inbook），页签上的数就算上
  const take = (i, r) => { res[i] = r; srv.add(i); ans[i] = r.mine; pend.delete(i); fetchBad.delete(i); save(); if (r.inbook === true && !errNew.has(T.items[i].id)) errNew.set(T.items[i].id, Date.now()); };
  function pick(j) {
    if (!T || submitting || checking) return;
    if (!instant) { ans[qi] = j; save(); render(); return; }
    if (srv.has(qi) || answering || pend.has(qi)) return;
    send(qi, j);
  }
  async function send(i, j) {
    const retry = pend.has(i);                  // 这题之前没收到确认：第一次可能已经存上了
    const my = { req: ++reqNo, tid: T.id, i, choice: j };
    answering = my; render();
    let r = null, err = null;
    try { r = await rpc('stu_test_answer', { tid: my.tid, i, choice: j }, { obj: true, timeout: WAIT }); } catch (e) { err = e; }
    // 旧请求（这期间重新进过测验、换过卷）：不动现在的状态；只有同一张卷、服务器明确给了结果时记下来
    if (answering !== my) { if (!err && T && T.id === my.tid && goodRes(r, i)) { take(i, r); if (tab === 'test') render(); } return; }
    answering = null;
    if (!T || T.id !== my.tid) return;
    if (!err && goodRes(r, i)) { take(i, r); render(); return; }
    if (err && gone(err)) { forget(my.tid); T = null; toast(err.message); await reload(); return; }
    // 第一次发送就被服务器明确拒绝：这次肯定没记下，可以重新选
    if (err && sure(err) && !retry) {
      pend.delete(i);
      if (/交卷以后再看对错/.test(err.message)) { instant = false; ans[i] = j; save(); toast('这周的设置是交卷以后再看对错'); render(); return; }
      toast('没记上：' + err.message); render(); return;
    }
    // 回复丢了、超时、回复不对、待确认题的重试被拒（第一次可能已经存上了）：保留这次选择和离开提醒，拿到服务器返回的 mine 才算确认
    pend.set(i, j); render();
    const why = err && sure(err) && !/^操作没成功/.test(err.message) ? '（' + err.message + '）' : '';   // 只带上服务器自己写的原因，不带「请刷新」这类通用话
    toast(err && err.timeout ? '网络太慢，这题还没确认是否记下' : retry && err && sure(err) ? '还是没确认是否记下' + why + '，过一会儿再点「再试一次」' : '网络不稳定，这题还没确认是否记下');
  }
  // 服务器上已经记下、但这个页面里没有结果的题（接着考、换了手机）：看到这一题时取回结果（服务器原样返回，不会改答案）
  function needRes() { if (srv.has(qi) && !res[qi] && !fetchBad.has(qi) && !fetching && !answering) fetchRes(qi); }
  async function fetchRes(i) {
    const my = { req: ++reqNo, tid: T.id, i };
    fetching = my;
    let r = null, err = null;
    try { r = await rpc('stu_test_answer', { tid: my.tid, i, choice: ans[i] }, { obj: true, timeout: WAIT }); } catch (e) { err = e; }
    if (fetching !== my) { if (!err && T && T.id === my.tid && goodRes(r, i)) { take(i, r); if (tab === 'test') render(); } return; }
    fetching = null;
    if (!T || T.id !== my.tid) return;
    if (!err && goodRes(r, i)) take(i, r);
    else if (err && gone(err)) { forget(my.tid); T = null; toast(err.message); await reload(); return; }
    else fetchBad.add(i);
    if (tab === 'test') render();
  }
  // 交卷前和服务器核对一次（另一台手机上可能答过、交过）：服务器上已经记下的题补进来
  async function syncPicks() {
    const T0 = T;
    let d; try { d = await load(); } catch (e) { return 'skip'; }
    if (!d || T !== T0) return 'skip';
    newer(d);                                   // 换周了会结束这张卷（和平时一样提示）
    if (T !== T0) return 'gone';
    const x = (d.tests || []).find(y => y.id === T0.id);
    if (!x) return 'skip';
    if (x.done) return 'done';
    if (Array.isArray(x.picks) && x.picks.length === T0.items.length)
      x.picks.forEach((v, i) => { if (Number.isInteger(v) && v >= 0 && v < T0.items[i].o.length && !srv.has(i)) { ans[i] = v; srv.add(i); res[i] = null; pend.delete(i); } });
    save(); return 'ok';
  }
  // 离开测验前：答案没存上就先问一声，不会悄悄丢掉。当场判对错时：正在记答案就先别走；有没确认记下的题，先请他回去再试一次
  async function leaveQuiz() {
    if (!T) return true;
    if (instant && answering) { toast('正在记这一题的答案，等一下再离开'); return false; }
    if (instant && pend.size) {
      const T0 = T, first = Math.min(...pend.keys());
      const v = await ask('有 ' + pend.size + ' 题还没确认是否记下', '网络不稳定，刚才选的答案还没确认记上。请先回去点「再试一次」。如果现在离开，回来接着考时只算已经记下的题，没记上的要重新选。',
        [['stay', '回去再试一次', true], ['leave', '仍要离开']]);
      if (T !== T0) return true;
      if (v !== 'leave') { qi = first; render(); return false; }
    }
    if (!instant && (!stored || !canStore)) {
      const v = await ask('答案没能存到这个浏览器', '现在离开的话，答过的题只记在这个页面里；关掉或刷新页面就没了。', [['stay', '留在测验', true], ['leave', '仍要离开']]);
      if (v !== 'leave') return false;
    }
    T = null; return true;
  }
  async function submit() {
    if (!T || submitting || checking) return;
    if (answering) { toast('正在记这一题的答案，等一下再交卷'); return; }
    if (pend.size) { qi = Math.min(...pend.keys()); render(); toast('有 ' + pend.size + ' 题还没确认是否记下，先点「再试一次」'); return; }
    if (instant) {
      const T0 = T;
      checking = true; const st = await syncPicks(); checking = false;
      if (T !== T0 || submitting) return;
      if (st === 'done') { forget(T0.id); T = null; toast('这场测验已经交过了（可能是在另一台手机上交的）'); await reload(); return; }
      if (st !== 'ok') { syncBad = true; render(); window.scrollTo({ top: 0 }); toast('没能核对另一台设备的答题情况，点「再试一次」'); return; }
      syncBad = false; render();
    }
    const left = ans.filter(a => a === null).length;
    if (left) {
      const v = await ask('还有 ' + left + ' 题没答', '没答的题算错。', [['go', '去第一道没答的题', true], ['send', '仍然交卷']]);
      if (!T || submitting) return;
      if (v === 'go') { qi = ans.findIndex(a => a === null); render(); return; }
      if (v !== 'send') return;
    }
    submitting = true; document.querySelectorAll('.opt,[data-act]').forEach(b => b.disabled = true);
    const tid = T.id, sent = ans.map(a => a === null ? -1 : a);
    let r;
    try { r = await rpc('stu_test_submit', { tid, ans: sent }, { obj: true }); }
    catch (e) {
      submitting = false;
      if (/已经交过/.test(e.message) || /过期/.test(e.message)) { forget(tid); T = null; toast(e.message); await reload(); return; }
      fail(e); render(); return;
    }
    forget(tid);
    const x = (D.tests || []).find(y => y.id === tid || y.kind === r.kind);
    if (x) Object.assign(x, { done: true, started: true, score: r.score, total: r.total, passed: r.passed });
    T = null; submitting = false;
    resultModal(r);
    await reload('成绩已经交上了，但页面刷新没成功');
  }
  // 交卷后的错题解析：题目、正确答案、自己选的、为什么
  function reviewHTML(r) {
    const card = {}; (r.wrong || []).forEach(c => card[c.id] = c);
    const rows = (r.review || []).length ? r.review : (r.wrong || []).map(c => ({ id: c.id }));
    return '<div class="rvs">' + rows.map(x => {
      const c = card[x.id] || {};
      let h = '<div class="rv"><div class="rvh"><span class="nm" lang="ja">' + esc(c.w || '') + '</span><span class="muted" lang="ja">' + esc(c.r && c.r !== c.w ? c.r : '') + '</span><span class="sub">' + esc(c.m || '') + '</span></div>';
      if (Array.isArray(x.o)) {
        h += '<div class="small muted">' + qText(x) + '</div>' + (x.s ? sentHTML(x.s, ' sm') : isJ(x.t) && x.t !== 'yoho' ? sentHTML(x.q, ' sm') : '<div class="rvq" lang="' + (x.t === 'cj' ? 'zh' : 'ja') + '">' + esc(x.q) + '</div>');
        h += '<div class="rvo">' + x.o.map((o, j) => '<div' + (j === x.a ? ' class="ok"' : j === x.mine ? ' class="bad"' : '') + (jpOpt(x.t) ? ' lang="ja"' : '') + '><i>' + (j === x.a ? '✓' : j === x.mine ? '✗' : (j + 1)) + '</i>' + optHTML(x, o) + '</div>').join('') + '</div>';
        if (x.mine < 0) h += '<div class="small muted">这题没有作答</div>';
        if (x.why) h += '<div class="why">' + esc(x.why) + '</div>';
      }
      return h + '</div>';
    }).join('') + '</div>';
  }
  function resultModal(r) {
    const tot = num(r.total), sc = num(r.score), pct = tot ? Math.floor(sc * 100 / tot) : 0, wr = r.wrong || [];
    modal('<h2>' + (r.passed ? '及格了！' : '这次没及格') + '</h2><div class="stats"><div class="stat"><b>' + sc + ' / ' + tot + '</b><span>答对</span></div><div class="stat"><b>' + pct + '%</b><span>正确率</span></div><div class="stat"><b>' + num(r.pass, 95) + '%</b><span>及格线</span></div></div>' +
      (wr.length ? '<div class="lab">答错的 ' + wr.length + ' 个（已放进错词本），下面是每道错题的解析</div>' + reviewHTML(r) : '<div class="muted">全部答对了。</div>') +
      '<button class="btn main" data-close>好的</button>');
  }

  // ── 错词本 ──
  function errHTML() {
    if (!D.errbook.length) return '<div class="box"><h2>错词本是空的</h2><div class="muted">测验答错的词会放到这里。</div></div>';
    return '<div class="muted">一共 ' + D.errbook.length + ' 个，最近一周错的排在前面。</div>' +
      D.errbook.map(c => '<div class="card">' + cardBack(c, { chip: '<span class="chip warn">错过 ' + num(c.wrong) + ' 次</span>' + (c.st === 'correct' ? ' <span class="chip ok">后来答对了</span>' : '') + (c.off ? ' <span class="chip">已停用</span>' : '') }) + '</div>').join('');
  }

  // ── 拼图地图 ──
  const BADGES = [
    ['streak', 3, '连续 3 天'], ['streak', 7, '连续 7 天'], ['streak', 30, '连续 30 天'], ['streak', 100, '连续 100 天'],
    ['learned', 100, '学过 100 个'], ['learned', 500, '学过 500 个'], ['learned', 1000, '学过 1000 个'], ['learned', 3000, '学过 3000 个'],
    ['correct', 100, '答对 100 个'], ['correct', 700, '答对 700 个'], ['passed', 1, '第一次及格'], ['passed', 10, '及格 10 次'],
  ];
  // ── 我的学法：现在的方案、别的方案、申请换方案（老师审批） ──
  function planHTML() {
    const mp = D.myplan; if (!mp) return '';
    const rq = D.req, pend = !!rq && rq.status === 'pending', others = (D.plans || []).filter(x => x.key !== mp.key);
    let h = '<div class="box" id="myplan"><h2>我的学法</h2><div><b>' + esc(mp.name) + '</b>：' + esc(lvText(mp.lv, { weekly: num(mp.weekly) })) + '</div>' +
      '<div class="small muted">下一张新生成的周词单起按这个（已经发的这一周照旧）。</div>';
    const curP = (D.plans || []).find(x => x.key === mp.key);   // 老师单独调过、而且实际学法和方案本来的说法不一样时才提（逐级时单独的比例用不上，不提）
    if (mp.own && (!curP || lvText(curP.lv) !== lvText(mp.lv))) h += '<div class="small muted">老师给你单独调过学法，以老师调的为准' + (curP ? '（方案「' + esc(mp.name) + '」本来是：' + esc(lvText(curP.lv)) + '）' : '') + '。</div>';
    if (rq && pend) h += '<div class="note">已申请换成「<b>' + esc(rq.tname) + '</b>」，等老师审批。' + (rq.reason ? '理由：' + esc(rq.reason) : '') + ' <button type="button" class="gbtn" data-act="pcancel">撤回申请</button></div>';
    else if (rq && rq.status === 'approved') h += '<div class="note pok">老师已同意，从下一张新的周词单起换成「<b>' + esc(rq.tname) + '</b>」。' + (rq.note ? '老师说：' + esc(rq.note) : '') + ' <button type="button" class="gbtn" data-act="pseen">知道了</button></div>';
    else if (rq && rq.status === 'rejected') h += '<div class="note pno">老师没有同意换成「<b>' + esc(rq.tname) + '</b>」。' + (rq.note ? '老师说：' + esc(rq.note) : '') + ' <button type="button" class="gbtn" data-act="pseen">知道了</button></div>';
    if (others.length) {
      h += '<div class="lab muted">别的学法</div><div class="list">' + others.map(x => '<div class="it"><div class="main"><div class="nm">' + esc(x.name) + '</div><div class="sub">' + esc(lvText(x.mine || x.lv)) + '</div>' + ownNote(x) + '</div>' +
        '<button type="button" class="gbtn" data-preq="' + esc(x.key) + '"' + (pend ? ' disabled' : '') + '>申请换成这个</button></div>').join('') + '</div>' +
        '<div class="small muted">' + (pend ? '先撤回现在的申请，才能申请别的。' : '申请后由老师审批；同意了从下一张新的周词单起换，已经发的这一周照旧。') + '</div>';
    }
    return h + '</div>';
  }
  // 申请换方案：可以写一句理由（不写也行，最多 100 字）
  function reqModal(pk) {
    const x = (D.plans || []).find(y => y.key === pk); if (!x) return;
    const m = modal('<h2>申请换成「' + esc(x.name) + '」</h2><div class="muted">换过去后：' + esc(lvText(x.mine || x.lv)) + '</div>' + ownNote(x) +
      '<form class="form" id="rqf"><label>想换的理由（可以不写，最多 100 字）<textarea id="rqr" rows="3" maxlength="100"></textarea></label>' +
      '<div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main" id="rqs">提交申请</button></div></form>');
    m.querySelector('#rqf').addEventListener('submit', async e => {
      e.preventDefault(); const b = m.querySelector('#rqs'); if (b.disabled) return; busy(b, true);
      let r; try { r = await rpc('stu_plan_request', { act: 'apply', pk, reason: m.querySelector('#rqr').value.trim() }, { obj: true }); }
      catch (er) { fail(er); busy(b, false); if (/已经有一个|现在用的方案|找不到这个方案/.test(er.message)) { m.close(); refreshSide('map'); } return; }
      D.req = r.req || null; m.close(); toast('已申请，等老师审批'); if (tab === 'map') render();
    });
  }
  // 撤回申请 / 关掉老师处理结果的提示：都带上页面上这一条的编号（不会撤回、关掉别的那条）。
  // 这一条的状态已经变了（老师刚处理完、已经撤回过、上次回复丢了）：服务器什么都不改，按它说的现在的样子显示
  async function planAct(btn, want) {
    const rq = D.req; if (!rq) return;
    busy(btn, true);
    let r; try { r = await rpc('stu_plan_request', { act: want, rid: rq.id }, { obj: true }); }
    catch (er) { fail(er); busy(btn, false); refreshSide('map'); return; }
    const w = r.was || {};
    if (r.act === 'cancelled' || (want === 'cancel' && w.status === 'cancelled')) toast('已撤回申请');
    else if (want === 'cancel' && w.status === 'approved') toast('老师刚刚已经同意了：从下一张新的周词单起换成「' + w.tname + '」');
    else if (want === 'cancel' && w.status === 'rejected') toast('老师刚刚已经处理了：没有同意' + (w.note ? '（' + w.note + '）' : ''));
    D.req = r.req || null;
    if (want === 'cancel' && w.status === 'approved') { refreshSide('map'); return; }   // 方案刚换了：重新读取一次
    if (tab === 'map') render();
  }
  // 候选方案：上面写的是换过去后这个学生实际的学法（默认＋方案＋他自己单独的设置）；老师给他单独调过、和方案本来的说法不一样时，写明方案本来是什么
  const ownNote = x => x.mine && lvText(x.mine) !== lvText(x.lv) ? '<div class="sub ownl">老师给你单独调过学法，上面是换过去后你实际的学法；这个方案本来是：' + esc(lvText(x.lv)) + '</div>' : '';

  function mapHTML() {
    const c = D.cfg, si = LV.indexOf(c.start), s = D.stats || { streak: 0, learned: 0, correct: 0, passed: 0, days: 0, last30: [] };
    const skipped = l => c.mode === 'only' ? !(c.only || []).includes(l) : c.mode === 'step' ? LV.indexOf(l) < si : false;
    let h = '<div class="box"><h2>我的进度</h2><div class="stats">' +
      '<div class="stat"><b>' + num(s.streak) + ' 天</b><span>连续打卡</span></div><div class="stat"><b>' + num(s.learned) + '</b><span>学过的词（累计）</span></div><div class="stat"><b>' + num(s.correct) + '</b><span>现在全亮的词</span></div></div>';
    const on = new Set(s.last30 || []);
    let cal = ''; for (let i = 29; i >= 0; i--) { const k = addDays(D.week.today, -i), [, mm, dd] = k.split('-'); cal += '<i' + (on.has(k) ? ' class="f"' : '') + ' title="' + (+mm) + '月' + (+dd) + '日"></i>'; }
    h += '<div class="lab muted">最近 30 天（学过卡、复习过或考过试就亮）</div><div class="cal">' + cal + '</div>';
    h += '<div class="lab muted">成就</div><div class="badges">' + BADGES.map(([k, n, name]) => '<span class="badge' + ((k === 'streak' ? Math.max(num(s.streak), num(s.best)) : num(s[k])) >= n ? ' got' : '') + '">' + name + '</span>').join('') + '</div></div>';
    h += planHTML();
    if ((D.class || []).length) {
      h += '<div class="box"><h2>' + esc(D.me.grp) + ' <small>同班同学，按名字排</small></h2><div class="list">' + D.class.map(m =>
        '<div class="it"><span class="nm">' + esc(m.name) + (m.me ? ' <span class="chip">我</span>' : '') + '</span><span class="sub">' + (m.today ? '<span class="chip ok">今天学了</span> ' : '') + '连续 ' + num(m.streak) + ' 天 · 本周练过 ' + num(m.week) + ' 个</span></div>').join('') + '</div></div>';
    }
    h += '<div class="muted">词库地图：学过的词先半亮，测验答对了全亮。</div>';
    for (const l of LV) {
      const m = D.map[l];
      if (!m) { h += '<div class="box"><h2>' + l + ' <small>还没有放进词库</small></h2></div>'; continue; }
      const half = new Set(m.half), full = new Set(m.full), sk = skipped(l);
      let cells = ''; for (let i = 1; i <= m.total; i++) cells += '<i' + (full.has(i) ? ' class="f"' : half.has(i) ? ' class="h"' : '') + '></i>';
      h += '<div class="box"><h2>' + l + ' <small>' + (sk ? '已掌握（不用学）' : '全亮 ' + full.size + ' · 半亮 ' + half.size + ' · 共 ' + num(m.total)) + '</small></h2><div class="map' + (sk ? ' done' : '') + '" aria-label="' + l + ' 共 ' + num(m.total) + ' 个词，全亮 ' + full.size + ' 个">' + cells + '</div></div>';
    }
    return h;
  }

  document.addEventListener('click', async e => {
    if (!D || $('app').dataset.role === 'adm' || e.target.closest('.modal')) return;
    const t = e.target;
    if (saving && t.closest('[data-tab],[data-act="all"],[data-act="rev"],[data-act="back"],[data-act="more"],[data-act="list"],[data-act="unlist"],[data-wid]')) { toast('正在保存，等一下'); return; }
    const tb = t.closest('[data-tab]'); if (tb) {
      if (submitting) { toast('正在交卷，等一下'); return; }
      if (T && tb.dataset.tab !== 'test' && !(await leaveQuiz())) return;
      tab = tb.dataset.tab; listView = false; window.scrollTo({ top: 0 });
      render();
      if (tab === 'map' || tab === 'err') refreshSide(tab);
      return;
    }
    if (t.closest('#front')) { flip(); return; }
    const r = t.closest('[data-rate]'); if (r) { rate(r.dataset.rate); return; }
    const o = t.closest('[data-opt]'); if (o && T) { if (!o.disabled) pick(+o.dataset.opt); return; }
    const wc = t.closest('[data-wid]'); if (wc) { jumpTo(wc.dataset.wid); return; }
    const pq = t.closest('[data-preq]'); if (pq) { if (!pq.disabled) reqModal(pq.dataset.preq); return; }
    const a = t.closest('[data-act]'); if (!a || a.disabled) return;
    const act = a.dataset.act;
    if (act === 'flip') flip();
    else if (act === 'all') { mode = 'all'; listView = false; resetQueue(); render(); }
    else if (act === 'rev') { mode = 'rev'; listView = false; resetQueue(); render(); window.scrollTo({ top: 0 }); }
    else if (act === 'back') { mode = 'new'; listView = false; resetQueue(); render(); window.scrollTo({ top: 0 }); }
    else if (act === 'list') { if (flipped || mode === 'rev') return; listView = true; render(); window.scrollTo({ top: 0 }); }
    else if (act === 'unlist') { listView = false; render(); window.scrollTo({ top: 0 }); }
    else if (act === 'refetch') { if (!T) return; fetchBad.delete(qi); render(); }
    else if (act === 'pcancel') planAct(a, 'cancel');
    else if (act === 'pseen') planAct(a, 'seen');
    else if (act === 'resync') { if (T && !checking && !submitting) submit(); }
    else if (act === 'retry') { if (T && instant && pend.has(qi) && !answering && !submitting) send(qi, pend.get(qi)); }
    else if (act === 'more') more(a);
    else if (act === 'reload') { busy(a, true); reload(); }
    else if (act === 'tstart') tstart(a);
    else if (act === 'prev') { if (!T || submitting) return; qi = Math.max(0, qi - 1); render(); }
    else if (act === 'next') { if (!T || submitting) return; qi = Math.min(T.items.length - 1, qi + 1); render(); }
    else if (act === 'quit') {
      if (submitting || checking) return;
      const was = stored && canStore, inst = instant, unsure = pend.size > 0;
      if (await leaveQuiz()) { render(); if (inst) toast(unsure ? '已经记下的题都在；没确认的题，回来接着考时再看一下' : '答过的题都记下了，回来点「接着考」'); else if (was) toast('答过的题记在这个浏览器里了，用同一个浏览器回来点「接着考」'); }
    }
    else if (act === 'submit') submit();
  });
  document.addEventListener('keydown', e => {
    if (!D || $('app').dataset.role === 'adm' || document.querySelector('.modal')) return;
    if (tab === 'study' && !flipped && !listView && (e.key === ' ' || e.key === 'Enter') && queue.length && !e.target.closest('button')) { e.preventDefault(); flip(); }
    else if (tab === 'study' && flipped && ['1', '2', '3'].includes(e.key)) rate({ 1: 'no', 2: 'mid', 3: 'ok' }[e.key]);
    else if (T && ['1', '2', '3', '4'].includes(e.key) && T.items[qi].o[+e.key - 1] !== undefined) pick(+e.key - 1);
    else if (T && !submitting && e.key === 'ArrowRight' && qi < T.items.length - 1) { qi++; render(); }
    else if (T && !submitting && e.key === 'ArrowLeft' && qi > 0) { qi--; render(); }
  });
  window.addEventListener('beforeunload', e => { if (unsaved.size || (T && !instant && (!stored || !canStore)) || (T && instant && (answering || pend.size))) { e.preventDefault(); e.returnValue = ''; } });
  return { start };
})();
