// 单词学习系统 · 管理端：学生、设置面板（全局 → 方案 → 学生三层）、改动记录
const Adm = (() => {
  let D = null, tab = 'stu', scope = 'global', tplKey = 'weak', stuKey = null, draft = null, savingCfg = false, copying = false;
  let copied = null, copyAt = null;   // 刚复制好、方案列表还没读到的新方案（记着它：不会让老师再复制一份）；点复制时在看的是哪一层
  let typing = false;                 // 这一页画出来以后老师在设置里输入过（数字框打字时还没离开、草稿还没更新，也算正在改）
  let draftBase = null, draftVer = null, rebase = null, detailSeq = 0, deciding = false;   // 草稿开始编辑时的设置和版本号（两个窗口同时改时用来核对、合并）
  const NUM = { srsN: ['个', 0, 200, 5], weekly: ['个', 10, 500, 10], days: ['天', 1, 7, 1], addN: ['个', 5, 100, 5], learnW: ['周', 1, 12, 1], revW: ['周', 0, 4, 1], pass: ['%', 50, 100, 5],
    revN: ['个', 10, 500, 10], revPass: ['%', 50, 100, 5], qEvery: ['周', 4, 52, 1], qN: ['个', 10, 1000, 10], qPass: ['%', 50, 100, 5], yEvery: ['周', 12, 104, 1], yN: ['个', 10, 2000, 10], yPass: ['%', 50, 100, 5],
    exPerWord: ['句', 1, 20, 1], exPerDay: ['次', 0, 5000, 10], exPerMin: ['次', 1, 60, 1], exInflight: ['个', 1, 50, 1], exNewsDays: ['天', 1, 365, 1], exNewsWin: ['天', 7, 365, 1], exNoMatchDays: ['天', 1, 60, 1] };
  const LAB = { weekly: '每周新词数', days: '每周学几天', addOn: '再来一组', addN: '一组几个', mode: '学法', ratio: '各档比例', start: '从哪一档开始', only: '学哪几档',
    srsOn: '每天复习', srsN: '每天最多复习', learnW: '先学几周', revW: '回顾几周', untaught: '还没学的词', pass: '周测及格线', types: '周测题型', carryFail: '没及格带错词', carryPass: '及格也带错词', total: '下周学多少',
    revN: '回顾周抽多少', revMust: '错词一定抽到', revPass: '回顾周及格线', qOn: '季度测', qEvery: '季度测间隔', qN: '季度测抽多少', qPass: '季度测及格线',
    yOn: '年测', yEvery: '年测间隔', yN: '年测抽多少', yPass: '年测及格线', merge: '同周测验', dim: '答错变暗', tplOf: '方案',
    order: '本周词单顺序', instant: '答题时当场判对错', whyT: '当场显示解析的题型',
    exOn: '拓展例句', exWhoK: '知识例句用哪家', exWhoN: '时事例句用哪家', exModelA: 'Claude 模型', exModelO: 'OpenAI 模型', exPerWord: '每个词每类最多几句',
    exPerDay: '每人每天最多生成几次', exPerMin: '每人每分钟最多生成几次', exInflight: '全站同时生成几个', exNewsDays: '时事句多久换新', exNewsWin: '只用多少天内的新闻',
    exNoMatchDays: '找不到新闻后隔几天再搜', exDomains: '新闻只搜哪些网站' };
  const WHO = { anthropic: '只用 Claude', openai: '只用 OpenAI', both: '两家轮流', off: '关闭' };
  const SW = ['srsOn', 'addOn', 'carryFail', 'carryPass', 'revMust', 'qOn', 'yOn', 'dim', 'instant', 'exOn'];
  const SEGS = [['mode', 'c-mode'], ['total', 'c-total'], ['start', 'c-start'], ['untaught', 'c-untaught'], ['merge', 'c-merge'], ['order', 'c-order'], ['exWhoK', 'c-exWhoK'], ['exWhoN', 'c-exWhoN']];
  const MODE = { mix: '按比例混合', step: '逐级', only: '只学某几档' };
  const DEF_RATIO = [9, 8, 27, 22, 34];
  // 测验题型：前 5 种是 JLPT 题型（题库里的题），没写过的默认开；后 3 种简单题没写过的默认关
  const TYPES = [['yomi', '漢字読み（读音）'], ['hyoki', '表記（汉字写法）'], ['bunmyaku', '文脈規定（填空）'], ['iikae', '言い換え（近义）'], ['yoho', '用法（哪句用得对）'], ['jc', '看日语选中文'], ['cj', '看中文选日语'], ['kr', '看汉字选读音']];
  const typeOn = (v, t) => v && typeof v[t] === 'boolean' ? v[t] : ['yomi', 'hyoki', 'bunmyaku', 'iikae', 'yoho'].includes(t);
  // 当场显示解析的题型（只有 5 种 JLPT 题型有解析）：没写过的默认 漢字読み 不显示、其余显示
  const WHY = TYPES.slice(0, 5);
  const DEF_WHY = { yomi: false, hyoki: true, bunmyaku: true, iikae: true, yoho: true };
  const whyOn = (v, t) => v && typeof v[t] === 'boolean' ? v[t] : DEF_WHY[t];
  const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
  const clone = o => JSON.parse(JSON.stringify(o)), same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const TPL = () => Object.fromEntries(D.plans.map(p => [p.key, p.name]));
  const CNT = () => LV.map(l => +(D.counts[l] || 0));
  const stuOf = id => D.students.find(s => s.id === id);

  function fix() { D.global = Object.assign({ srsOn: true, srsN: 20, order: 'mix', instant: true, whyT: clone(DEF_WHY) }, D.global || {}); D.plans = D.plans || []; D.reqs = Array.isArray(D.reqs) ? D.reqs : []; D.students = D.students || []; D.logs = D.logs || []; D.counts = D.counts || {}; if (!D.plans.some(p => p.key === tplKey)) tplKey = D.plans.length ? D.plans[0].key : null; if (copied && D.plans.some(p => p.key === copied)) copied = null; }
  function start(d) { D = d; fix(); $('app').dataset.role = 'adm'; render(); }
  // 复制好以后只读方案列表（不会再复制，最多等 15 秒）。老师还在复制时那个方案、没有没保存的改动：切到新方案；
  // 已经切到别处或者正在改：只把新方案加进上面一排、提示新名字，不冲掉正在改的表单。没读到就留着「重新读取方案列表」
  const copyWarn = () => '<div class="warnbox" id="copyWarn">新方案已经复制好了，但方案列表没读到。<button type="button" class="gbtn" data-a="replans">重新读取方案列表</button></div>';
  async function afterCopy() {
    let nd;
    try { nd = await rpc('adm_load', {}, { obj: true, timeout: 15000 }); }
    catch (e) {
      if (tab === 'cfg' && !dirtyCount() && !typing) render();
      else if (tab === 'cfg' && !$('copyWarn')) { const m = document.querySelector('main'); if (m) m.insertAdjacentHTML('afterbegin', copyWarn()); }
      document.querySelectorAll('[data-a="replans"], #copyTpl').forEach(x => x.disabled = false);   // 没重画：按钮自己放开
      toast('已复制，重新读取方案列表没成功（' + e.message + '），点上面的「重新读取方案列表」'); return;
    }
    const nk = copied; copied = null;
    const here = tab === 'cfg' && layerId() === copyAt && !dirtyCount() && !typing;
    if (here) { D = nd; if ((D.plans || []).some(p => p.key === nk)) { scope = 'tpl'; tplKey = nk; } fix(); render(); }
    else {
      D.plans = nd.plans || D.plans; fix();
      const w = $('copyWarn'); if (w) w.remove();
      const cb = $('copyTpl'); if (cb) cb.disabled = false;   // 没重画：复制按钮自己放开
      const bar = document.querySelector('.seg.scopes');
      if (bar && tab === 'cfg') { const tmp = document.createElement('div'); tmp.innerHTML = scopeBar(); const nb = tmp.querySelector('.seg.scopes'); if (nb) bar.replaceWith(nb); }
    }
    const nm = TPL()[nk];
    toast(nm ? '已复制成「' + nm + '」' + (here ? '，可以点「改名」' : '，在上面一排方案里（你正在改的没有动）') : '已复制');
  }
  async function reload() { let ok = true; try { D = await rpc('adm_load', {}, { obj: true }); } catch (e) { ok = false; fail(e); } fix(); render(); return ok; }

  function render() {
    typing = false;
    const tabs = [['stu', '学生'], ['cfg', '设置'], ['ex', '拓展例句'], ['log', '改动记录']];
    let h = '<header class="top"><div class="wrap wide"><div class="row"><div class="brand"><b>单词系统 · 管理</b><span>' + esc(D.me) + '</span></div>' +
      '<div class="seg" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-atab="' + k + '" aria-pressed="' + (tab === k) + '">' + n + '</button>').join('') + '</div></div>' +
      (tab === 'cfg' ? scopeBar() : '') + '</div></header>';
    if (tab === 'stu') h += '<main class="wrap wide">' + stuHTML() + '</main>';
    else if (tab === 'log') h += '<main class="wrap wide">' + logHTML() + '</main>';
    else if (tab === 'ex') h += '<main class="wrap wide">' + exaHTML() + '</main>';
    else h += '<main class="wrap">' + (copied ? copyWarn() : '') + cfgHTML() + '</main>' + saveBar();
    $('app').innerHTML = h;
    if (tab === 'cfg') {
      buildSteps(); loadDraft();
      // 方案多、名字长时顶上一排横着滑：把选中的那个滑到看得见的地方
      const bar = document.querySelector('.seg.scopes'), on = bar && bar.querySelector('[aria-pressed="true"]');
      if (on && (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollLeft = Math.max(0, on.offsetLeft - 8);
    }
  }

  // ── 学生 ──
  function stuHTML() {
    const t = TPL();
    let h = '<div class="row"><div class="muted">词库：' + LV.map(l => l + ' ' + (D.counts[l] || 0)).join(' · ') + '</div><button class="btn main" data-a="add">＋ 加学生</button></div>';
    if (D.reqs.length) h += '<div class="note rqbar"><span><b>有 ' + D.reqs.length + ' 个换方案申请</b>在等你处理</span><button class="gbtn" data-a="reqs">查看、处理</button></div>';
    if (!D.students.length) return h + '<div class="box"><h2>还没有学生</h2><div class="muted">点右上角「加学生」，加好后把专属链接发给学生，学生用手机打开就能学。</div></div>';
    const rqs = new Set(D.reqs.map(r => r.sid));
    h += '<div class="box"><div class="list">' + D.students.map(s => {
      const w = s.week, lt = s.last_test;
      const wk = w ? '第 ' + num(w.no) + ' 周' + (w.kind === 'R' ? '（回顾）' : '') + (w.cur ? (w.kind === 'L' ? (num(w.n) ? ' · 本周练过 ' + num(w.done) + '/' + num(w.n) : ' · <span class="chip warn">这周没有词</span>') : '') : '（已到期，学生还没打开新的一周）') : md(s.start) + ' 开始';
      return '<div class="it clickable" data-stu="' + esc(s.id) + '" role="button" tabindex="0"><div class="main"><div class="nm">' + esc(s.name) + (s.grp ? ' <span class="chip">' + esc(s.grp) + '</span>' : '') + (s.streak ? ' <span class="chip ok">连续 ' + num(s.streak) + ' 天</span>' : '') + (s.active ? '' : ' <span class="chip bad">已停用</span>') + (rqs.has(s.id) ? ' <span class="chip warn">申请中</span>' : '') + '</div>' +
        '<div class="sub">' + esc(t[s.plan] || s.plan) + (Object.keys(s.ov || {}).length ? ' · 单独改了 ' + Object.keys(s.ov).length + ' 项' : '') + (s.next_cut != null ? ' · 下周新词 ' + num(s.next_cut) + ' 个' : '') + '</div></div>' +
        '<div class="sub side"><div>' + wk + ' · 累计学过 ' + num(s.learned) + ' · 全亮 ' + num(s.correct) + '</div>' +
        '<div>' + (lt ? '最近测验 ' + num(lt.score) + '/' + num(lt.total) + (lt.passed ? ' 及格' : lt.manual ? ' 放行' : ' 没及格') : '还没考过') + ' · ' + (s.last_seen ? '最后打开 ' + stamp(s.last_seen) : '还没打开过') + '</div></div></div>';
    }).join('') + '</div></div>';
    return h;
  }
  function addModal() {
    const today = new Date(), p = n => String(n).padStart(2, '0');
    const ds = today.getFullYear() + '-' + p(today.getMonth() + 1) + '-' + p(today.getDate());
    const m = modal('<h2>加学生</h2><form class="form" id="addf"><label>名字（学生和你都看得到）<input id="an" maxlength="30" required></label>' +
      '<label>方案（各档怎么学；其他设置都跟所有学生的默认）<select id="ap">' + D.plans.map(x => '<option value="' + esc(x.key) + '"' + (x.key === 'std' ? ' selected' : '') + '>' + esc(x.name) + ' — ' + esc(lvText(Object.assign({}, D.global, x.ov), { short: true })) + '</option>').join('') + '</select></label>' +
      '<label>哪天开始（会算到那一周的星期一）<input id="ad" type="date" value="' + ds + '"></label>' +
      '<div class="muted">开课日之前学生打开链接只会看到「还没开始」；第一周到开课那天才按当时的设置发词。</div>' +
      '<div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main" id="asub">加好，拿链接</button></div></form>');
    m.querySelector('#addf').addEventListener('submit', async e => {
      e.preventDefault();
      const b = m.querySelector('#asub'); busy(b, true);
      try {
        const r = await rpc('adm_student_add', { nm: m.querySelector('#an').value, pl: m.querySelector('#ap').value, sd: m.querySelector('#ad').value || null }, { obj: true });
        if (!r.key) throw new Error('没有拿到链接，请在学生详情里点「专属链接」');
        m.close(); await reload(); linkModal(r.id, r.key, true);
      } catch (err) { fail(err); busy(b, false); }
    });
    setTimeout(() => m.querySelector('#an').focus(), 50);
  }
  function linkModal(sid, key, isNew) {
    const s = stuOf(sid), url = siteBase() + '?k=' + key;
    const m = modal('<h2>' + esc(s ? s.name : '') + ' 的专属链接</h2><div class="muted">' + (isNew ? '学生已加好。' : '') + '把这个链接发给学生（微信、LINE 都可以），学生点开就能学。不要发到群里，谁拿到链接谁就能用。</div>' +
      '<div class="copyrow"><input readonly value="' + esc(url) + '" id="lk"><button class="gbtn" id="lkc">复制</button></div><button class="btn" data-close>好的</button>');
    m.querySelector('#lkc').addEventListener('click', () => copyText(url, m.querySelector('#lk')));
  }
  // 学生详情：同一时间只开一个（连点、弱网时不会叠出好几层）
  async function detailModal(sid) {
    const s = stuOf(sid); if (!s) return;
    const seq = ++detailSeq;
    document.querySelectorAll('.modal.det').forEach(x => x.close ? x.close() : x.remove());
    let det; try { det = await rpc('adm_student_detail', { sid }, { obj: true }); } catch (e) { if (seq === detailSeq) fail(e); return; }
    if (seq !== detailSeq || !stuOf(sid)) return;
    const t = TPL(), KN = { week: '周测', review: '回顾测', quarter: '季度测', year: '年测' };
    const weeks = Array.isArray(det.weeks) ? det.weeks : [], wrong = Array.isArray(det.wrong) ? det.wrong : [], cur = det.cur;
    const extTxt = cur ? '延长第 ' + num(cur.no) + ' 周 1 周：结束日 ' + md(cur.end) + ' → ' + md(addDays(cur.end, 7)) + '（马上生效）' : (s.active ? '还没开始，不用延长' : '已停用');
    const m = modal('<div class="row"><h2>' + esc(s.name) + ' <small class="muted">学生编号 ' + esc(String(sid).slice(0, 8)) + '</small></h2><button class="gbtn" data-close>关闭</button></div>' +
      '<div class="muted">' + esc(t[s.plan] || s.plan) + ' · ' + md(s.start) + ' 开始' + (s.memo ? ' · ' + esc(s.memo) : '') + '</div>' +
      (cur ? '<div class="note">现在第 <b>' + num(cur.no) + '</b> 周' + (cur.kind === 'R' ? '（回顾周）' : '') + '：' + md(cur.start) + '～' + md(cur.end) + (cur.kind === 'L' ? ' · 本周练过 <b>' + num(cur.done) + ' / ' + num(cur.n) + '</b>' : '') + '</div>' : '') +
      '<div class="row" style="justify-content:flex-start"><button class="gbtn" data-d="link">专属链接</button><button class="gbtn" data-d="cfg">改这个学生的设置</button><button class="gbtn" data-d="edit">改名字/备注/停用</button></div>' +
      '<div class="lab">只对这个学生、马上生效</div>' +
      '<div class="form"><div class="row"><span>' + esc(extTxt) + '</span><button class="gbtn" data-d="extend"' + (cur ? '' : ' disabled') + '>延长 1 周</button></div>' +
      (cur && cur.kind === 'L' && !num(cur.nnew) && !cur.tested ? '<div class="row"><span>' + (cur.check ? '<b>请核对：</b>旧记录分不清有没有给这个学生设过「下周暂停/减量」，这一周先没自动发词。确认要学的话，补发几个：' : '这一周没有新词（还没开考）。现在补发几个：') + '</span><span class="copyrow"><input id="refv" type="number" min="1" max="500" value="' + num(cur.weekly, 100) + '" style="width:80px" aria-label="补发几个新词"><button class="gbtn" data-d="refill">补发新词</button></span></div>' : '') +
      '<div class="row"><span>设置下周新词数（只改下一个学新词周，遇回顾周顺延；上周的错词照常全部带上；0 ＝ 暂停新词）</span><span class="copyrow"><input id="cutv" type="number" min="0" max="500" value="' + num(s.next_cut ?? 50, 50) + '" style="width:80px" aria-label="下周新词数"><button class="gbtn" data-d="cut">设好</button></span></div>' +
      '<div class="row"><span>把这一周最近交的那场记为及格（原分数保留）；以前的某一场在下面表里点「记为及格」</span><button class="gbtn" data-d="pass">手动放行</button></div></div>' +
      '<div class="lab">每一周</div><div class="scroll"><table class="t"><tr><th>周</th><th>开始</th><th>词数</th><th>练过</th><th>测验</th></tr>' +
      (weeks.length ? weeks.map(w => '<tr><td>第 ' + num(w.no) + ' 周' + (w.kind === 'R' ? '（回顾）' : '') + (w.extended ? '（延长）' : '') + '</td><td>' + md(w.start) + '</td><td>' + (w.kind === 'L' ? '共 ' + num(w.n) + ((w.carry || w.extra) ? '（' + [w.carry ? '错词 ' + num(w.carry) : '', w.extra ? '追加 ' + num(w.extra) : ''].filter(Boolean).join('、') + '）' : '') : (w.carry ? '错词 ' + num(w.carry) : '—')) + '</td><td>' + (w.kind === 'L' ? num(w.done) : '—') + '</td><td>' +
        ((w.tests || []).length ? w.tests.map(x => (KN[x.kind] || '') + ' ' + (x.done ? num(x.score) + '/' + num(x.total) + ' ' + (x.passed ? '<span class="chip ok">及格</span>' : x.manual ? '<span class="chip">放行</span>' : '<span class="chip bad">没及格</span> <button class="link" data-tpass="' + esc(x.id) + '">记为及格</button>') : '考到一半')).join('<br>') : '没考') + '</td></tr>').join('') : '<tr><td colspan="5" class="muted">' + (s.active ? '还没有开始的周（开课日之前不生成）' : '没有记录') + '</td></tr>') +
      '</table></div>' +
      '<div class="lab">错过的词 ' + wrong.length + ' 个' + (wrong.length > 60 ? '，下面显示错得最多的 60 个' : '') + '</div>' +
      (wrong.length ? '<div class="list">' + wrong.slice(0, 60).map(x => '<div class="it"><span><span class="nm" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r) + '</span></span><span class="sub">' + esc(x.m) + ' · 错 ' + num(x.times) + ' 次' + (x.st === 'correct' ? ' · 后来对了' : '') + (x.off ? ' · 已停用' : '') + '</span></div>').join('') + '</div>' : '<div class="muted">还没有。</div>'));
    m.classList.add('det');
    let acting = false;
    m.addEventListener('click', async e => {
      const tp = e.target.closest('[data-tpass]');
      if (tp) { if (tp.disabled || acting) return; acting = true; tp.disabled = true; try { await rpc('adm_test_pass', { tid: tp.dataset.tpass }); toast('已记为及格（原分数保留）'); m.close(); await reload(); detailModal(sid); } catch (er) { fail(er); tp.disabled = false; } acting = false; return; }
      const b = e.target.closest('[data-d]'); if (!b || b.disabled || acting) return;
      const d = b.dataset.d;
      if (d === 'link') { acting = true; try { const k = await rpc('adm_student_key', { sid, fresh: false }, { str: true }); m.close(); linkModal(sid, k); } catch (er) { fail(er); } acting = false; return; }
      if (d === 'cfg') { m.close(); tab = 'cfg'; scope = 'stu'; stuKey = sid; draft = null; render(); return; }
      if (d === 'edit') { m.close(); editModal(sid); return; }
      let val = null, extra = {};
      if (d === 'cut') { const raw = m.querySelector('#cutv').value.trim(); val = Number(raw); if (raw === '' || !Number.isInteger(val) || val < 0 || val > 500) { toast('请填 0～500 之间的整数'); return; } }
      if (d === 'extend') { if (!cur) return; extra = { wk: cur.id, ext: num(cur.extended) }; }
      if (d === 'refill') { if (!cur) return; const raw = m.querySelector('#refv').value.trim(); val = Number(raw); if (raw === '' || !Number.isInteger(val) || val < 1 || val > 500) { toast('请填 1～500 之间的整数'); return; } extra = { wk: cur.id }; }
      acting = true; busy(b, true);
      try {
        const r = await rpc('adm_student_action', Object.assign({ sid, act: d, val }, extra));
        toast({ extend: '已延长：第 ' + num(cur && cur.no) + ' 周到 ' + md(r && r.end ? r.end : '') + ' 结束', cut: val === 0 ? '已设好：下周暂停新词（上周的错词照常带上）' : '已设好：下周新词 ' + val + ' 个（上周的错词照常带上）', pass: '已放行', refill: '已补发 ' + num(r && r.added) + ' 个新词' }[d]);
        m.close(); await reload(); detailModal(sid);
      } catch (er) {
        fail(er); acting = false; busy(b, false);
        if ((d === 'extend' || d === 'refill') && /已经延长过|换到第|旧了|已经有新词|已经开考/.test(er.message)) { m.close(); await reload(); detailModal(sid); }
      }
    });
  }
  function editModal(sid) {
    const s = stuOf(sid);
    const m = modal('<h2>改学生信息</h2><form class="form" id="edf"><label>名字<input id="en" maxlength="30" value="' + esc(s.name) + '" required></label>' +
      '<label>班级（同一个班的同学互相看得到打卡天数和本周进度；不分班就空着）<input id="eg" maxlength="20" value="' + esc(s.grp || '') + '" list="grps"><datalist id="grps">' + [...new Set(D.students.map(x => x.grp).filter(Boolean))].map(g => '<option value="' + esc(g) + '">').join('') + '</datalist></label>' +
      '<label>备注（只有管理端看得到）<textarea id="em" rows="3" maxlength="500">' + esc(s.memo) + '</textarea></label>' +
      '<label><span><input type="checkbox" id="ea"' + (s.active ? ' checked' : '') + '> 在用（取消勾选 ＝ 停用，学生链接打不开，记录都保留）</span></label>' +
      '<div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main" id="esub">保存</button></div>' +
      '<div class="muted">怀疑链接被别人拿到了：<button type="button" class="link" id="fresh">换一条新链接</button>（旧链接马上失效）<span id="freshFix" hidden> · 刚才没换成功（或不知道换没换）：<button type="button" class="link" id="nowKey">查看现在有效的链接</button></span></div>' +
      '<div class="muted">不再需要这个学生（比如测试用的）：<button type="button" class="link danger" id="del">删除这个学生</button></div></form>');
    m.querySelector('#del').addEventListener('click', () => deleteModal(sid));
    m.querySelector('#edf').addEventListener('submit', async e => {
      e.preventDefault(); const b = m.querySelector('#esub'); busy(b, true);
      try { await rpc('adm_student_edit', { sid, nm: m.querySelector('#en').value, mm: m.querySelector('#em').value, act: m.querySelector('#ea').checked, g: m.querySelector('#eg').value }); m.close(); toast('已保存'); await reload(); }
      catch (er) { fail(er); busy(b, false); }
    });
    m.querySelector('#fresh').addEventListener('click', async e => {
      const fb = e.target;
      if (fb.dataset.busy) return;
      if (!fb.dataset.sure) { fb.dataset.sure = '1'; fb.textContent = '确定换？再点一次'; return; }
      fb.dataset.busy = '1'; fb.disabled = true; fb.textContent = '正在换……';
      try { const k = await rpc('adm_student_key', { sid, fresh: true }, { str: true }); m.close(); await reload(); linkModal(sid, k); toast('已换新链接，旧的不能用了'); }
      catch (er) { fail(er); delete fb.dataset.busy; delete fb.dataset.sure; fb.disabled = false; fb.textContent = '换一条新链接'; m.querySelector('#freshFix').hidden = false; }
    });
    m.querySelector('#nowKey').addEventListener('click', async e => {
      if (e.target.disabled) return; e.target.disabled = true;
      try { const k = await rpc('adm_student_key', { sid, fresh: false }, { str: true }); m.close(); linkModal(sid, k); } catch (er) { fail(er); e.target.disabled = false; }
    });
  }

  // 删除学生：输入名字确认，删了不能恢复
  function deleteModal(sid) {
    const s = stuOf(sid); if (!s) return;
    const m = modal('<h2>删除学生「' + esc(s.name) + '」</h2>' +
      '<div class="warnbox">删除后，这个学生的<b>每周词单、学习进度、测验成绩、打卡记录和专属链接</b>都会一起删掉，<b>不能恢复</b>。<br>只是暂时不学的话，请用「停用」（记录都保留）。</div>' +
      '<form class="form" id="delf"><label>确认删除，请输入这个学生的名字「' + esc(s.name) + '」<input id="dn" maxlength="30" autocomplete="off"></label>' +
      '<div class="row"><button type="button" class="btn" data-close>不删了</button><button class="btn no" id="dsub" disabled>永久删除</button></div></form>');
    const inp = m.querySelector('#dn'), b = m.querySelector('#dsub');
    inp.addEventListener('input', () => { b.disabled = inp.value.trim() !== s.name; });
    m.querySelector('#delf').addEventListener('submit', async e => {
      e.preventDefault(); if (b.disabled || b.dataset.busy) return;
      b.dataset.busy = '1'; busy(b, true); b.textContent = '正在删除……';
      try {
        await rpc('adm_student_delete', { sid, nm: inp.value.trim() });
        document.querySelectorAll('.modal').forEach(x => x.remove());
        if (stuKey === sid) { stuKey = null; draft = null; }
        toast('已删除 ' + s.name); await reload();
      } catch (er) { fail(er); delete b.dataset.busy; b.textContent = '永久删除'; b.disabled = inp.value.trim() !== s.name; }
    });
    setTimeout(() => inp.focus(), 50);
  }

  // ── 换方案的申请：同意 / 不同意 ──
  const reqOf = sid => D.reqs.find(r => r.sid === sid);
  function noteModal(r) {
    return new Promise(res => {
      let done = false;
      const m = modal('<h2>不同意 ' + esc(r.name) + ' 换成「' + esc(r.tname) + '」</h2><form class="form" id="ntf"><label>写一句给学生的话（可以不写，最多 100 字）<textarea id="ntx" rows="3" maxlength="100"></textarea></label>' +
        '<div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main">不同意</button></div></form>', { onClose: () => { if (!done) { done = true; res(null); } } });
      m.querySelector('#ntf').addEventListener('submit', e => { e.preventDefault(); if (done) return; done = true; res(m.querySelector('#ntx').value.trim()); m.close(); });
    });
  }
  // 处理一个申请；处理了返回 true
  async function decide(rid, ok) {
    const r = D.reqs.find(x => x.id === rid);
    if (!r || deciding) return false;
    if (tab === 'cfg' && guard()) return false;
    let note = '';
    if (ok) {
      const v = await ask('同意 ' + esc(r.name) + ' 换成「' + esc(r.tname) + '」？', '已经生成的周词单照旧，从下一张新生成的周词单起按「' + esc(r.tname) + '」；这个学生单独改过的设置不动。', [['yes', '同意', true], ['no', '先不处理']]);
      if (v !== 'yes') return false;
    } else {
      note = await noteModal(r);
      if (note === null) return false;
    }
    deciding = true;
    try { await rpc('adm_plan_decide', { rid, ok, note }, { obj: true }); toast(ok ? '已同意：' + r.name + ' 从下一张新的周词单起用「' + r.tname + '」' : '已回复 ' + r.name + '：没有同意'); }
    catch (e) { fail(e); deciding = false; await reload(); return false; }
    deciding = false; await reload(); return true;
  }
  function reqsModal() {
    if (!D.reqs.length) { toast('现在没有换方案的申请'); return; }
    const m = modal('<div class="row"><h2>换方案的申请 <small class="muted">' + D.reqs.length + ' 个</small></h2><button class="gbtn" data-close>关闭</button></div>' +
      '<div class="muted">同意后：已经生成的周词单照旧，从下一张新生成的周词单起换；学生单独改过的设置不动。</div><div class="list">' +
      D.reqs.map(r => '<div class="it"><div class="main"><div class="nm">' + esc(r.name) + '</div><div class="sub">「' + esc(r.cname || r.fname || '') + '」→「' + esc(r.tname) + '」 · ' + stamp(r.at) + '</div>' +
        (r.reason ? '<div class="sub">理由：' + esc(r.reason) + '</div>' : '<div class="sub">没写理由</div>') + '</div>' +
        '<div class="side"><button type="button" class="gbtn" data-rq="' + esc(r.id) + '" data-ok="1">同意</button> <button type="button" class="gbtn" data-rq="' + esc(r.id) + '" data-ok="0">不同意</button></div></div>').join('') + '</div>');
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-rq]'); if (!b || b.disabled) return;
      m.querySelectorAll('[data-rq]').forEach(x => x.disabled = true); m.close();
      await decide(b.dataset.rq, b.dataset.ok === '1');
      if (D.reqs.length && tab === 'stu') reqsModal();
    });
  }

  // ── 改动记录 ──
  function logHTML() {
    if (!D.logs.length) return '<div class="box"><h2>还没有改动记录</h2></div>';
    return '<div class="box"><h2>改动记录 <small>最近 200 条</small></h2><div class="log">' + D.logs.map(x => {
      const its = Array.isArray(x.items) ? x.items : [];
      const tail = x.eff ? '（' + md(x.eff) + '起生效）' : '';
      if (!its.length) return '<div><time>' + stamp(x.at) + '</time><span>' + esc(x.txt) + tail + '</span></div>';
      return '<div><time>' + stamp(x.at) + '</time><details' + (its.length === 1 ? ' open' : '') + '><summary>' + esc(x.txt) + tail + '</summary><ul>' + its.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></details></div>';
    }).join('') + '</div></div>';
  }

  // ── 拓展例句页：本期两家用量和预算、在途预留、学生报错、隐藏的句子、试生成、价格、最近调用 ──
  let EXA = null, exaBusy = false;
  const exT = { q: '', cands: [], wid: null, w: '', kind: 'know', prov: 'anthropic', res: null, busy: false, rid: null, ridFor: '' }, exR = { off: 0, list: null };
  const STEPN = { know: '知识', search: '搜证', card: '制卡', check: '核对' };
  const CALLN = { ok: '成功', waste: '废稿', unknown: '待对账（结果不明，先按预留额记）', error: '出错（记零）', pending: '进行中', pending_settle: '待对账（没记上，先按预留额记）' };
  // 试生成「结果不明」的判断（提示和保留请求编号都用这一个）：断网、超时、服务器出错、还在生成，或者明细里有待对账的调用
  const exUnsure = r => !!r && (!!r.unsure || r.state === 'running' || r.state === 'unknown' || (r.calls || []).some(c => c.status === 'unknown' || c.status === 'pending' || c.status === 'pending_settle'));
  const exSig = () => exT.wid + '|' + exT.kind + '|' + exT.prov;
  const PSTATE = { unset: '没填日期，不能生成', notstart: '本期还没开始', expired: '本期已结束', zero: '本期用完了', paused: '已暂停' };
  const money = v => '$' + num(v).toFixed(num(v) < 1 && num(v) > 0 ? 4 : 2);
  const PN = p => p === 'openai' ? 'OpenAI' : 'Claude';
  async function exaLoad() {
    if (exaBusy) return; exaBusy = true;
    try { EXA = await rpc('adm_ex', { act: 'load', a: {} }, { obj: true }); exR.off = 0; exR.list = null; } catch (e) { fail(e); EXA = EXA || { err: e.message }; }
    exaBusy = false; if (tab === 'ex') render();
  }
  function exaSent(x) {
    return '<div class="xs"><div class="jp" lang="ja">' + rb(x.jp) + '</div><div class="zh">' + esc(x.zh) + '</div><div class="xtag">' + (x.kind === 'news' ? '时事' +
      (x.url && /^https:\/\//.test(x.url) ? ' · <a href="' + esc(x.url) + '" target="_blank" rel="noreferrer noopener">' + esc(x.site || '来源') + (x.date ? ' · ' + esc(md(x.date)) : '') + '</a>' : '') + (x.title ? ' · ' + esc(x.title) : '')
      : '知识' + (x.sub ? ' · ' + esc(x.sub) : '')) + '</div></div>';
  }
  function exaHTML() {
    if (!EXA) { setTimeout(exaLoad, 0); return '<div class="box">正在读取……</div>'; }
    if (EXA.err) return '<div class="box"><h2>没读到</h2><div class="muted">' + esc(EXA.err) + '</div><button class="gbtn" data-xa="reload">重新读取</button></div>';
    const P = EXA.periods || [], C = EXA.counts || {}, K = EXA.calls || {};
    let h = '<div class="note">金额是本站按「用量×价格」的估算，<b>实际以两家的账单页为准</b>；结果不明的调用按预留额记（显示「待对账」的，之后补上实际用量）。两家账单页请关掉自动充值。</div>';
    const KW = EXA.who || {}, kchip = (n, k) => n + '：' + (KW[k] === 'off' ? '<span class="chip bad">关闭</span>' : '<span class="chip ok">' + esc(WHO[KW[k]] || KW[k] || '') + '</span>');
    h += '<div class="box"><b>学生生成：' + (EXA.on ? '<span class="chip ok">开着</span>' : '<span class="chip bad">关着</span>') + '</b> · ' + kchip('知识例句', 'know') + ' · ' + kchip('时事例句', 'news') +
      ' <div class="muted small">' + (EXA.on ? '' : '学生点了只会看到「暂时关掉了」；') + '关着的那一类学生页不显示按钮；下面「试生成」不受这些开关限制。在「设置 → 所有学生的默认 → 拓展例句」里改。</div></div>';
    h += '<div class="exu">' + P.map(p => '<section class="box"><h2>' + PN(p.provider) + (p.state !== 'ok' ? ' <span class="chip bad">' + esc(PSTATE[p.state] || p.state) + '</span>' : '') + '</h2>' +
      '<div class="stats"><div class="stat"><b>' + money(p.spent) + '</b><span>本期已花（估算）</span></div><div class="stat"><b>' + money(p.amount) + '</b><span>本期金额</span></div><div class="stat"><b>' + money(p.left) + '</b><span>还能用</span></div></div>' +
      '<div class="muted small">' + (p.start ? '本期 ' + esc(md(p.start)) + '～' + esc(md(p.end)) : '本期还没填日期') + ' · 正在生成的预留 ' + money(p.pending) + '</div>' +
      (p.paused ? '<div class="warnbox">暂停原因：' + esc(p.why) + ' <button type="button" class="gbtn" data-xa="resume" data-p="' + esc(p.provider) + '">恢复</button></div>' : '') +
      '<form class="form xbud" data-p="' + esc(p.provider) + '"><label>本期金额（美元）<input name="amount" type="number" min="0" max="10000" step="0.01" value="' + num(p.amount) + '"></label>' +
      '<div class="row"><label>开始日期<input name="start" type="date" value="' + esc(p.start || '') + '"></label><label>结束日期<input name="end" type="date" value="' + esc(p.end || '') + '"></label></div>' +
      '<div class="muted small">金额填这一家账上<b>现在实际能用的余额</b>（留一点余量）；结束日期填余额或赠额的到期日。开始、结束都要填，不填＝这一家不能生成；过了结束日就停，请再填下一期。</div><button class="btn">保存 ' + PN(p.provider) + ' 的预算</button></form></section>').join('') + '</div>';
    h += '<section class="box"><h2>句子和调用</h2><div class="stats"><div class="stat"><b>' + num(C.know) + '</b><span>知识例句</span></div><div class="stat"><b>' + num(C.news) + '</b><span>时事例句（在期）</span></div>' +
      '<div class="stat"><b>' + num(C.hidden) + '</b><span>隐藏的</span></div></div><div class="muted small">过期的时事句 ' + num(C.old) + ' · 试生成 ' + num(C.test) + ' · 本月调用 ' + num(K.n) + ' 次（废稿 ' + num(K.waste) + '、结果不明 ' + num(K.unknown) + '、其中待对账 ' + num(K.swept) + '、正在进行 ' + num(K.pending) + '）</div></section>';
    const R = exR.list || EXA.reports || [], NR = num(EXA.nreports);
    const pager = NR > 20 ? '<div class="row" style="justify-content:flex-start;gap:8px"><button type="button" class="gbtn" data-xa="rpage" data-off="' + Math.max(0, exR.off - 20) + '"' + (exR.off > 0 ? '' : ' disabled') + '>上一页</button>' +
      '<span class="muted small">第 ' + (exR.off + 1) + '～' + Math.min(NR, exR.off + 20) + ' 条（共 ' + NR + ' 条）</span><button type="button" class="gbtn" data-xa="rpage" data-off="' + (exR.off + 20) + '"' + (exR.off + 20 < NR ? '' : ' disabled') + '>下一页</button></div>' : '';
    h += '<section class="box exl"><h2>学生报错 <small>' + NR + ' 条没处理</small></h2>' + pager + (R.length ? R.map(r => '<div class="it">' + exaSent(r.sent) +
      '<div class="muted small">词「' + esc(r.sent.w) + '」 · 理由：' + esc(r.reason || '（没写）') + ' · ' + esc(r.who) + ' · ' + stamp(r.at) + ' · 这句一共被报 ' + num(r.sent.reports) + ' 次</div>' +
      '<div class="row" style="justify-content:flex-start;gap:8px"><button type="button" class="gbtn" data-xa="hide" data-id="' + esc(r.sent.id) + '">隐藏这句</button><button type="button" class="gbtn" data-xa="ok" data-id="' + esc(r.id) + '">没问题</button></div></div>').join('') : '<div class="muted">没有。</div>') + pager + '</section>';
    const HD = EXA.hidden || [];
    if (HD.length) h += '<section class="box exl"><h2>隐藏的句子 <small>最近 30 条</small></h2>' + HD.map(x => '<div class="it">' + exaSent(x) + '<div class="row" style="justify-content:flex-start"><span class="muted small">词「' + esc(x.w) + '」</span><button type="button" class="gbtn" data-xa="show" data-id="' + esc(x.id) + '">恢复</button></div></div>').join('') + '</section>';
    // 试生成
    const sg = (id, cur, opts) => '<div class="seg" role="group" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + n + '</button>').join('') + '</div>';
    const held = !!exT.rid && exT.ridFor === exSig();   // 上一次结果不明：按钮只按原编号查询
    h += '<section class="box" id="xtry"><h2>试生成 <small>真实调用（算进预算，标记为测试，不给学生看）：知识一次通常一笔；时事一次通常有搜证、制卡、核对三笔</small></h2>' +
      '<div class="row" style="justify-content:flex-start;gap:8px;flex-wrap:wrap"><button type="button" class="gbtn" data-xa="ping"' + (exT.pinging ? ' disabled' : '') + '>检查云函数</button>' +
      (exT.ping ? '<span class="chip ' + (exT.ping.ok ? 'ok' : 'bad') + '" style="white-space:normal">' + esc(exT.ping.text) + '</span>' : '<span class="muted small">验收第一步：云函数能启动、数据库连得上、两把钥匙填了（不调用两家、不花钱）</span>') + '</div>' +
      '<div class="muted small">上线验收：只验收准备启用的那几条（哪家＋哪一类）。每条至少一次「生成成功」并对上账本；时事是「搜过但暂无」时这条分支算通过，但要换个词再试，直到做出一张时事卡。</div>' +
      '<div class="row" style="justify-content:flex-start;gap:8px"><input id="xtq" placeholder="词的写法或编号，例如 月" maxlength="20" value="' + esc(exT.q) + '" style="max-width:220px"><button type="button" class="gbtn" data-xa="find">找词</button></div>' +
      (exT.cands.length ? '<div class="checks">' + exT.cands.map(c => '<button type="button" class="ck" data-xa="pick" data-id="' + esc(c.id) + '" data-w="' + esc(c.w) + '" aria-pressed="' + (exT.wid === c.id) + '">' + esc(c.lvl + ' ' + c.w + '（' + c.r + '）' + c.m) + '</button>').join('') + '</div>' : '') +
      '<div class="row" style="justify-content:flex-start;gap:8px;flex-wrap:wrap">' + sg('xtk', exT.kind, [['know', '知识例句'], ['news', '时事例句']]) + sg('xtp', exT.prov, [['anthropic', 'Claude'], ['openai', 'OpenAI']]) +
      '<button type="button" class="btn main" data-xa="try"' + (exT.wid && !exT.busy ? '' : ' disabled') + '>' + (exT.busy ? (exT.mode === 'query' ? '正在查询…' : '正在生成…') : (held ? '查询上次结果（不再调用）' : '试生成' + (exT.w ? '「' + esc(exT.w) + '」' : ''))) + '</button>' +
      (held && !exT.busy ? '<button type="button" class="gbtn" data-xa="regen">重新生成（会再花一次钱）</button>' : '') + '</div>';
    if (exT.res) {
      const r = exT.res, cs = r.calls || [];
      const authq = cs.some(c => c.status === 'error' && /钥匙|权限|额度用完|消费上限|拒绝了请求|没有填/.test(c.err || ''));
      const unsure = exUnsure(r);
      const verdict = r.state === 'unknown' ? ['bad', '未找到上次请求：目前未找到该编号，可以按原编号再查；点「重新生成」会提交新请求，可能另行计费'] : r.state === 'done' ? ['ok', '生成成功'] : r.state === 'none' ? ['ok', '搜过但暂无（这次搜过了，没有合适的新闻，不算出错）'] : authq ? ['bad', '鉴权或额度失败（这一家已暂停，看上面的暂停原因）']
        : !cs.length && r.state ? ['bad', '没有调用：' + (r.msg || r.state)] : ['bad', '没生成好' + (r.msg ? '：' + r.msg : '')];
      h += '<div class="row" style="justify-content:flex-start;gap:8px;margin:8px 0"><b>结论：</b><span class="chip ' + verdict[0] + '" style="white-space:normal">' + esc(verdict[1]) + '</span></div>' +
        (unsure ? '<div class="warnbox">这次有结果不明或「待对账」的调用：先按预留额记着，可能已经花了钱。按钮已经换成「查询上次结果」，只按原来的请求编号查（不再调用两家）；确认要再试一次才点「重新生成」。过几分钟再到两家账单页对一下。</div>' : '') +
        (r.sent ? exaSent(r.sent) : '') +
        (cs.length ? '<div class="extw"><table class="extbl"><tr><th>哪家</th><th>模型</th><th>步骤</th><th>结果</th><th>输入</th><th>输出</th><th>搜索</th><th>花费</th></tr>' +
          cs.map(c => '<tr><td>' + PN(c.provider) + '</td><td>' + esc(c.model) + '</td><td>' + esc(STEPN[c.step] || c.step) + '</td><td>' + esc(CALLN[c.status] || c.status) + (c.err ? '（' + esc(c.err) + '）' : '') + '</td><td>' + num(c.in) + '</td><td>' + num(c.out) + '</td><td>' + num(c.searches) + '</td><td>' + money(c.cost) + '</td></tr>').join('') +
          '</table></div><div class="muted small">这次一共 ' + money(cs.reduce((a, c) => a + num(c.cost), 0)) + '</div>' : '');
    }
    h += '</section>';
    // 价格
    const PR = EXA.prices || [];
    h += '<section class="box"><h2>价格 <small>每百万 token、每千次搜索（美元）；按「哪家＋模型＋生效日期」，用当天以前最新的一行</small></h2><div class="extw"><table class="extbl"><tr><th>哪家</th><th>模型</th><th>生效</th><th>输入</th><th>缓存读</th><th>缓存写</th><th>输出</th><th>搜索</th></tr>' +
      PR.map(x => '<tr><td>' + PN(x.provider) + '</td><td>' + esc(x.model) + '</td><td>' + esc(x.eff_date) + '</td><td>' + num(x.in_per_m) + '</td><td>' + num(x.cached_per_m) + '</td><td>' + num(x.cwrite_per_m) + '</td><td>' + num(x.out_per_m) + '</td><td>' + num(x.search_per_k) + '</td></tr>').join('') + '</table></div>' +
      '<div class="muted small">正在生成的调用用的那一版价格不能改；要改价就填一个新的生效日期。输入、输出要大于 0。</div>' +
      '<form class="form" id="xpf"><div class="row" style="flex-wrap:wrap;gap:8px"><label>哪家<select name="provider"><option value="openai">OpenAI</option><option value="anthropic">Claude</option></select></label><label>模型<input name="model" maxlength="64" required></label><label>生效日期<input name="eff" type="date"></label></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><label>输入<input name="in" type="number" step="0.01" min="0" required></label><label>缓存读<input name="cached" type="number" step="0.01" min="0" required></label><label>缓存写<input name="cwrite" type="number" step="0.01" min="0" required></label><label>输出<input name="out" type="number" step="0.01" min="0" required></label><label>每千次搜索<input name="search" type="number" step="0.01" min="0" required></label></div><button class="btn">保存这一行价格</button></form></section>';
    const RC = EXA.recent || [];
    if (RC.length) h += '<section class="box"><h2>最近 20 次调用</h2><div class="extw"><table class="extbl"><tr><th>时间</th><th>哪家</th><th>步骤</th><th>结果</th><th>花费</th><th>预留</th><th></th></tr>' +
      RC.map(c => '<tr><td>' + stamp(c.at) + '</td><td>' + PN(c.provider) + '</td><td>' + esc(STEPN[c.step] || c.step) + '</td><td>' + esc(c.swept ? '待对账（先按预留额记）' : CALLN[c.status] || c.status) + '</td><td>' + money(c.cost) + '</td><td>' + money(c.reserved) + '</td><td>' + (c.test ? '测试' : '') + (c.err ? ' ' + esc(c.err) : '') + '</td></tr>').join('') + '</table></div></section>';
    return h;
  }
  async function exaAct(a) {
    const act = a.dataset.xa;
    if (act === 'reload') { EXA = null; render(); return; }
    if (act === 'find') { exT.q = ($('xtq') || {}).value || ''; try { exT.cands = await rpc('adm_ex', { act: 'find', a: { q: exT.q.trim() } }); if (!exT.cands.length) toast('没找到这个词'); } catch (e) { fail(e); } render(); return; }
    if (act === 'pick') { exT.wid = a.dataset.id; exT.w = a.dataset.w; exT.res = null; render(); return; }
    if (act === 'rpage') { try { const r = await rpc('adm_ex', { act: 'reports', a: { offset: num(a.dataset.off) } }, { obj: true }); exR.off = num(a.dataset.off); exR.list = r.reports || []; EXA.nreports = r.nreports; } catch (e) { fail(e); } render(); return; }
    if (act === 'ping') {
      exT.pinging = true; render();
      try {
        const r = await exCall({ act: 'ping', k: KEY, rid: uuid4() }, 20000);
        // 必验：云函数启动、Claude SDK 加载、数据库连通；钥匙两家分别显示，只要求准备启用的那家（看「知识例句／时事例句用哪家」）填了
        const ks = r.keys || {}, need = Array.isArray(r.need) ? r.need : [];
        const keyText = pv => PN(pv) + ' 钥匙：' + (ks[pv] ? '已填' : '没填') + (need.includes(pv) ? (ks[pv] ? '' : '（要用，必须填）') : '（没启用，可以不填）');
        const ok = r.state === 'ok' && !!r.sdk && !!r.db && need.every(pv => ks[pv]);
        exT.ping = { ok, text: '云函数正常启动 · ' + (r.sdk ? 'SDK 已加载' : 'Claude SDK 没加载好') + ' · ' + (r.db ? '数据库连上了' : '数据库没连上') + ' · ' + keyText('openai') + ' · ' + keyText('anthropic') };
      } catch (e) { exT.ping = { ok: false, text: '云函数没回话：' + (e.status ? '出错 ' + e.status + '（' + e.message + '）' : e.message) + '。到 Supabase 的 ex-gen → Logs 看一下' }; }
      exT.pinging = false; render(); return;
    }
    if (act === 'try' || act === 'regen') {
      if (!exT.wid || exT.busy) return;
      // 上一次结果不明：「试生成」按钮只按原编号查询（同一个词、同一类、同一家），返回那次的调用明细，不重新花钱；「重新生成」才换新编号
      // 查询只发 poll（服务器上没有这次请求就回「未找到」，绝不新生成）；只有「试生成」（没有留着的编号时）和「重新生成」才发 gen
      const sig = exSig(), query = act === 'try' && !!exT.rid && exT.ridFor === sig, rid = query ? exT.rid : uuid4();
      exT.busy = true; exT.mode = query ? 'query' : 'gen'; exT.res = null; render();
      try { exT.res = await exCall(query ? { act: 'poll', k: KEY, rid } : { act: 'gen', k: KEY, wid: exT.wid, kind: exT.kind, rid, seen: [], prov: exT.prov }, 70000); }
      catch (e) { exT.res = { msg: e.timeout ? '等了太久，可能还在生成' : e.message, unsure: !!(e.timeout || e.net || !e.status || e.status >= 500) }; }
      if (exUnsure(exT.res)) { exT.rid = rid; exT.ridFor = sig; } else { exT.rid = null; exT.ridFor = ''; }
      exT.busy = false; await exaLoad(); return;
    }
    busy(a, true);
    try {
      if (act === 'resume') { await rpc('adm_ex', { act: 'resume', a: { provider: a.dataset.p } }, { obj: true }); toast('已恢复 ' + PN(a.dataset.p)); }
      else if (act === 'hide' || act === 'show') { const r = await rpc('adm_ex', { act, a: { id: a.dataset.id } }, { obj: true }); toast(act === 'hide' ? '已隐藏，学生不会再看到这句' : r.expired ? '已恢复（这句时事已经过期，学生也不会再看到）' : '已恢复'); }
      else if (act === 'ok') { await rpc('adm_ex', { act: 'ok', a: { id: a.dataset.id } }, { obj: true }); toast('已标记没问题'); }
    } catch (e) { fail(e); busy(a, false); return; }
    await exaLoad();
  }
  document.addEventListener('submit', async e => {
    if (!D || $('app').dataset.role !== 'adm' || tab !== 'ex') return;
    const f = e.target; if (!f.matches || !f.matches('.xbud, #xpf')) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f).entries()), btn = f.querySelector('button');
    if (btn && btn.disabled) return; busy(btn, true);
    try {
      if (f.id === 'xpf') { await rpc('adm_ex', { act: 'price', a: fd }, { obj: true }); toast('已保存这一行价格'); }
      else { const r = await rpc('adm_ex', { act: 'budget', a: Object.assign({ provider: f.dataset.p }, fd) }, { obj: true }); toast('已保存：' + PN(f.dataset.p) + ' 本期 ' + money(r.amount) + '（' + md(r.start) + '～' + md(r.end) + '）'); }
    } catch (er) { fail(er); busy(btn, false); return; }
    await exaLoad();
  });

  // ── 设置面板 ──
  const stepHTML = k => '<div class="step"><button type="button" data-k="' + k + '" data-dd="-1" aria-label="减少">−</button><input id="f-' + k + '" type="number" inputmode="numeric" min="' + NUM[k][1] + '" max="' + NUM[k][2] + '"><span class="u">' + NUM[k][0] + '</span><button type="button" data-k="' + k + '" data-dd="1" aria-label="增加">+</button></div>';
  const fld = (k, label, ctrl, extra = '') => '<div class="field" data-key="' + k + '" id="fd-' + k + '"><div class="fl"><span>' + label + '</span><span class="inh" id="i-' + k + '"></span>' + extra + '</div>' + ctrl + '</div>';
  const sw = (k, label) => '<button type="button" class="sw" role="switch" id="f-' + k + '" aria-label="' + label + '"></button>';
  const seg = (id, label, opts) => '<div class="seg" role="group" aria-label="' + label + '" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" aria-pressed="false">' + n + '</button>').join('') + '</div>';
  const hint = t => '<span class="inh">' + t + '</span>';

  function scopeBar() {
    const t = TPL();
    if (!stuKey && D.students.length) stuKey = D.students[0].id;
    const b = (sc, label, key) => '<button type="button" data-scope="' + sc + '"' + (key ? ' data-tpl="' + esc(key) + '" title="' + label + '"' : '') + ' aria-pressed="' + (scope === sc && (sc !== 'tpl' || key === tplKey)) + '">' + label + '</button>';
    return '<div class="row"><div class="seg scopes" role="group" aria-label="改哪一层">' + b('global', '所有学生的默认') + D.plans.map(p => b('tpl', esc(p.name), p.key)).join('') + b('stu', '单个学生') + '</div>' +
      (scope === 'stu' ? (D.students.length ? '<select id="pickStu" aria-label="选学生">' + D.students.map(s => '<option value="' + s.id + '"' + (s.id === stuKey ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>' : '<span class="muted">还没有学生</span>') : '') +
      '</div><div class="muted" id="who"></div>';
  }
  function cfgHTML() {
    if (scope === 'stu' && !D.students.length) return '<div class="box"><h2>还没有学生</h2><div class="muted">先在「学生」里加学生。</div></div>';
    if (scope === 'tpl' && !tplKey) return '<div class="box"><h2>还没有方案</h2><div class="muted">数据库里没有读到方案，请刷新页面；还是没有的话请联系管理员。</div></div>';
    const t = TPL(), CN = CNT(), rq = scope === 'stu' ? reqOf(stuKey) : null;
    let h = '<section class="box"><h2>按现在的设置 <small id="sumWho"></small></h2><div class="stats">' +
      '<div class="stat"><b id="sDay"></b><span id="sDayLab">每天新词</span></div><div class="stat"><b id="sWords"></b><span>所选档位的词</span></div><div class="stat"><b id="sWeeks"></b><span id="sYears"></span></div></div>' +
      '<div class="weeks" id="weeks"></div><div class="legend"><span><i style="background:var(--ai-soft)"></i>学新词</span><span><i style="background:var(--warn-bg)"></i>回顾周</span><span>前 16 周；按不追加、不缺学、错词不占名额估算</span></div>' +
      '<div class="note">改好点下面「保存」。<b>学生已经开始的这一周照旧</b>，从各自的下一周起用新设置（延长中的那一周也照旧）。</div></section>' +
      (scope === 'stu' ? '<section class="box"><h2>这个学生用哪个方案</h2><div class="field" style="border-top:0"><div class="fl"><span>方案</span><span class="inh">换方案后，没单独改过的项会跟着新方案走；学过的词和成绩都保留</span></div>' + seg('c-tplOf', '方案', D.plans.map(p => [p.key, esc(p.name)])) + '</div>' +
        (rq ? '<div class="note rqbar"><span>学生申请换成「<b>' + esc(rq.tname) + '</b>」' + (rq.reason ? '，理由：' + esc(rq.reason) : '（没写理由）') + ' · ' + stamp(rq.at) + '</span><span class="rqb"><button type="button" class="gbtn" data-rq="' + esc(rq.id) + '" data-ok="1">同意</button><button type="button" class="gbtn" data-rq="' + esc(rq.id) + '" data-ok="0">不同意</button></span></div>' : '') + '</section>' : '') +
      '<section class="box"><h2>学习量</h2>' + fld('weekly', '每周新词数', stepHTML('weekly')) + fld('days', '每周学几天', stepHTML('days')) +
      fld('addOn', '学完可以「再来一组」', sw('addOn', '学完可以再来一组'), hint('追加的词算进本周，一起考')) + fld('addN', '一组几个', stepHTML('addN')) +
      fld('order', '本周词单顺序', seg('c-order', '本周词单顺序', [['mix', '打乱'], ['lv', '按档从易到难']]), hint('打乱：各档的词、上周错词混在一起，同一周里顺序固定。按档：上周错词在前，新词从 N5 到 N1、常用的在前')) + '</section>' +
      '<section class="box" id="bxLv"><h2>' + (scope === 'tpl' ? '方案「' + esc(t[tplKey] || '') + '」：各档怎么学' : '各档怎么学') + ' <small>' + LV.map((l, i) => l + ' ' + CN[i]).join(' · ') + '</small></h2>' +
      (scope === 'tpl' ? '<div class="muted">其他设置都跟「所有学生的默认」，要单独调某个学生请到「单个学生」。</div><div class="copyrow"><button type="button" class="gbtn" id="copyTpl">复制成新方案</button><button type="button" class="gbtn" id="renTpl">改名</button></div>' : '') +
      fld('mode', '学法', seg('c-mode', '学法', [['mix', '按比例混合'], ['step', '逐级'], ['only', '只学某几档']])) +
      '<div class="small muted" id="lvNote" hidden></div>' +
      '<div class="sub2" id="pMix"><span class="inh" id="i-ratio"></span><div id="lvRows" style="display:flex;flex-direction:column;gap:8px">' +
      LV.map((l, i) => '<div class="lv"><b>' + l + '</b><div class="barr"><i id="bar' + i + '"></i></div><div class="step"><button type="button" data-r="' + i + '" data-dd="-1" aria-label="' + l + ' 减少">−</button><input id="r' + i + '" type="number" min="0" max="100" aria-label="' + l + ' 百分比"><span class="u">%</span><button type="button" data-r="' + i + '" data-dd="1" aria-label="' + l + ' 增加">+</button></div><span class="n" id="rn' + i + '"></span></div>').join('') +
      '</div><div class="sumline" id="ratioSum"><span id="ratioTxt"></span><button type="button" class="gbtn" id="ratioReset">恢复系统初始比例（' + DEF_RATIO.join('/') + '）</button></div></div>' +
      '<div class="sub2" id="pStep">' + fld('start', '从哪一档开始', seg('c-start', '从哪一档开始', LV.map(l => [l, l]))) + '<div class="note" id="stepTxt"></div></div>' +
      '<div class="sub2" id="pOnly">' + fld('only', '学哪几档', '<div class="checks" id="c-only">' + LV.map((l, i) => '<button type="button" class="ck" data-v="' + l + '" aria-pressed="false">' + l + ' · ' + CN[i] + '</button>').join('') + '</div>') + '<div class="note" id="onlyTxt"></div></div></section>' +
      '<section class="box" id="bxSrs"><h2>每天复习 <small>按遗忘曲线：学过的词隔 1、2、4、7、15 天回来一次</small></h2>' + fld('srsOn', '要每天复习', sw('srsOn', '要每天复习')) + fld('srsN', '每天最多复习几个', stepHTML('srsN'), hint('到期的词比这个多时，按到期早的先复习，剩下的明天接着来')) + '</section>' +
      '<section class="box"><h2>学习循环</h2>' + fld('learnW', '先学几周新词', stepHTML('learnW')) + fld('revW', '接着回顾几周', stepHTML('revW'), hint('填 0 就是不要回顾周')) + '</section>' +
      '<section class="box"><h2>周测</h2><div class="field"><div class="fl"><span>考哪些词</span></div><span class="lock">本周词单里的全部词，不抽查（含追加的、带过来的错词）</span></div>' +
      fld('untaught', '到周测时还没学的词', seg('c-untaught', '还没学的词', [['test', '照考'], ['next', '不考，挪到下周']])) +
      fld('pass', '及格线', stepHTML('pass')) +
      fld('types', '题型', '<div class="checks" id="c-types">' + TYPES.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('每个词只考一题，从勾选的题型里随机出。前 5 种是 JLPT 考试题型（题库里出好的题）；这个词题库里没有的题型就换别的，都没有时出「看日语选中文」')) +
      fld('instant', '答题时当场判对错', sw('instant', '答题时当场判对错'), hint('开：每题选了马上显示对错，选了就不能改；关：可以改答案，交卷后再看错题。周测、回顾测、季度测、年测都按这一项')) +
      fld('whyT', '当场显示解析的题型', '<div class="checks" id="c-whyT">' + WHY.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('勾上的题型，答完马上在选项下面显示解析。看日语选中文等 3 种简单题本来就没有解析。交卷后的错题解析照旧都有')) +
      fld('carryFail', '没及格时，错词带到下周', sw('carryFail', '没及格时错词带到下周')) + fld('carryPass', '及格了但有错词，也带到下周', sw('carryPass', '及格了但有错词也带到下周')) +
      fld('total', '带过去以后，下周学多少', seg('c-total', '下周学多少', [['A', '新词照旧＋错词'], ['B', '总数不变']])) + '<div class="note" id="totalTxt"></div></section>' +
      '<section class="box" id="bxRev"><h2>回顾周 <small id="revOff"></small></h2>' + fld('revN', '抽多少个词来考', stepHTML('revN'), hint('学过的词不够时，有多少考多少')) +
      fld('revMust', '前几周错过的词一定抽到', sw('revMust', '错过的词一定抽到'), hint('错词比上面的数还多时，全部考')) + fld('revPass', '及格线', stepHTML('revPass')) + '</section>' +
      '<section class="box" id="bxQ"><h2>季度测 <small>按设置出卷</small></h2>' + fld('qOn', '要季度测', sw('qOn', '要季度测')) + fld('qEvery', '每几周考一次', stepHTML('qEvery')) + fld('qN', '抽多少个词', stepHTML('qN')) + fld('qPass', '及格线', stepHTML('qPass')) + '</section>' +
      '<section class="box" id="bxY"><h2>年测 <small>按设置出卷</small></h2>' + fld('yOn', '要年测', sw('yOn', '要年测')) + fld('yEvery', '每几周考一次', stepHTML('yEvery')) + fld('yN', '抽多少个词', stepHTML('yN')) + fld('yPass', '及格线', stepHTML('yPass')) + '</section>' +
      '<section class="box"><h2>几场测验撞在同一周</h2>' + fld('merge', '怎么考', seg('c-merge', '同一周几场测验', [['merge', '合成一场'], ['both', '分开考']])) + '</section>' +
      '<section class="box"><h2>拼图</h2>' + fld('dim', '回顾测答错时，格子变暗', sw('dim', '答错时格子变暗'), hint('关着＝不变暗，只记进错词本')) + '</section>' +
      '<section class="box" id="bxEx"' + (scope === 'global' ? '' : ' hidden') + '><h2>拓展例句 <small>卡片背面的知识例句、时事例句，学生点了才生成</small></h2>' +
      fld('exOn', '拓展例句', sw('exOn', '拓展例句'), hint('关着＝学生页不再生成，也不给已有的句子')) +
      fld('exWhoK', '知识例句用哪家', seg('c-exWhoK', '知识例句用哪家', [['anthropic', '只用 Claude'], ['openai', '只用 OpenAI'], ['both', '两家轮流'], ['off', '关闭']]), hint('关闭＝学生页不显示「知识例句」按钮（管理端试生成照样能用）')) +
      fld('exWhoN', '时事例句用哪家', seg('c-exWhoN', '时事例句用哪家', [['openai', '只用 OpenAI'], ['anthropic', '只用 Claude'], ['both', '两家轮流'], ['off', '关闭']]), hint('两家轮流：本期剩余预算÷剩余天数多的先用；一家出错、额度用完时换另一家。关闭＝学生页不显示「时事例句」按钮（时事先关着，验收通过再开）')) +
      fld('exModelA', 'Claude 模型', '<input id="f-exModelA" class="tin" maxlength="64" spellcheck="false" autocomplete="off" aria-label="Claude 模型">', hint('默认 claude-opus-5-5；换模型前先在「拓展例句」页填好它的价格')) +
      fld('exModelO', 'OpenAI 模型', '<input id="f-exModelO" class="tin" maxlength="64" spellcheck="false" autocomplete="off" aria-label="OpenAI 模型">', hint('默认 gpt-6.2-astra；也可以改成 gpt-6.2-sol（便宜约 4 倍）')) +
      fld('exPerWord', '每个词每类最多几句', stepHTML('exPerWord'), hint('够数以后循环给已有的句子；隐藏的、过期的不占位')) +
      fld('exPerDay', '每人每天最多生成几次', stepHTML('exPerDay'), hint('0 ＝不限；看已有的句子不算次数')) + fld('exPerMin', '每人每分钟最多生成几次', stepHTML('exPerMin')) +
      fld('exInflight', '全站同时生成几个', stepHTML('exInflight')) + fld('exNewsDays', '时事句多久换新', stepHTML('exNewsDays')) +
      fld('exNewsWin', '只用多少天内的新闻', stepHTML('exNewsWin')) + fld('exNoMatchDays', '找不到合适新闻后，隔几天再搜', stepHTML('exNoMatchDays')) +
      fld('exDomains', '时事新闻只搜这些网站', '<textarea id="f-exDomains" rows="6" spellcheck="false" aria-label="新闻只搜哪些网站"></textarea>', hint('每行一个，最多 20 个，例如 nhk.or.jp（不写 https:// 和路径）')) +
      '<div class="note">每月预算、价格、用量、学生报错、试生成在顶上的「拓展例句」页。</div></section>';
    // 方案只管「各档怎么学」：别的块都不显示（元素留着，页面的其他计算照常）
    if (scope === 'tpl') h = h.replace(/<section class="box"(?! id="bxLv")/g, '<section class="box" hidden');
    return h;
  }
  function saveBar() { return '<div class="savebar"><div class="wrap"><div class="st" id="dirty" role="status">没有改动</div><div style="display:flex;gap:8px"><button type="button" class="btn" id="discard" disabled>放弃改动</button><button type="button" class="btn main" id="save" disabled>保存</button></div></div></div>'; }
  function buildSteps() {}

  // 三层数据
  const savedTplOv = k => clone((D.plans.find(p => p.key === k) || {}).ov || {});
  function layer() {
    if (scope === 'global') return clone(D.global);
    if (scope === 'tpl') return savedTplOv(tplKey);
    const s = stuOf(stuKey); return { tpl: s.plan, ov: clone(s.ov || {}) };
  }
  const ov = () => scope === 'stu' ? draft.ov : draft;
  function base(tpl) { const b = clone(D.global); if (scope === 'stu') Object.assign(b, savedTplOv(tpl || draft.tpl)); return b; }
  function eff() { return scope === 'global' ? draft : Object.assign(base(), clone(ov())); }
  function from(k) { const t = TPL(); if (scope === 'stu' && k in savedTplOv(draft.tpl)) return '方案「' + t[draft.tpl] + '」'; return '所有学生的默认'; }
  function setVal(k, v) { if (scope === 'global') draft[k] = v; else { const o = ov(), b = base(); if (same(v, b[k])) delete o[k]; else o[k] = v; } refresh(); }
  function fmt(k, v) {
    if (v === undefined) return '—';
    if (NUM[k]) return v + NUM[k][0];
    if (typeof v === 'boolean') return v ? '开' : '关';
    if (k === 'mode') return MODE[v];
    if (k === 'order') return v === 'lv' ? '按档从易到难' : '打乱';
    if (k === 'whyT') return WHY.filter(([t]) => whyOn(v, t)).map(([, nm]) => nm.replace(/（.*/, '')).join('、') || '（都不显示）';
    if (k === 'ratio') return v.join(' / ');
    if (k === 'only') return v.join('、');
    if (k === 'types') return TYPES.filter(([t]) => typeOn(v, t)).map(([, nm]) => nm).join('、') || '（无）';
    if (k === 'total') return v === 'A' ? '新词照旧＋错词' : '总数不变';
    if (k === 'untaught') return v === 'test' ? '照考' : '挪到下周';
    if (k === 'merge') return v === 'merge' ? '合成一场' : '分开考';
    if (k === 'exWhoK' || k === 'exWhoN') return WHO[v] || String(v);
    if (k === 'exDomains') return Array.isArray(v) ? v.join('、') : String(v);
    return String(v);
  }
  function changes() {
    const out = [];
    if (scope === 'global') { for (const k in D.global) if (!same(D.global[k], draft[k])) out.push([k, fmt(k, D.global[k]), fmt(k, draft[k])]); return out; }
    const L = layer(), Lov = scope === 'stu' ? L.ov : L, Dov = ov(), oldTpl = scope === 'stu' ? L.tpl : null, t = TPL();
    const oldEff = Object.assign(base(oldTpl), clone(Lov)), newEff = eff();
    if (scope === 'stu' && oldTpl !== draft.tpl) out.push(['tplOf', t[oldTpl], t[draft.tpl]]);
    for (const k in D.global) {
      const a = k in Lov, b = k in Dov;
      if (same(oldEff[k], newEff[k]) && a === b) continue;
      if (!a && !b && scope === 'stu' && oldTpl !== draft.tpl) continue;
      out.push([k, (a ? '单独 ' : '跟随上一级 ') + fmt(k, oldEff[k]), (b ? '单独 ' : '跟随上一级 ') + fmt(k, newEff[k])]);
    }
    return out;
  }
  function words(e) {
    const C = CNT();
    if (e.mode === 'step') return C.slice(Math.max(0, LV.indexOf(e.start))).reduce((a, b) => a + b, 0);
    if (e.mode === 'only') return LV.reduce((a, l, i) => a + ((e.only || []).includes(l) ? C[i] : 0), 0);
    return LV.reduce((a, l, i) => a + (e.ratio[i] > 0 ? C[i] : 0), 0);
  }
  function alloc(total, ratio) {
    const s = ratio.reduce((a, b) => a + b, 0) || 1, raw = ratio.map(r => total * r / s), out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && ratio[i] > 0) { out[i]++; left--; } });
    return out;
  }
  function plan(e) { const out = []; let left = words(e); while (left > 0 && out.length < 3000) { for (let i = 0; i < e.learnW && left > 0; i++) { out.push('L'); left -= e.weekly; } for (let i = 0; i < e.revW; i++) out.push('R'); } return out; }
  function lockBox(id, off, keep) { const bx = $(id); if (!bx) return; bx.querySelectorAll('.field').forEach(f => { if (f.dataset.key === keep) return; f.classList.toggle('dim', off); f.querySelectorAll('input,button:not([data-reset])').forEach(x => x.disabled = off); }); }
  function syncInputs() { const e = eff(); for (const k in NUM) { const el = $('f-' + k); if (el) el.value = e[k]; }
    ['exModelA', 'exModelO'].forEach(k => { const el = $('f-' + k); if (el) el.value = e[k] || ''; }); const dm = $('f-exDomains'); if (dm) dm.value = (e.exDomains || []).join('\n'); LV.forEach((l, i) => { const el = $('r' + i); if (el) el.value = e.ratio[i]; }); }
  function whoTxt() {
    const t = TPL(), s = stuOf(stuKey);
    const nm = scope === 'global' ? '所有学生的默认' : scope === 'tpl' ? '方案「' + t[tplKey] + '」' : (s ? s.name : '');
    $('who').innerHTML = '正在改：<b>' + esc(nm) + '</b>' + (scope === 'global' ? '（每个学生的起点；方案只管各档怎么学）' : scope === 'tpl' ? '（用这个方案的学生，共 ' + D.students.filter(x => x.plan === tplKey).length + ' 人；方案只管各档怎么学）' : '（只影响这一个学生）');
    $('sumWho').textContent = scope === 'stu' ? (s ? s.name : '') + ' 的情况' : scope === 'tpl' ? '用「' + t[tplKey] + '」的学生' : '所有学生的默认';
  }
  // 这一层设置在数据库里的版本号（保存时带上，别人刚改过会被拦下）
  function layerVer() { if (scope === 'global') return num(D.gver, 0); if (scope === 'tpl') return num((D.plans.find(p => p.key === tplKey) || {}).ver, 0); return num((stuOf(stuKey) || {}).ver, 0); }
  const layerId = () => scope + ':' + (scope === 'tpl' ? tplKey : scope === 'stu' ? stuKey : '');
  function loadDraft() {
    if (scope === 'stu' && !stuOf(stuKey)) return;
    if (scope === 'tpl' && !tplKey) return;
    draft = clone(layer()); draftBase = clone(draft); draftVer = layerVer();
    let note = '';
    // 保存时发现别人刚改过：把自己的改动放到最新的设置上（只改了不同项的直接合并；同一项两边都改了的，列出来请老师看一眼）
    if (rebase && rebase.id === layerId()) {
      const { mine, base } = rebase, both = [];
      const put = (dst, src, b, k) => { if (same(src[k], b[k])) return; if (!same(dst[k], b[k]) && !same(dst[k], src[k])) both.push(LAB[k] || k); if (src[k] === undefined) delete dst[k]; else dst[k] = clone(src[k]); };
      if (scope === 'stu') {
        if (mine.tpl !== base.tpl) { if (draft.tpl !== base.tpl && draft.tpl !== mine.tpl) both.push('方案'); draft.tpl = mine.tpl; }
        new Set([...Object.keys(mine.ov), ...Object.keys(base.ov)]).forEach(k => put(draft.ov, mine.ov, base.ov, k));
      } else new Set([...Object.keys(mine), ...Object.keys(base)]).forEach(k => put(draft, mine, base, k));
      note = both.length ? '别人刚改过这一层；你的改动已经放到最新的设置上。下面几项两边都改了，现在显示的是你的：' + both.join('、') + '。看一眼再保存。' : '别人刚改过这一层的其他项；你的改动已经放到最新的设置上，可以再保存一次。';
    }
    rebase = null;
    whoTxt(); syncInputs(); refresh();
    if (note) { const w = $('who'); if (w) w.insertAdjacentHTML('beforeend', '<div class="warnbox" role="status">' + esc(note) + '</div>'); toast('别人刚改过这一层设置，请看页面上方的提示'); }
  }
  function refresh() {
    if (!draft || !$('dirty')) return;
    const e = eff(), b = scope === 'global' ? null : base(), o = scope === 'global' ? null : ov();
    SEGS.forEach(([k, id]) => { const g = $(id); if (g) g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === e[k] ? 'true' : 'false')); });
    $('c-only').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', (e.only || []).includes(x.dataset.v) ? 'true' : 'false'));
    $('c-types').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', typeOn(e.types, x.dataset.v) ? 'true' : 'false'));
    $('c-whyT').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', whyOn(e.whyT, x.dataset.v) ? 'true' : 'false'));
    if (scope === 'stu') $('c-tplOf').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === draft.tpl ? 'true' : 'false'));
    SW.forEach(k => $('f-' + k).setAttribute('aria-checked', e[k] ? 'true' : 'false'));
    for (const k in D.global) {
      const el = $('i-' + k); if (!el) continue;
      let h = '';
      if (scope === 'global') { if (!same(D.global[k], draft[k])) h = '<span class="chip d">改了</span>原来 ' + esc(fmt(k, D.global[k])); }
      else if (k in o) h = '<span class="chip">单独设置</span>' + esc(from(k)) + '是 ' + esc(fmt(k, b[k])) + ' <button type="button" class="link" data-reset="' + k + '">跟随上一级</button>';
      else h = '跟着' + esc(from(k));
      el.innerHTML = h;
    }
    $('pMix').hidden = e.mode !== 'mix'; $('pStep').hidden = e.mode !== 'step'; $('pOnly').hidden = e.mode !== 'only';
    // 所有学生的默认：写明哪些方案自己设了学法（不按这里的）、哪些方案跟这里的默认学法（免得以为所有学生都按这里学）
    const nt = $('lvNote'); nt.hidden = scope !== 'global';
    if (scope === 'global') {
      const own = D.plans.filter(p => p.ov && MODE[p.ov.mode]), fol = D.plans.filter(p => !(p.ov && MODE[p.ov.mode]));
      nt.innerHTML = (own.length ? '各方案可以自己设学法：' + own.map(p => '「' + esc(p.name) + '」' + esc(lvText(Object.assign({}, e, p.ov), { short: true }))).join('；') + '，不按这里的。' : '') +
        (fol.length ? (own.length ? '<br>' : '') + '跟这里默认学法的方案：' + fol.map(p => '「' + esc(p.name) + '」' + (p.ov && Array.isArray(p.ov.ratio) ? '（比例用方案自己的）' : '')).join('、') + '。' : (own.length ? '<br>' : '') + '现在没有方案跟这里的默认学法。');
    }
    const rs = e.ratio.reduce((a, c) => a + c, 0), per = alloc(e.weekly, e.ratio);
    LV.forEach((l, i) => { $('bar' + i).style.width = Math.min(100, num(e.ratio[i])) + '%'; $('rn' + i).textContent = '约 ' + per[i] + ' 个/周'; });
    $('ratioTxt').textContent = '加起来 ' + rs + '%' + (rs === 100 ? '' : '，要正好 100% 才能保存') + '（右边的个数按常规每周新词数 ' + num(e.weekly, 100) + ' 个估算）' + (CNT().slice(1).every(x => !x) ? '。现在只有 N5 有词，其他档的名额先由 N5 补上' : '');
    $('ratioSum').classList.toggle('badsum', rs !== 100);
    const si = Math.max(0, LV.indexOf(e.start));
    $('stepTxt').innerHTML = '新词从 <b>' + LV[si] + '</b> 起按档发（' + esc(LV.slice(si).join(' → ')) + '），本档的新词发完了接着发下一档，同一周可能跨档。' + (si > 0 ? LV.slice(0, si).join('、') + ' 在拼图上直接点亮，标「已掌握」。' : '');
    const skip = LV.filter(l => !(e.only || []).includes(l));
    $('onlyTxt').innerHTML = '新词只从 <b>' + (esc((e.only || []).join('、')) || '（还没选）') + '</b> 选，以前的错词仍会复习' + (skip.length ? '；' + esc(skip.join('、')) + ' 在拼图上直接点亮，标「已掌握」。' : '。');
    // 预览里的数字都先变成数字再显示（设置里万一混进了奇怪的内容，也不会被当成网页代码）
    const wkN = Math.max(1, num(e.weekly, 100)), pa = num(e.pass, 95);
    const err = Math.max(1, Math.round(wkN * .17)), rate = Math.floor((wkN - err) / wkN * 100), passed = rate >= pa, carry = passed ? e.carryPass : e.carryFail;
    let t = '例：' + wkN + ' 个错了 ' + err + ' 个（对了 ' + rate + '%，' + (passed ? '及格' : '没到 ' + pa + '%，不及格') + '），按「' + (passed ? '及格了但有错词' : '没及格时') + '」那一项：';
    if (!carry) t += '错词不带，下周照常学 <b>' + wkN + '</b> 个新词。';
    else if (e.total === 'A') t += '下周学 <b>' + (wkN + err) + '</b> 个（' + err + ' 个错词＋' + wkN + ' 个新词）。';
    else { const k = Math.min(err, wkN); t += '下周还是 <b>' + wkN + '</b> 个（' + k + ' 个错词＋' + (wkN - k) + ' 个新词）。'; }
    $('totalTxt').innerHTML = t + '<br>学生详情里设了「下周新词数」的那一周：新词按设的数，上周的错词全部带上（不管这里选哪个）。';
    $('revOff').textContent = e.revW === 0 ? '现在没有回顾周，下面的设置不起作用' : '';
    lockBox('bxRev', e.revW === 0); lockBox('bxSrs', !e.srsOn, 'srsOn'); lockBox('bxQ', !e.qOn, 'qOn'); lockBox('bxY', !e.yOn, 'yOn');
    const fa = $('fd-addN'); fa.classList.toggle('dim', !e.addOn); fa.querySelectorAll('input,button').forEach(x => x.disabled = !e.addOn);
    const fw = $('fd-whyT'); fw.classList.toggle('dim', !e.instant); fw.querySelectorAll('.ck').forEach(x => x.disabled = !e.instant);
    const P = plan(e), T = P.length, q = Math.floor(e.weekly / e.days), r = e.weekly % e.days;
    $('sDay').textContent = r ? q + '～' + (q + 1) : q;
    $('sDayLab').textContent = r ? r + ' 天 ' + (q + 1) + ' 个、' + (e.days - r) + ' 天 ' + q + ' 个' : '每天新词';
    $('sWords').textContent = words(e).toLocaleString();
    $('sWeeks').textContent = T + ' 周'; $('sYears').textContent = '约 ' + (T / 52).toFixed(1) + ' 年学完';
    let wk = ''; for (let w = 1; w <= 16; w++) { const s = P[w - 1]; wk += s ? '<div class="wk' + (s === 'R' ? ' r' : '') + '" title="第 ' + w + ' 周">' + (s === 'R' ? '回' : w) + '</div>' : '<div class="wk e" title="第 ' + w + ' 周：已学完"></div>'; }
    $('weeks').innerHTML = wk;
    const ch = changes(), badR = rs !== 100 && e.mode === 'mix', badO = e.mode === 'only' && !(e.only || []).length, bad = badR || badO;
    const why = badR ? '各档比例加起来 ' + rs + '%，' + (rs < 100 ? '还差 ' + (100 - rs) : '多了 ' + (rs - 100)) + '%' : badO ? '「学哪几档」还没选' : '';
    $('dirty').innerHTML = ch.length ? '有 <b>' + ch.length + '</b> 处改动没保存' + (bad ? '（' + esc(why) + ' <button type="button" class="link" data-jump="' + (badR ? 'pMix' : 'pOnly') + '">去改</button>）' : '') : '没有改动';
    $('save').disabled = !ch.length || bad; $('discard').disabled = !ch.length;
    $('discard').textContent = ch.length ? '放弃这 ' + ch.length + ' 处改动' : '放弃改动';
  }
  const dirtyCount = () => (tab === 'cfg' && draft && $('dirty')) ? changes().length : 0;
  function guard() { const n = dirtyCount(); if (n) { toast('先保存或放弃这 ' + n + ' 处改动，再切换'); return true; } return false; }
  async function saveCfg(btn) {
    const ch = changes(); if (!ch.length || savingCfg) return;
    savingCfg = true; busy(btn, true);
    const items = ch.map(([k, a, b]) => LAB[k] + '：' + a + ' → ' + b);
    const ver = draftVer;
    try {
      if (scope === 'global') await rpc('adm_save_cfg', { scope, target: '', d: draft, pl: null, items, ver });
      else if (scope === 'tpl') await rpc('adm_save_cfg', { scope, target: tplKey, d: draft, pl: null, items, ver });
      else await rpc('adm_save_cfg', { scope, target: stuKey, d: draft.ov, pl: draft.tpl, items, ver });
      // 先把刚保存的设置写进本页，再重新读取；读取失败也不会拿旧设置盖回去
      if (scope === 'global') { D.global = Object.assign({}, D.global, clone(draft)); D.gver = ver + 1; }
      else if (scope === 'tpl') { const p = D.plans.find(x => x.key === tplKey); if (p) { p.ov = clone(draft); p.ver = ver + 1; } }
      else { const s = stuOf(stuKey); if (s) { s.ov = clone(draft.ov); s.plan = draft.tpl; s.ver = ver + 1; } }
      draft = null; savingCfg = false;
      toast('已保存：已经开始的这一周照旧，各学生从下一周起用新设置');
      if (!(await reload())) toast('已保存，但重新读取没成功，刷新页面看看');
    } catch (e) {
      savingCfg = false;
      if (/刚刚被/.test(e.message)) {
        // 两个窗口同时改：重新读取最新的设置，把自己的改动放上去，请老师看一眼再保存（不会悄悄覆盖别人的）
        let nd; try { nd = await rpc('adm_load', {}, { obj: true }); } catch (e2) { toast('别人刚改过这一层设置，重新读取又没成功；你的改动还在页面上，过一会儿再点保存'); busy(btn, false); return; }
        rebase = { id: layerId(), mine: clone(draft), base: clone(draftBase) };
        D = nd; fix(); render();
        return;
      }
      fail(e); busy(btn, false);
    }
  }

  document.addEventListener('click', async e => {
    if (!D || $('app').dataset.role !== 'adm' || e.target.closest('.modal')) return;
    const t = e.target;
    if (t.closest('button:disabled')) return;
    const at = t.closest('[data-atab]'); if (at) { if (at.dataset.atab === tab || guard()) return; tab = at.dataset.atab; draft = null; if (tab === 'ex') EXA = null; render(); return; }
    if (tab === 'ex') {
      const xa = t.closest('[data-xa]'); if (xa) { exaAct(xa); return; }
      const xs = t.closest('#xtk button[data-v], #xtp button[data-v]'); if (xs) { if (xs.parentElement.id === 'xtk') exT.kind = xs.dataset.v; else exT.prov = xs.dataset.v; exT.res = null; render(); return; }
    }
    if (t.closest('[data-a="add"]')) { addModal(); return; }
    if (t.closest('[data-a="reqs"]')) { reqsModal(); return; }
    const st = t.closest('[data-stu]'); if (st) { detailModal(st.dataset.stu); return; }
    if (tab !== 'cfg') return;
    if (savingCfg) { toast('正在保存，等一下'); return; }
    const sc = t.closest('[data-scope]'); if (sc) { const ns = sc.dataset.scope, nk = sc.dataset.tpl || tplKey; if ((ns === scope && (ns !== 'tpl' || nk === tplKey)) || guard()) return; scope = ns; if (ns === 'tpl') tplKey = nk; draft = null; render(); window.scrollTo({ top: 0 }); return; }
    const rqb = t.closest('[data-rq]'); if (rqb) { if (!rqb.disabled) decide(rqb.dataset.rq, rqb.dataset.ok === '1'); return; }
    if (t.closest('#copyTpl')) {   /* 新名字由数据库取（原名＋「 副本」，重名加序号，同时复制也不会重名） */
      if (guard() || copying) return;
      if (copied) { toast('刚才的新方案已经复制好了，先点上面的「重新读取方案列表」'); return; }
      copying = true; t.closest('#copyTpl').disabled = true; copyAt = layerId();
      let nk;
      try { nk = await rpc('adm_plan_copy', { src: tplKey, nm: null }, { str: true }); } catch (er) { copying = false; fail(er); const cb = $('copyTpl'); if (cb) cb.disabled = false; return; }   // 复制没成功：不重画，正在改的表单不动
      copied = nk; copying = false; toast('已复制，正在读取新方案…');
      await afterCopy(); return;
    }
    const rp = t.closest('[data-a="replans"]'); if (rp) { if (rp.disabled) return; busy(rp, true); await afterCopy(); return; }
    if (t.closest('#renTpl')) {
      if (guard()) return;
      const m = modal('<h2>给方案改名</h2><form class="form" id="rnf"><label>新名字<input id="rnn" maxlength="20" value="' + esc(TPL()[tplKey]) + '" required></label><div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main">保存</button></div></form>');
      m.querySelector('#rnf').addEventListener('submit', async ev => { ev.preventDefault(); try { await rpc('adm_plan_rename', { pk: tplKey, nm: m.querySelector('#rnn').value }); m.remove(); toast('已改名'); await reload(); } catch (er) { fail(er); } });
      return;
    }
    const jp = t.closest('[data-jump]'); if (jp) { const el = $(jp.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!draft) return;
    const sb = t.closest('button[data-k]'); if (sb) { const k = sb.dataset.k, [, mn, mx, sp] = NUM[k], v = Math.min(mx, Math.max(mn, eff()[k] + sp * (+sb.dataset.dd))); $('f-' + k).value = v; setVal(k, v); return; }
    const rr = t.closest('button[data-r]'); if (rr) { const i = +rr.dataset.r, r = eff().ratio.slice(); r[i] = Math.min(100, Math.max(0, r[i] + (+rr.dataset.dd))); $('r' + i).value = r[i]; setVal('ratio', r); return; }
    const swb = t.closest('.sw'); if (swb) { const k = swb.id.slice(2); setVal(k, !eff()[k]); return; }
    const sg = t.closest('.seg button[data-v]'); if (sg && sg.parentElement.id) { const id = sg.parentElement.id; if (id === 'c-tplOf') { draft.tpl = sg.dataset.v; syncInputs(); refresh(); return; } setVal(id.slice(2), sg.dataset.v); return; }
    const ck = t.closest('.ck'); if (ck) {
      const id = ck.parentElement.id, v = ck.dataset.v, cur = eff();
      if (id === 'c-only') { let a = (cur.only || []).slice(); a = a.includes(v) ? a.filter(x => x !== v) : LV.filter(l => a.includes(l) || l === v); if (!a.length) { toast('至少要学一档'); return; } setVal('only', a); }
      else if (id === 'c-whyT') { const o = {}; WHY.forEach(([t]) => o[t] = whyOn(cur.whyT, t)); o[v] = !o[v]; setVal('whyT', o); }
      else { const o = {}; TYPES.forEach(([t]) => o[t] = typeOn(cur.types, t)); o[v] = !o[v]; if (!TYPES.some(([t]) => o[t])) { toast('至少要留一种题型'); return; } setVal('types', o); }
      return;
    }
    const rs = t.closest('[data-reset]'); if (rs) { delete ov()[rs.dataset.reset]; syncInputs(); refresh(); return; }
    if (t.closest('#ratioReset')) { LV.forEach((l, i) => $('r' + i).value = DEF_RATIO[i]); setVal('ratio', DEF_RATIO.slice()); return; }
    if (t.closest('#discard')) { loadDraft(); typing = false; toast('已放弃本次编辑'); return; }
    if (t.closest('#save')) { saveCfg(t.closest('#save')); return; }
  });
  document.addEventListener('input', e => { if ($('app').dataset.role === 'adm' && tab === 'cfg' && e.target.closest && e.target.closest('main')) typing = true; });
  document.addEventListener('change', e => {
    if (!D || $('app').dataset.role !== 'adm' || tab !== 'cfg') return;
    const t = e.target;
    if (savingCfg) { toast('正在保存，等一下'); return; }
    if (t.id === 'pickTpl' || t.id === 'pickStu') { if (guard()) { t.value = t.id === 'pickTpl' ? tplKey : stuKey; return; } if (t.id === 'pickTpl') tplKey = t.value; else stuKey = t.value; draft = null; render(); return; }
    if (!draft) return;
    if (t.id === 'f-exModelA' || t.id === 'f-exModelO') {
      const k = t.id.slice(2), v = t.value.trim();
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(v)) { t.value = eff()[k] || ''; toast('模型名格式不对（只能有小写字母、数字、点、横线），没有改'); return; }
      t.value = v; setVal(k, v); return;
    }
    if (t.id === 'f-exDomains') {
      const a = [...new Set(t.value.split(/[\s,，、]+/).map(s => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean))];
      if (!a.length || a.length > 20 || a.some(d => !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) || d.length > 60)) { t.value = (eff().exDomains || []).join('\n'); toast('网站要填 1～20 个，每行一个，例如 nhk.or.jp，没有改'); return; }
      t.value = a.join('\n'); setVal('exDomains', a); return;
    }
    if (t.id && t.id.startsWith('f-') && NUM[t.id.slice(2)]) {
      const k = t.id.slice(2), [, mn, mx] = NUM[k], raw = t.value.trim(), v = Number(raw), cur = eff()[k];
      if (raw === '' || !Number.isFinite(v)) { t.value = cur; toast('要填 ' + mn + '～' + mx + ' 之间的整数，没有改'); return; }
      const c = Math.min(mx, Math.max(mn, Math.round(v))); if (c !== v) toast('只能填 ' + mn + '～' + mx + ' 之间的整数，已改成 ' + c);
      t.value = c; setVal(k, c); return;
    }
    if (/^r\d$/.test(t.id)) { const i = +t.id[1], r = eff().ratio.slice(), raw = t.value.trim(), v = Number(raw); if (raw === '' || !Number.isFinite(v)) { t.value = r[i]; return; } r[i] = Math.min(100, Math.max(0, Math.round(v))); t.value = r[i]; setVal('ratio', r); }
  });
  document.addEventListener('keydown', e => {
    if (!D || $('app').dataset.role !== 'adm' || document.querySelector('.modal')) return;
    const st = e.target.closest && e.target.closest('[data-stu]');
    if (st && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); detailModal(st.dataset.stu); }
  });
  window.addEventListener('beforeunload', e => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
  return { start };
})();
