// 单词学习系统 · 学生端：本周学习、测验、错词本、拼图地图
const Stu = (() => {
  let D = null, tab = 'study';
  let queue = [], flipped = false, again = new Set(), mode = 'new';   // mode: new 本周还没练的＋今天要再练的 / all 再过一遍 / rev 今天的复习 / round 回顾周复习本轮
  // 复习本轮（回顾周）：点按钮时才单独读取（学生页打开时不读）；评分只在这次复习里起作用，不写学习记录，第一次评分时给今天打卡
  // RD = {week 哪一周, lo、hi 第几周到第几周, cards 卡片}；roundReq：取卡的请求编号（学生转去做别的时作废旧请求）；roundNone：哪一周取到 0 张卡
  let RD = null, roundBusy = false, roundReq = 0, roundNone = null;
  // 复习本轮的打卡：每次评分记下「哪一周、哪一天」要打卡，每一条单独存进这个浏览器（名字＝学生摘要＋周＋日，不存钥匙），
  // 服务器确认记上了那一天才删掉那一条；每次用时都重新扫一遍（另一个标签页存的也算）。存不进浏览器的只记在页面里（memMk），并提醒先别关页。
  // 关页重开、再复习一遍、下一次评分都会接着补。每一天单独发、单独确认（过了半夜两天各记各的）
  const PMK = 'vocab_rmark_' + (() => { let h = 7; for (const ch of KEY) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); })() + '_';
  const memMk = new Map(), mkSending = new Set(), mkDone = new Set();   // 存不进浏览器的；正在发的；服务器已经确认的（周|日）
  let mkErr = '';
  let revDone = new Set();
  let listView = false, pin = null;                                    // 「看本周全部词」列表；pin = 从列表里点的那张卡（排在最前面）
  let saving = false, starting = false, submitting = false, syncing = false, stored = true, canStore = true, stale = null, lastSync = Date.now();
  let T = null, ans = [], qi = 0;                                      // 进行中的测验
  // 进行中的练习（练本次错题、再练一遍错的、组后小练）：不算成绩、不改错词本。PR = {id, items, res 每题的结果, qi, sel, busy, title, back 练完回哪个页签}
  let PR = null, prStarting = false, prSeq = 0, prPend = null;
  // 刷题页（第 36 步）：DS = {opts 服务器给的能选什么, err 没读到, scope 刷哪些词, lv/t/st 再筛（Set，空＝不筛）, n 选的题数, custom 自己填的, cnt 符合条件有几题}
  // dSeq：读取能选什么的请求编号；dcSeq：数「符合条件有几题」的请求编号（后发的才算数）
  let DS = null, dSeq = 0, dcSeq = 0, dcTimer = 0, dLoading = false;
  // 第 37 步：dPre＝从词表「带去刷题」带过来的范围和档（刷题页读到能选什么以后套上）
  let dPre = null;
  // 全部词表（第 37 步，在「进度」页里点进去，tab＝words）：WL = {lv、st 筛选（Set）, q 搜索, sort 排序, off 第几个起, mask 遮住哪几样, open 点开的格子, res 服务器给的一页, err, busy}
  // wlSeq：读词表的请求编号（后发的才算数；离开词表页就作废还没回来的）；wlTimer：打字搜索时等一会儿再读
  let WL = null, wlSeq = 0, wlTimer = 0, cardBusy = false;
  // 题型表现（「进度」页）：TY = {r 服务器给的, err}；tyAll：看「全部」还是「最近几天」；测验页每场按题型：TT = {open 展开的场次, res 场次 → 结果, busy 正在读的}
  // 错词来源（错词本）：ES = {words 词 → 来源, err}；ESF 来源、题型筛选
  let TY = null, tySeq = 0, tyAll = false, ES = null, esSeq = 0, taskOpen = false;
  const TT = { open: new Set(), res: new Map(), busy: new Set() }, ESF = { src: new Set(), t: new Set() };
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
  const pool = () => mode === 'rev' ? (D.review || []) : mode === 'round' ? (RD ? RD.cards : []) : cards();
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
    exSetKinds(d.ex || null);   // 拓展例句哪几类开着（第 34 步起学生页读取会给）：所有卡片同步
  }
  function start(d) { apply(d); resetQueue(); render(); flushMarks(); seenRetry(); }   // 上次没确认的打卡、没报上的「看过」：打开页面就补
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
  function resetQueue() {
    // 复习本轮进行中：重新读取、换日都不打断（还是这一周就接着复习）；换周了就退出
    if (mode === 'round') { if (RD && D && D.week && RD.week === D.week.id) return; mode = 'new'; RD = null; }
    queue = (mode === 'rev' ? revLeft() : mode === 'all' ? cards() : todo()).map(c => c.id); flipped = false; again = new Set();
  }
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
      mode = 'new'; RD = null; revDone = new Set(); apply(d); resetQueue(); render(); return;
    }
    if (dayChanged) {
      apply(d); if (!T) { resetQueue(); render(); }
      toast('新的一天，今天的复习和任务已经更新'); return;
    }
    // 同一天：别的设备可能学过。词单没变就只更新每张卡的状态，正在学的这一轮顺序不打乱
    const ids = x => (x.cards || []).map(c => c.id).join();
    if (ids(d) !== ids(D) || mode === 'rev') {
      if (T || (tab === 'study' && flipped)) { ['map', 'errbook', 'stats', 'class', 'history', 'tests', 'myplan', 'plans', 'req', 'ex', 'drill', 'wl', 'lq'].forEach(k => D[k] = d[k]); exSetKinds(d.ex || null); lastSync = Date.now(); return; }   // tday 和 review 是同一次读到的，要换一起换（这里不换 review，tday 也不换）
      apply(d); resetQueue(); render(); return;
    }
    const by = Object.fromEntries(d.cards.map(c => [c.id, c]));
    cards().forEach(c => { const n = by[c.id]; if (n) Object.assign(c, { st: n.st, done: n.done, again: n.again, wrong: n.wrong }); });
    ['map', 'errbook', 'stats', 'class', 'history', 'tests', 'review', 'week', 'myplan', 'plans', 'req', 'ex', 'drill', 'wl', 'lq', 'tday'].forEach(k => D[k] = d[k]);
    exSetKinds(d.ex || null);   // 同一天的局部重读也带上新的开关状态
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
    const tabs = [['study', '学习'], ['test', '测验'], ...(drillOn() || tab === 'drill' ? [['drill', '刷题']] : []), ['err', '错词本'], ['map', '进度']];
    return '<header class="top"><div class="wrap">' +
      '<div class="row"><div class="brand"><b>' + esc(D.me.name) + '</b><span>第 ' + w.no + ' 周 · ' + (L ? '学新词' : '回顾周') + ' · ' + md(w.start) + '～' + md(w.end) + (w.extended ? '（已延长）' : '') + '</span></div>' + (D.stats ? '<span class="chip' + (D.stats.streak ? ' ok' : '') + '">连续 ' + D.stats.streak + ' 天</span>' : '') + '</div>' +
      '<div class="seg" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (tab === k || (k === 'map' && (tab === 'words' || tab === 'listen' || tab === 'flash'))) + '">' + n + (k === 'err' && en ? ' ' + en : '') + '</button>').join('') + '</div>' +   // 全部词表、随身听、快刷在「进度」里面
      (L && tot && tab === 'study' && mode !== 'rev' && !w.waiting ? '<div class="prog"><span>本周练过 ' + done + ' / ' + tot + '</span><div class="track"><div class="fill" style="width:' + (done / tot * 100) + '%"></div></div></div>' : '') +
      '</div></header>';
  }

  // 第 38 步：只有画面换到别的东西（换页签、换一题、换一张卡、翻面）时才停掉正在播的声音；同一题、同一张卡重画（判完对错、后台刷新）不打断。
  // 随身听那一页自己管播放（离开时停）
  let lastAk = null, lqQuiet = false;
  const audKey = () => [tab, PR ? PR.id + ':' + PR.qi : '', T ? T.id + ':' + qi : '', tab === 'study' ? mode + ':' + (queue[0] || '') + ':' + flipped + ':' + listView : '',
    LQ && tab === 'flash' ? LQ.i + ':' + LQ.flip : ''].join('|');
  function render() {
    if (lqQuiet && (tab === 'listen' || tab === 'flash')) return;   // 第 38 步：随身听、快刷后台核对时只换数据（见 lqCheck）
    const ak = audKey(); if (ak !== lastAk) { lastAk = ak; if (tab !== 'listen') stopAudio(); }
    let body = '';
    if (PR) body = pracHTML();
    else if (tab === 'study') body = studyHTML();
    else if (tab === 'test') body = testHTML();
    else if (tab === 'drill') body = drillHTML();
    else if (tab === 'err') body = errHTML();
    else if (tab === 'words') body = wordsHTML();
    else if (tab === 'listen' || tab === 'flash') body = lqHTML();
    else body = mapHTML();
    $('app').innerHTML = header() + '<main class="wrap">' + (stale ? '<div class="warnbox">' + esc(stale) + ' <button class="gbtn" data-act="reload">重新读取</button></div>' : '') + body + '</main>';
    if (tab === 'test' && T && instant) needRes();
    if (PR) prSeen();
    if (tab === 'words' && !PR) wlPaint();
    acAuto();
  }
  // 练习、刷题翻到第 i 题：告诉服务器「学生看过这道题了」（周测优先出没见过的题型）。第 1 题服务器出题时已经记了；
  // 没报上（断网）的下次显示这一题时再报；不算作答、不进刷题统计
  // 没报上的记在 seenQ（练习编号|题号），网络恢复、下次画页面时补报；按练习编号＋题号去重。
  // 发送以前就先存进这个浏览器（名字按学生链接算的摘要，不存钥匙；只存练习编号＋题号，最多 200 条）：网卡住时马上关掉页面也不会漏，再打开会接着补报。
  // 第 37 步起每道题单独一个浏览器条目（名字＝前缀＋练习编号_题号，值＝存的时间）：同一个学生开着几个标签页同时存、同时删，也只动自己那一条，
  // 不会像以前一份列表那样被另一页写回去盖掉。报上了、或者服务器明确拒绝了，只删这一条。存不进浏览器就只记在页面里。
  // 以前（第 36 步网页）存的一份列表：读到就拆成每题一条再删掉
  const PSEEN = 'vocab_seenq_' + PMK.slice(12), PSEEN1 = 'vocab_seen1_' + PMK.slice(12);
  const seenQ = new Map(), seenOk = new Set(), seenTry = new Set();
  const seenKeys = () => { const ks = []; try { for (let j = 0; j < localStorage.length; j++) { const k = localStorage.key(j); if (k && k.startsWith(PSEEN1)) ks.push(k); } } catch (e) {} return ks; };
  const seenLS = () => {
    try {
      const old = localStorage.getItem(PSEEN);
      if (old !== null) {
        let v = []; try { v = JSON.parse(old); } catch (e) {}
        if (Array.isArray(v)) v.forEach(x => { if (Array.isArray(x) && typeof x[0] === 'string' && Number.isInteger(x[1]) && x[1] >= 0) localStorage.setItem(PSEEN1 + x[0] + '_' + x[1], String(Date.now())); });
        localStorage.removeItem(PSEEN);
      }
    } catch (e) {}
    const out = [];
    for (const k of seenKeys()) { const m = k.slice(PSEEN1.length).match(/^(.+)_(\d+)$/); if (m) out.push([m[1], +m[2]]); }
    return out;
  };
  const seenPut = (pid, i) => {
    try {
      localStorage.setItem(PSEEN1 + pid + '_' + i, String(Date.now()));
      const ks = seenKeys();
      if (ks.length > 200) ks.map(k => [k, Number(localStorage.getItem(k)) || 0]).sort((a, b) => a[1] - b[1]).slice(0, ks.length - 200).forEach(([k]) => localStorage.removeItem(k));   // 最多留 200 条：删最早的
    } catch (e) {}
  };
  const seenDel = (pid, i) => { try { localStorage.removeItem(PSEEN1 + pid + '_' + i); } catch (e) {} };
  const seenWait = new Map();   // 服务器说「太忙了、过一会儿再来」（429 等）的题 → 那一次的时间：10 秒以内不再补报
  function seenSend(pid, i) {
    const key = pid + '|' + i;
    if (seenOk.has(key) || seenTry.has(key)) return;
    seenTry.add(key); seenQ.set(key, [pid, i]); seenPut(pid, i);   // 先记下（页面里＋浏览器里），报上了再删
    if (seenWait.has(key) && Date.now() - seenWait.get(key) < 10000) { seenTry.delete(key); return; }
    rpc('stu_practice', { act: 'seen', a: { pid, i } }, { obj: true, timeout: 15000 })
      .then(r => { seenWait.delete(key); if (r && (r.state === 'ok' || r.state === 'off')) { seenOk.add(key); seenQ.delete(key); seenDel(pid, i); } },
            e => {
              if (e && [408, 425, 429].includes(e.status)) seenWait.set(key, Date.now());   // 太忙了：留着，过一会儿再补
              else if (e && e.status >= 400 && e.status < 500 && /找不到这次练习|没有这道题|参数不对/.test(e.message || '')) { seenQ.delete(key); seenDel(pid, i); }   // 服务器明确说这次练习没了、题号不对：以后也报不上，删掉
              else if (e && e.status >= 400 && e.status < 500) seenWait.set(key, Date.now());   // 别的拒绝（一时说不清能不能成）：留着，隔一会儿再补
            })   // 其他（断网、超时、服务器出错）留着下次补
      .finally(() => seenTry.delete(key));
  }
  // 补报：页面里记的＋浏览器里存的（可能是别的标签页、或者上次关掉的页面留下的）
  function seenRetry() { for (const [pid, i] of seenLS()) seenQ.set(pid + '|' + i, [pid, i]); for (const [pid, i] of [...seenQ.values()]) seenSend(pid, i); }
  function prSeen() {
    if (PR && !PR.ended && PR.qi > 0 && PR.qi < PR.items.length) seenSend(PR.id, PR.qi);
    seenRetry();
  }
  window.addEventListener('online', () => { if ($('app').dataset.role !== 'adm') seenRetry(); });

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
      if (!queue.length) return '<div class="card"><h2>今天的复习做完了</h2><div class="muted">「会了」的词会隔得越来越久再出现；「不会」「不太确定」的明天再来。</div><div class="form"><button class="btn main" data-act="back">' + (w.kind === 'L' && todo().length ? '继续学本周的词' : '好的') + '</button>' + groupBtn() + '</div></div>';
      return cardHTML(pool().find(x => x.id === queue[0]), '复习');
    }
    if (mode === 'round') return roundHTML();
    const top = taskHTML() + revBox();   // 第 37 步：最上面是「本周任务」（点开看明细）
    if (w.kind === 'R') return top + (roundNone === w.id
      // 0 张：只说本轮没有可复习的词；回顾测和别的测验合成一场时，再叫学生去「测验」看安排（单独一场回顾测没有题，不叫学生去考）
      ? '<div class="box"><h2>这周是回顾周</h2><div class="muted">这周不学新词。本轮没有可复习的词。' + revGuide() + '</div>' + markNote() +
        (revMerged() ? '<div class="form"><button class="btn" data-tab="test">' + revBtn() + '</button></div>' : '') + '</div>'
      : '<div class="box"><h2>这周是回顾周</h2><div class="muted">这周不学新词。先把这一轮学过的词翻卡复习一遍，再去「测验」做' + revTxt() + '。复习本轮不算成绩，回顾测才算。</div>' + markNote() +
        '<div class="form"><button class="btn main" data-act="round">复习本轮学过的词</button><button class="btn" data-tab="test">' + revBtn() + '</button></div></div>') +
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
        '<button class="btn" data-act="list">看本周全部词，挑一个再练</button>' + groupBtn() +
        '</div></div>';
    }
    return (flipped ? '' : top + weekLine()) + cardHTML(cards().find(x => x.id === queue[0]), '');
  }
  // 复习本轮：上面一行写清范围、不算成绩；复习完了给「去回顾测」「再复习一遍」
  function roundHTML() {
    const n = RD.cards.length, a = RD.lo, z = RD.hi - 1, rng = a < z ? '第 ' + a + '～' + z + ' 周' : a === z ? '第 ' + a + ' 周' : '这一轮';
    if (!queue.length) {
      const tested = (D.tests || []).some(x => x.done && (x.parts || []).includes('review'));
      return '<div class="card"><h2>本轮的 ' + n + ' 个词复习完了</h2><div class="muted">复习本轮不算成绩，回顾测才算。' + (tested ? '回顾测已经考完了。' : '准备好了就去「测验」做' + revTxt() + '。') + '</div>' + markNote() +
        '<div class="form">' + (tested ? '' : '<button class="btn main" data-tab="test">' + revBtn() + '</button>') + '<button class="btn" data-act="round">再复习一遍</button>' + groupBtn() + '<button class="btn" data-act="back">返回</button></div></div>';
    }
    return (flipped ? '' : '<div class="wkline"><span class="muted">复习本轮：' + rng + '学过的 ' + n + ' 个词 · 不算成绩，回顾测才算</span><button type="button" class="gbtn" data-act="back">结束复习</button></div>') +
      cardHTML(RD.cards.find(x => x.id === queue[0]), '复习本轮') + markNote();
  }
  // 这周回顾测的那一场（可能和季度测、年测合成一场）：名称、及格线和「测验」页一样
  const revT = () => (D.tests || []).find(x => (x.parts || [x.kind]).includes('review'));
  const revMerged = () => { const x = revT(); return !!x && (x.parts || []).length > 1; };
  function revTxt() { const x = revT(); return x ? '「' + tName(x) + '」（从学过的词里抽题，答对 ' + num(x.pass, 95) + '% 及格）' : '回顾测（安排见「测验」）'; }
  const revBtn = () => revMerged() ? '去测验' : '去回顾测';
  const revGuide = () => revMerged() ? '这周的回顾测和' + revT().parts.filter(p => p !== 'review').map(p => KN[p]).join('、') + '合成一场，去「测验」看安排。' : '';
  // 复习本轮的打卡：还有没确认的打卡时显示（正在记／没记上＋重试打卡）
  function markNote() {
    const p = mkList(); if (!D || !D.week || !p.length) return '';
    if (memMk.size) return '<div id="mkst" class="warnbox">这条打卡还没保存在浏览器，先别关页，联网后点重试<button type="button" class="gbtn" data-act="remark">重试打卡</button></div>';
    if (p.every(x => mkSending.has(mkId(x)))) return '<div id="mkst" class="muted small center">正在记打卡…</div>';
    const days = p.map(x => x.d === D.week.today ? '今天' : md(x.d)).join('、');
    return '<div id="mkst" class="warnbox">' + esc(days) + '的打卡还没记上' + (mkErr ? '（' + esc(mkErr) + '）' : '') + '<button type="button" class="gbtn" data-act="remark">重试打卡</button></div>';
  }
  // 打卡状态变了：卡片正面直接重画；翻到背面时只换掉那一行（不打断正在播的读音）
  function markShow() {
    if (tab !== 'study' || T) return;
    if (!flipped) { render(); return; }
    const el = $('mkst'), h = markNote();
    if (el) el.outerHTML = h; else if (h) { const m = document.querySelector('main'); if (m) m.insertAdjacentHTML('beforeend', h); }
  }
  function cardHTML(c, tag) {
    if (!c) { resetQueue(); return '<div class="box"><h2>这张卡找不到了</h2><div><button class="btn" data-act="reload">重新读取</button></div></div>'; }
    if (!flipped) {
      const left = mode === 'rev' ? '今天的复习还剩 ' + queue.length + ' 个' : mode === 'round' ? '本轮复习还剩 ' + queue.length + ' 个' : mode === 'all' ? '这一遍还剩 ' + queue.length + ' 个' : '本周还剩 ' + todo().length + ' 个没练完';
      return '<div class="card front" id="front" tabindex="0" role="button" aria-label="翻面看答案"><div class="chips"><span class="chip">' + esc(c.lvl) + '</span>' +
        (tag ? '<span class="chip ok">' + tag + '</span>' : '') + (again.has(c.id) || c.again ? '<span class="chip bad">' + (mode === 'round' ? '再看一次' : '今天再练一次') + '</span>' : '') +
        (c.src === 'carry' ? '<span class="chip warn">上周错词</span>' : c.wrong > 0 ? '<span class="chip warn">错过的词</span>' : '') + '</div>' +
        '<div class="big" lang="ja">' + esc(c.w) + '</div><div class="hint">先想一想意思，再点一下翻面</div></div>' +
        '<div class="bar one"><button class="btn main" data-act="flip">翻面看答案 <span class="k">空格</span></button></div>' +
        '<div class="muted center">' + left + '</div>';
    }
    return '<div class="card">' + cardBack(c) + '</div>' +
      '<div class="bar"><button class="btn no" data-rate="no">不会 <span class="k">1</span></button><button class="btn" data-rate="mid">不太确定 <span class="k">2</span></button><button class="btn ok" data-rate="ok">会了 <span class="k">3</span></button></div>' +
      '<div class="muted small center">' + (mode === 'round' ? '「不会」「不太确定」的词，这次复习里还会再出现；复习本轮不算成绩，回顾测才算' : '「不会」「不太确定」的词，今天还会再出现') + '</div>';
  }
  function flip() { if (!queue.length || flipped || listView || tab !== 'study') return; flipped = true; render(); play(aud(queue[0])); }
  // 先存好再翻到下一张：没存上就留在这张，可以再点一次
  async function rate(a) {
    if (!flipped || !queue.length || saving) return;
    const id = queue[0], m0 = mode, D0 = D, c = pool().find(x => x.id === id);
    // 复习本轮不存评分。第 37 步起本周词单的卡每次评分都存（「从头再过一遍」、从列表点回来的练过的卡点「会了」也存），服务器记下最近一次学这个词的时间；
    // 服务器只在这张卡这周第一次练时打卡，页面上的连续天数也只在那时加
    const need = mode === 'rev' ? !revDone.has(id) : mode === 'round' ? false : !!c, first = mode === 'rev' || (!!c && !c.done);
    if (need) {
      saving = true; document.querySelectorAll('[data-rate]').forEach(b => b.disabled = true);
      try { if (mode === 'rev') await rpc('stu_review', { wid: id, rating: a }); else await rpc('stu_rate', { wid: id, rating: a }); }
      catch (e) {
        saving = false; document.querySelectorAll('[data-rate]').forEach(b => b.disabled = false);
        if (/不在本周的词单|还没开始|停用|换掉/.test(e.message)) { toast(e.message); reload(); return; }
        toast('没存上：' + e.message + '。再点一次试试'); return;
      }
      saving = false;
      // 等回复的时候页面数据已经换过了（重新读取、换日、换周）：新数据里已经是服务器的状态，什么都不改
      if (D !== D0) { render(); return; }
      if (m0 === 'rev') revDone.add(id);
      else if (c) { if (c.st === 'assigned') c.st = 'learned'; if (!c.done) { c.done = true; D.week.done = num(D.week.done) + 1; } c.again = a !== 'ok'; }
      if (first) bumpStreak();
      // 换了学习方式、或者队首已经不是这张：只记下结果，不动现在的队列
      if (mode !== m0 || queue[0] !== id) { render(); return; }
    }
    if (mode === 'round') {   // 评分的这一天要打卡：服务器已经有这一天的记录（学生页读到的、或者确认过的）就不用
      const day = tokyoToday() || D.week.today;
      if (!(day === D.week.today && D.stats && (D.stats.last30 || []).includes(day))) mkAdd(RD.week, day);
      flushMarks();   // 还有没确认的（以前的、别的标签页的）也一起补发
    }
    stopAudio();
    queue.shift(); if (pin === id) pin = null;
    // 「不会」「不太确定」放回队列稍后再出现；复习本轮里同一个词只放回一次（第二次评分后就过去了）
    if (a !== 'ok' && !(mode === 'round' && again.has(id))) { again.add(id); queue.splice(Math.min(a === 'no' ? 2 : 5, queue.length), 0, id); if (queue.length === 1) toast('只剩这一个词了，再来一次'); }
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
  // 复习本轮：点按钮时才读这一轮学过的词（范围和回顾测一样）；读不到、已经不是回顾周就提示
  // 取卡最多等 15 秒；等的时候学生转去做别的（换页签、复习、再过一遍……）这次请求就作废，回来的结果不用
  async function startRound(btn) {
    if (roundBusy) return;
    const my = ++roundReq; roundBusy = true; busy(btn, true);
    let r;
    try { r = await rpc('stu_round', { act: 'load' }, { obj: true, timeout: WAIT }); }
    catch (e) {
      if (my !== roundReq) return;
      roundBusy = false; busy(btn, false);
      if (/不是回顾周|还没开始|过完了|换了/.test(e.message)) { toast(e.message); reload(); } else fail(e);
      return;
    }
    if (my !== roundReq) return;
    roundBusy = false;
    if (!D.week || r.week !== D.week.id) { reload(); return; }   // 读的时候已经换周了：重新读取学生页
    if (!Array.isArray(r.cards) || !r.cards.length) { roundNone = D.week.id; render(); toast('本轮没有可复习的词'); return; }
    roundNone = null;
    RD = { week: r.week, lo: num(r.lo), hi: num(r.hi), cards: r.cards };
    if (r.today) mkDone.add(r.week + '|' + r.day);
    mode = 'round'; listView = false; pin = null; queue = RD.cards.map(c => c.id); flipped = false; again = new Set();
    render(); window.scrollTo({ top: 0 });
    if (r.day !== D.week.today) reload();   // 服务器已经是新的一天：按服务器的日期重新读取（复习接着进行）
    flushMarks();                            // 上一轮没确认的打卡接着补
  }
  const dropRound = () => { if (roundBusy) { roundReq++; roundBusy = false; } };
  const mkId = x => x.w + '|' + x.d;
  // 这个学生所有没确认的打卡：浏览器里存的（每次重新扫，别的标签页存的也算）＋只记在页面里的
  function mkList() {
    const out = new Map();
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), m = k && k.startsWith(PMK) ? k.slice(PMK.length).match(/^(.+)_(\d{4}-\d{2}-\d{2})$/) : null; if (m) out.set(m[1] + '|' + m[2], { w: m[1], d: m[2] }); } } catch (e) {}
    for (const [id, x] of memMk) out.set(id, x);
    return [...out.values()];
  }
  function mkAdd(w, d) {
    const id = w + '|' + d; if (mkDone.has(id)) return;
    try { localStorage.setItem(PMK + w + '_' + d, '1'); memMk.delete(id); } catch (e) { memMk.set(id, { w, d }); }   // 存不进浏览器：只记在页面里
  }
  function mkDrop(x) { memMk.delete(mkId(x)); try { localStorage.removeItem(PMK + x.w + '_' + x.d); } catch (e) {} }   // 只删这一条
  // 把没确认的打卡逐条发出去（每一条：哪一周、评分的哪一天；同一条同时只发一次）。只打卡，不记学习记录；服务器同一天只记一次，可以放心重试。
  // 确认了才删掉那一条；没连上、15 秒没回复就留着，显示「重试打卡」，下一次评分、重开页面、再复习一遍都会再发。
  // 那一周已经过完、日期不在那个回顾周里：补不上了，删掉并提示。服务器的今天和页面上的不一样（过了半夜）就重新读取
  function flushMarks() {
    if (!D || !D.week || $('app').dataset.role === 'adm') return;
    const p = mkList();
    for (const x of p) {
      const id = mkId(x); if (mkSending.has(id)) continue;
      mkSending.add(id); mkErr = '';
      rpc('stu_round', { act: 'mark', wk: x.w, rd: x.d }, { obj: true, timeout: WAIT }).then(r => {
        mkSending.delete(id); mkDrop(x);
        if (r.ok === false) { toast(md(x.d) + (r.why ? '：' + r.why : '的打卡没法补记')); markShow(); return; }   // 没有依据的以前的日子：服务器不记，删掉这一条
        mkDone.add(x.w + '|' + r.day);
        if (r.today !== D.week.today) { reload(); return; }
        if (r.day === D.week.today) bumpStreak(); else refreshSide();   // 补记的是前几天：重新读一下连续天数
        markShow();
      }, e => {
        mkSending.delete(id);
        if (/不在这个回顾周|已经换了|过完了|不是回顾周|还没开始/.test(e.message)) {
          mkDrop(x); toast(md(x.d) + '的打卡没能补上：' + e.message);
          if (mode === 'round' && /已经换了|过完了|不是回顾周/.test(e.message)) { reload(); return; }
        } else mkErr = e.message;
        markShow();
      });
    }
    if (p.length) markShow();
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
          (has37() && x.id ? '<div class="small">' + ttBtn(x.id) + (TT.open.has(x.id) ? '<div class="ttbox" data-ttbox="' + esc(x.id) + '">' + ttHTML(x.id) + '</div>' : '') + '</div>' : '') +
          ((x.parts || []).includes('week') && !(x.passed || x.manual) ? '<div class="muted">错的词会按老师的设置带到下一周再学。</div>' : '') +
          (x.id && num(x.total) > num(x.score) ? '<div><button class="btn" data-act="ptest" data-tid="' + esc(x.id) + '">练本次错题（' + (num(x.total) - num(x.score)) + ' 题）</button> <span class="small muted">不算成绩</span></div>' : '') +
          (x.id && x.redo ? '<div><button class="btn" data-act="pretest" data-tid="' + esc(x.id) + '">整卷再做一遍（' + num(x.total) + ' 题）</button> <span class="small muted">原题再做，不算成绩</span></div>' : '') + '</div>';
      } else {
        const before = list.slice(0, i).some(y => !y.done);
        h += '<div class="card"><h2>' + tName(x) + '</h2><div class="muted tdesc">' + tDesc(x) + '</div>' +
          '<div><button class="btn main" data-act="tstart" data-kd="' + esc(x.kind) + '"' + (before ? ' disabled' : '') + '>' + (x.started ? '接着考' : '开始') + '</button>' + (before ? ' <span class="muted">先考完上面那场</span>' : '') + '</div></div>';
      }
    });
    if (list.length && list.every(x => x.done)) h += '<div class="muted">' + md(addDays(w.end, 1)) + '自动进入下一周。' + (D.errbook.length ? ' <button class="link" data-tab="err">看错词本</button>' : '') + '</div>';
    if ((D.history || []).length) {
      h += '<div class="box"><h2>以前的成绩</h2><div class="scroll"><table class="t hist"><tr><th>周</th><th>类型</th><th>成绩</th><th>结果</th></tr>' +
        D.history.map(x => '<tr><td>第 ' + num(x.no) + ' 周</td><td>' + esc(KN[x.kind] || x.kind) + '</td><td>' + (x.total ? num(x.score) + ' / ' + num(x.total) : '没考') + '</td><td>' +
          (x.total ? (x.passed ? '<span class="chip ok">及格</span>' : x.manual ? '<span class="chip">放行</span>' : '<span class="chip bad">没及格</span>') : '—') +
          (x.prac && x.id && num(x.total) > num(x.score) ? ' <button type="button" class="link" data-act="ptest" data-tid="' + esc(x.id) + '">练错题</button>' : '') +
          (x.redo && x.id && num(x.total) ? ' <button type="button" class="link" data-act="pretest" data-tid="' + esc(x.id) + '">整卷再做</button>' : '') +
          (x.id && num(x.total) ? ttBtn(x.id, '按题型') : '') + '</td></tr>' +
          (x.id && TT.open.has(x.id) ? '<tr class="ttrow"><td colspan="4"><div class="ttbox" data-ttbox="' + esc(x.id) + '">' + ttHTML(x.id) + '</div></td></tr>' : '')).join('') + '</table></div>' +
        '<div class="small muted">「练错题」：拿那场错的词换一道题再练（最近交卷的 5 场可以练）。' + (D.drill && num(D.drill.retest) ? '「整卷再做」：整张卷子原题再做一遍（最近交卷的 ' + num(D.drill.retest) + ' 场可以做）。' : '') + '都不算成绩、不改错词本。' + (has37() ? '「按题型」：这场每种题型对了几题。' : '') + '</div></div>';
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
      syncStar(r);
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
    ac: '听读音，选出它的中文意思（点喇叭可以重播）',
  };
  const qText = it => it.s ? (it.t === 'kr' ? '画线的词在这句里怎么读？' : '画线的词在这句里是什么意思？') : (QT[it.t] || '');
  const isJ = t => ['yomi', 'hyoki', 'bunmyaku', 'iikae', 'yoho'].includes(t);
  const sentHTML = (q, cls) => '<div class="qs' + (cls || '') + '" lang="ja">' + rb(q).replace(/（　）/g, '<span class="blank">（　　）</span>') + '</div>';
  // 第 38 步：听音选意思——题面不写这个词，只有一个大喇叭（出题时自动播一次，点了重播）和「慢速再听」；答完才显示写法、读音、意思
  const acStem = it => '<div class="acq"><button type="button" class="say acbig" data-audio="' + esc(aud(it.id)) + '" aria-label="听读音（点一下重播）">' + SPK + '</button>' +
    '<button type="button" class="gbtn" data-audio="' + esc(aud(it.id)) + '" data-spd="' + SLOW + '">慢速再听</button></div>';
  const acCard = (it, rs) => it && it.t === 'ac' && rs && rs.card && rs.card.w ? '<div class="acw"><div class="head"><span class="w" lang="ja">' + esc(rs.card.w) + '</span>' + (rs.card.r && rs.card.r !== rs.card.w ? '<span class="r" lang="ja">' + esc(rs.card.r) + '</span>' : '') +
    sayBtn(aud(it.id), '再听一遍') + slowBtn(aud(it.id), '慢速再听一遍') + '</div><div class="acm">' + esc(rs.card.m) + '</div></div>' : '';
  const stemHTML = it => it.t === 'ac' ? acStem(it) : it.s ? sentHTML(it.s) : isJ(it.t) && it.t !== 'yoho' ? sentHTML(it.q)
    : '<div class="q' + (it.t === 'cj' ? ' zhq' : '') + '" lang="' + (it.t === 'cj' ? 'zh' : 'ja') + '">' + esc(it.q) + '</div>';
  const optHTML = (it, o) => isJ(it.t) ? rb(o) : esc(o);
  const jpOpt = t => t !== 'jc' && t !== 'ac';
  // 听音题第一次显示（还没答）时自动播一次读音；同一题重画不再播（手机浏览器不让自动播时会提示点喇叭）。听音题只在练习、刷题里有（正式测验不出）
  let lastAuto = '';
  function acAuto() {
    let it = null, key = '';
    if (PR && tab === PR.back && !PR.ended && PR.qi < PR.items.length) { it = PR.items[PR.qi]; if (it && it.t === 'ac' && !PR.res[PR.qi] && !(PR.skip && PR.skip.has(PR.qi))) key = 'p' + PR.id + ':' + PR.qi; }
    if (!key || key === lastAuto) return;
    lastAuto = key; play(aud(it.id));
  }
  // rs：当场判过的结果（选的标红/绿、正确的标绿）；lock：这题的选项不能再点
  // 题目上方的「N3 ★★★★」（第 36 步：测验、练习、刷题都有；老师关了「显示档和难度星级」就不显示——服务器那时根本不给档和星；旧数据库没给就不显示）
  const starOn = () => !(D && D.drill && D.drill.star === false);
  const syncStar = r => { if (r && typeof r.star === 'boolean' && D && D.drill) D.drill.star = r.star; };   // 出题、开考、刷题页的回复带着现在的设置
  function badge(it) {
    if (!it || !it.lv || !LV.includes(it.lv) || !starOn()) return '';
    const s = Number.isInteger(it.st) && it.st >= 1 && it.st <= 5 ? it.st : 0;
    return '<div class="qlv"><span class="lvb">' + esc(it.lv) + '</span>' + (s ? '<span class="stars" role="img" aria-label="难度 ' + s + ' 星（满 5 星，同一档里比）">' + '★'.repeat(s) + '<span class="off">' + '★'.repeat(5 - s) + '</span></span>' : '') + '</div>';
  }
  function qBody(it, sel, rs, lock) {
    return badge(it) + '<div class="muted">' + qText(it) + '</div>' + stemHTML(it) +
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
    resultModal(r, tid);
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
  function resultModal(r, tid) {
    const tot = num(r.total), sc = num(r.score), pct = tot ? Math.floor(sc * 100 / tot) : 0, wr = r.wrong || [];
    const m = modal('<h2>' + (r.passed ? '及格了！' : '这次没及格') + '</h2><div class="stats"><div class="stat"><b>' + sc + ' / ' + tot + '</b><span>答对</span></div><div class="stat"><b>' + pct + '%</b><span>正确率</span></div><div class="stat"><b>' + num(r.pass, 95) + '%</b><span>及格线</span></div></div>' +
      (wr.length && tid ? '<div class="form"><button class="btn main" id="rpr">练本次错题（' + wr.length + ' 个）</button><span class="small muted">换一道题再练，当场判对错；不算成绩、不改错词本</span></div>' : '') +
      (tid && D.drill && num(D.drill.retest) ? '<div class="form"><button class="btn" id="rrt">整卷再做一遍（' + tot + ' 题）</button><span class="small muted">整张卷子原题再做，当场判对错、有解析；不算成绩</span></div>' : '') +
      (wr.length ? '<div class="lab">答错的 ' + wr.length + ' 个（已放进错词本），下面是每道错题的解析</div>' + reviewHTML(r) : '<div class="muted">全部答对了。</div>') +
      '<button class="btn' + (wr.length && tid ? '' : ' main') + '" data-close>好的</button>');
    const b = m.querySelector('#rpr'); if (b) b.addEventListener('click', () => { m.close(); pStart({ tid }, '练本次错题', 'test'); });
    const b2 = m.querySelector('#rrt'); if (b2) b2.addEventListener('click', () => { m.close(); pStart({ rid: tid }, '整卷再做一遍', 'test'); });
  }

  // ── 练习（练本次错题、再练一遍错的、组后小练）：当场判对错、显示解析；不算成绩、不改错词本、不改本周练过数 ──
  // 学完一组（翻完本周的词、复习完）以后：这次点了「不会」「不太确定」的词可以只练这些
  function groupBtn() {
    const ids = [...again].filter(id => pool().some(c => c.id === id) || cards().some(c => c.id === id)).slice(0, 40);
    return ids.length ? '<button class="btn" data-act="pgroup">只练不太确定/不会的词（' + ids.length + ' 个）</button>' : '';
  }
  // 请求编号：网络没回复时再点一次，服务器认出是同一个请求，给回同一份练习（不多存一份）
  const uid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  const prStop = () => { PR = null; prSeq++; prStarting = false; };   // 退出、切页：还没回来的出题回复作废
  async function pStart(a, title, back) {
    if (prStarting) return;
    const key = JSON.stringify(a), req = prPend && prPend.key === key ? prPend.req : uid(), my = ++prSeq;
    prPend = { key, req }; prStarting = true; unlockAudio();
    let r; try { r = await rpc('stu_practice', { act: 'start', a: Object.assign({ req, cv: CV }, a) }, { obj: true }); }   // 第 38 步：带上网页版本（20 以上才出听音题）
    catch (e) { if (my !== prSeq) return; prStarting = false; if (e.status >= 400 && e.status < 500) prPend = null; fail(e); return; }   // 服务器明确拒绝才换新编号；网络断了、服务器出错（不知道建没建）下次沿用同一个编号
    if (my !== prSeq) return;                        // 等的时候已经切到别的页签或退出了：不再拉回练习
    prStarting = false; prPend = null; syncStar(r);
    if (r && r.state === 'exam') { toast(r.msg || '先交卷，再继续练习'); return; }
    if (!r || r.state !== 'ok' || !Array.isArray(r.items) || !r.items.length) { toast((r && r.msg) || '没有要练的词'); return; }
    PR = { id: r.id, items: r.items, res: new Array(r.items.length).fill(null), qi: 0, sel: null, busy: false, title, back: back || tab,
           tid: a.tid, rid: a.rid, part: num(r.part), more: num(r.more) };
    tab = PR.back; render(); window.scrollTo({ top: 0 });
  }
  function pracHTML() {
    const n = PR.items.length;
    if (PR.kind === 'drill') return drillRunHTML();
    if (PR.qi >= n) {
      const done = PR.res.filter(Boolean).length, right = PR.res.filter(x => x && x.ok).length;
      return '<div class="card"><h2>练完了</h2><div class="stats"><div class="stat"><b>' + done + '</b><span>这次练了</span></div><div class="stat"><b>' + right + '</b><span>答对</span></div></div>' +
        '<div class="muted">练习不算成绩，也不改错词本的次数。</div><div class="form">' +
        (done > right ? '<button class="btn main" data-act="pagain">再练一遍错的（' + (done - right) + ' 个）</button>' : '') +
        (PR.more ? '<button class="btn' + (done > right ? '' : ' main') + '" data-act="pmore">' + (PR.rid ? '接着做下一组（还有 ' + PR.more + ' 题）' : '接着练下一组（还有 ' + PR.more + ' 个）') + '</button>' : '') +
        '<button class="btn' + (done > right || PR.more ? '' : ' main') + '" data-act="pexit">返回</button></div></div>';
    }
    const it = PR.items[PR.qi], rs = PR.res[PR.qi], sk = skipped();
    const vd = rs ? '<div class="vd ' + (rs.ok ? 'ok' : 'bad') + '" role="status">' + (rs.ok ? '答对了' : '答错了，正确答案是第 ' + (rs.a + 1) + ' 个') + '</div>' + (rs.why ? '<div class="why">' + esc(rs.why) + '</div>' : '') + acCard(it, rs)
      : sk ? '<div class="vd warn" role="status">老师暂时关掉了「听音选意思」，这题不判了，点「下一题」跳过</div>'
      : PR.busy ? '<div class="vd muted" role="status">正在判……</div>' : '<div class="small muted">选了马上告诉你对不对</div>';
    return '<div class="wkline"><span class="muted">' + esc(PR.title) + (PR.more || PR.part ? '（第 ' + (PR.part + 1) + ' 组）' : '') + ' · 第 ' + (PR.qi + 1) + ' / ' + n + ' 题 · 不算成绩</span><button type="button" class="gbtn" data-act="pexit">结束练习</button></div>' +
      (PR.more && PR.qi === 0 ? '<div class="small muted">' + (PR.rid ? '这张卷题比较多：这一组 ' + n + ' 题，还有 ' + PR.more + ' 题，做完可以接着做下一组。' : '错的词比较多：本次 ' + n + ' 个，还有 ' + PR.more + ' 个，练完可以接着练下一组。') + '</div>' : '') +
      '<div class="card">' + qBody(it, PR.sel, rs, !!rs || PR.busy || sk) + vd + '</div>' +
      '<div class="bar two"><button class="btn" data-act="pprev"' + (PR.qi === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<button class="btn' + (rs || sk ? ' main' : '') + '" data-act="pnext"' + (rs || sk ? '' : ' disabled') + '>' + (PR.qi === n - 1 ? '看结果' : '下一题') + '</button></div>';
  }
  const skipped = () => !!(PR && PR.skip && PR.skip.has(PR.qi));   // 第 38 步：老师关了听音选意思、不再判的那道听音题
  async function pAnswer(j) {
    if (!PR || PR.busy || PR.res[PR.qi] || skipped()) return;
    const my = PR, i = PR.qi;
    PR.busy = true; PR.sel = j; render();
    let r = null, err = null;
    try { r = await rpc('stu_practice', { act: 'answer', a: { pid: my.id, i, choice: j } }, { obj: true }); } catch (e) { err = e; }
    if (PR !== my) return;                         // 等的时候已经退出或换了一次练习
    PR.busy = false;
    if (!err && r && r.state === 'off' && r.ac) { PR.sel = null; (PR.skip = PR.skip || new Set()).add(i); toast(r.msg || '老师暂时关掉了「听音选意思」，这道题跳过'); }   // 第 38 步：只是这道听音题不判了，可以跳过
    else if (!err && r && (r.state === 'exam' || r.state === 'off')) { PR.sel = null; toast(r.msg || '先交卷，再继续练习'); }
    else if (!err && r && r.i === i && Number.isInteger(r.a)) { PR.res[i] = r; PR.sel = r.mine; }
    else { PR.sel = null; toast('没判上：' + (err ? err.message : '回复不对') + '，再点一次'); }   // 服务器已经记下的话，再点会回第一次的结果
    if (tab === PR.back) render();
  }

  // ── 刷题（第 36 步）：自己选刷哪些词、再筛档/题型/难度、这次做多少；当场判对错、显示解析。不算成绩、不进错词本、不算打卡 ──
  const drillOn = () => !!(D && D.drill && D.drill.on);
  const SCN = { learned: ['学过的词', '学习记录里学过的'], err: ['错词本里的词', '测验答错过的'], dwrong: ['我刷题时错过的', '刷题时最近一次做错的'], week: ['本周的词', '这一周词单里的'], all: ['全部', '学习范围里所有的词（含没学过的）＋学过的词＋本周词单'] };
  const NSET = [10, 20, 50, 100];
  const ORD = [['fresh', '优先没做过的', '先出你没见过的题'], ['done', '只出做过的题', '只从你答过的题里出，复习用'], ['rand', '全部随机', '不管做没做过']];
  // 读「能选什么」：每次进刷题页读一次（各范围的词数会变）；后发的请求才算数，切走了也照样记下（不会把页面拉回来）
  async function dLoad() {
    const my = ++dSeq; dLoading = true;
    if (tab === 'drill' && !PR) render();
    let r = null, err = null;
    try { r = await rpc('stu_drill', { act: 'opts', a: {} }, { obj: true }); } catch (e) { err = e; }
    if (my !== dSeq) return;
    dLoading = false;
    syncStar(r);
    if (err) { DS = Object.assign(DS || {}, { err: err.message }); }
    else {
      const old = DS || {}, sc = (r.scopes || []).filter(x => x && SCN[x.k]);
      const okSc = k => sc.some(x => x.k === k && x.on && num(x.n) > 0);
      // 档：学生选过的档（含从词表带过来、现在刷不了、还等着学生重新选的）一直保住，直到学生自己重新选或者点「改成全部档」——
      // 选过的档现在一个都刷不了时不会悄悄变成「不限档」（那样会刷到别的档），先停住
      const okLv = l => (r.lv || []).includes(l);
      let lvKeep = [...(old.lv || [])].filter(okLv), lvBad = null;
      if (old.lvBad) { const back = old.lvBad.filter(okLv); if (back.length) lvKeep = back; else lvBad = old.lvBad.slice(); }
      else if (old.lv && old.lv.size && !lvKeep.length) lvBad = [...old.lv];
      // 范围：从词表带过来、但现在不能刷的范围（scopeWant）也一直等着：那个范围恢复了就用它，不然不自动换成别的范围，等学生自己选
      const scopeWant = old.scopeWant && !okSc(old.scopeWant) ? old.scopeWant : null;
      const scope0 = old.scopeWant ? (okSc(old.scopeWant) ? old.scopeWant : null) : okSc(old.scope) ? old.scope : (['learned', 'week', 'err', 'dwrong', 'all'].find(okSc) || null);
      DS = { opts: r, err: null, scope: scope0, scopeWant, lvBad, lvGone: scopeWant ? old.lvGone || null : null,
             lv: new Set(lvKeep), t: new Set([...(old.t || [])].filter(t => JN.some(([k]) => k === t) || (t === 'ac' && (acAvail(r) || r.state !== 'ok')))),
             acGone: r.state === 'ok' && !acAvail(r) && ((old.t && old.t.has('ac')) || !!old.acGone),   // 第 38 步：选过听音选意思、老师刚关掉了（学生自己再点题型以前一直提示）
             st: new Set(r.star === false ? [] : (old.st || [])),   // 老师关了「显示档和难度星级」：之前选的星级条件清掉（页面上也不显示这个筛选）
             n: old.n || null, custom: old.custom || '', cnt: null,
             order: old.order && r.orders && r.orders[old.order] ? old.order : (r.order || 'fresh') };   // 出题方式：上次选的还开着就接着用，不然用老师设的默认
      const mx = num(r.max, 100), ns = NSET.filter(x => x <= mx);   // 默认 20 题；上限比 20 小就用能选的最大的那个（都没有就用上限）
      if (!DS.n || DS.n > mx) DS.n = ns.includes(20) ? 20 : ns.length ? ns[ns.length - 1] : mx;
      // 第 37 步：从词表「带去刷题」：档和范围分开核对（题型、难度清掉，免得看不见的条件把题筛没了）。
      //   档：照词表选的带过来；一档都刷不了就停住等学生重新选档（不会变成「不限档」）。
      //   范围：老师没开放、或者现在没有能刷的词，就不选任何范围、等学生自己选（档照样保住，不会因为范围不能用就丢掉）。
      // 刷题暂停（开考没交卷）、老师暂时关了刷题：先不带，等能刷的时候再核对
      if (dPre && r.state === 'ok') {
        const p = dPre, x = sc.find(y => y.k === p.scope); dPre = null;
        DS.t = new Set(); DS.st = new Set();
        const want = p.lv || [], lvs = want.filter(l => (r.lv || []).includes(l)), gone = want.filter(l => !lvs.includes(l));
        DS.lv = new Set(lvs); DS.lvBad = want.length && !lvs.length ? want.slice() : null; DS.lvGone = lvs.length && gone.length ? gone : null;   // lvGone：带过来、但暂时刷不了的那几档（提示用）
        const scOk = !!x && x.on && num(x.n) > 0;
        DS.scope = scOk ? p.scope : null; DS.scopeWant = scOk ? null : p.scope;
        const lvTxt = lvs.length ? '、' + lvs.join('、') + (gone.length ? '（' + gone.join('、') + ' 暂时刷不了）' : '') : '';
        // 范围不能用：分别写清哪些档保留了、哪些档暂时刷不了（只有一部分能刷时，不说「全部保留」）
        const keepTxt = !want.length ? '' : lvs.length ? '（你选的档里 ' + lvs.join('、') + ' 已经保留' + (gone.length ? '，' + gone.join('、') + ' 暂时刷不了' : '') + '）' : '（你选的 ' + want.join('、') + ' 暂时都刷不了，档也请重新选）';
        if (!scOk) toast('「' + SCN[p.scope][0] + '」' + (!x || !x.on ? '老师现在没有开放' : '现在没有能刷的词') + '：请在上面选一个范围' + keepTxt);
        else if (DS.lvBad) toast('你在词表选的 ' + want.join('、') + ' 现在没有能刷的题，请在「档」里重新选');
        else toast('已按词表的筛选选好：「' + SCN[p.scope][0] + '」' + lvTxt);
      }
      if (r.state === 'ok') dCount();
    }
    if (tab === 'drill' && !PR) render();
  }
  const dWant = () => { if (!DS) return null; if (DS.custom !== '') { const v = Number(DS.custom); return Number.isInteger(v) && v >= 1 && v <= num(DS.opts && DS.opts.max, 100) ? v : null; } return DS.n; };
  // 第 38 步：服务器说这个学生能选「听音选意思」（老师开着、数据库跑过第 38 步）
  const acAvail = o => !!(o && Array.isArray(o.types) && o.types.includes('ac'));
  const dArgs = () => Object.assign({ scope: DS.scope, lv: [...DS.lv], t: [...DS.t], order: DS.order || 'fresh' }, DS.opts && DS.opts.star === false ? {} : { st: [...DS.st].sort() });
  // 数「符合条件有几题」：选项一变就等 250 毫秒再数（后发的才算数）
  function dCount() {
    clearTimeout(dcTimer);
    if (!DS || !DS.scope) return;
    const my = ++dcSeq; DS.cnt = null; dPaint();
    dcTimer = setTimeout(async () => {
      let r = null; try { r = await rpc('stu_drill', { act: 'count', a: Object.assign({ cv: CV }, dArgs()) }, { obj: true }); } catch (e) { r = { err: e.message }; }   // 第 38 步：带上网页版本
      if (my !== dcSeq || !DS) return;
      DS.cnt = r; dPaint();
    }, 250);
  }
  // 只更新「符合条件」那一行和开始按钮（自己填数字时不重画整页，输入框不会跳）
  function dPaint() {
    const c = $('dcnt'), b = $('dgo'); if (!c || !b || !DS) return;
    const want = dWant(), cnt = DS.cnt, mx = num(DS.opts && DS.opts.max, 100);
    let t = '';
    if (dPre) {   // 从词表「带去刷题」：服务器还没回、或者没读到——这时页面上的范围和档还是旧的，不能开始
      c.innerHTML = DS.err ? '<span class="bad">没读到（' + esc(DS.err) + '），词表的筛选还没带过来</span> <button type="button" class="gbtn" data-act="dreload">再试一次</button>' : '正在按词表的筛选选好范围和档……';
      b.disabled = true; b.textContent = '稍等，正在选好'; return;
    }
    if (DS.lvBad) {   // 选的档（从词表带过来的、或者以前选的）现在都刷不了：不开始，等学生重新选档（或者点「改成全部档」）
      c.innerHTML = '<span class="bad">你选的 ' + esc(DS.lvBad.join('、')) + ' 现在没有能刷的题。</span>请在上面「档」里重新选 <button type="button" class="gbtn" data-act="dlvall">改成全部档</button>';
      b.disabled = true; b.textContent = '先重新选档'; return;
    }
    if (!DS.scope && DS.scopeWant) {   // 从词表带过来的范围现在不能刷：档已经保住，等学生自己选一个范围
      c.innerHTML = '<span class="bad">从词表带过来的「' + esc(SCN[DS.scopeWant] ? SCN[DS.scopeWant][0] : DS.scopeWant) + '」现在不能刷（老师没开放、或者没有能刷的词）。</span>请在上面「刷哪些词」里选一个' +
        (DS.lv.size ? '，你选的档里 ' + esc([...DS.lv].join('、')) + ' 已经保留' : '') + (DS.lvGone && DS.lvGone.length ? '，' + esc(DS.lvGone.join('、')) + ' 暂时刷不了' : '');
      b.disabled = true; b.textContent = '先选刷哪些词'; return;
    }
    if (!DS.scope) t = '先选上面「刷哪些词」';
    else if (!cnt) t = '正在数符合条件的题……';
    else if (cnt.err) t = '没数出来（' + esc(cnt.err) + '），可以直接点开始';
    else if (cnt.state && cnt.state !== 'ok') t = esc(cnt.msg || '');
    else t = '符合条件：<b>' + num(cnt.n) + '</b> 题（' + num(cnt.words) + ' 个词，同一个词这次最多 ' + num(cnt.per, 1) + ' 题）' + (want && num(cnt.n) < want && num(cnt.n) > 0 ? '。只有 ' + num(cnt.n) + ' 题，就做这 ' + num(cnt.n) + ' 题' : '')
      + (num(cnt.n) === 0 && cnt.order === 'done' ? '。「只出做过的题」只从你答过的题里出，这个范围里你还没答过题' + (DS.opts && DS.opts.orders && (DS.opts.orders.fresh || DS.opts.orders.rand) ? '，可以换个范围或者换出题方式' : '，可以换个范围') : '');
    if (DS.custom !== '' && !want) t += '<br><span class="bad">自己填的题数要在 1～' + mx + ' 之间</span>';
    if (DS.t.has('ac') && DS.st.size) t += '<br><span class="small">「听音选意思」没有难度星级：选了难度，就只出 JLPT 题型</span>';   // 第 38 步
    if (DS.acGone) t += '<br><span class="small">老师暂时关掉了「听音选意思」，题型里已经去掉了</span>';
    c.innerHTML = t;
    const zero = cnt && !cnt.err && cnt.state === 'ok' && num(cnt.n) === 0;
    b.disabled = prStarting || !DS.scope || !want || zero;
    b.textContent = prStarting ? '正在出题……' : zero ? '没有符合条件的题' : '开始刷题' + (want ? '（' + (cnt && !cnt.err && num(cnt.n) < want ? num(cnt.n) : want) + ' 题）' : '');
  }
  function drillHTML() {
    if (!drillOn()) return '<div class="box"><h2>刷题</h2><div class="muted">老师暂时没有开放刷题。</div></div>';
    if (!DS || (!DS.opts && !DS.err)) { if (!dLoading) setTimeout(dLoad, 0); return '<div class="box"><h2>刷题</h2><div class="muted">正在读取……</div></div>'; }
    if (!DS.opts) return '<div class="box"><h2>刷题</h2><div class="warnbox">没读到：' + esc(DS.err) + ' <button type="button" class="gbtn" data-act="dreload">重新读取</button></div></div>';
    const o = DS.opts;
    if (o.state === 'exam') return '<div class="box"><h2>刷题</h2><div class="warnbox">' + esc(o.msg || '先交卷，再继续刷题') + '</div><div><button type="button" class="btn main" data-tab="test">去测验</button> <button type="button" class="gbtn" data-act="dreload">交完了，再看看</button></div></div>';
    if (o.state !== 'ok') return '<div class="box"><h2>刷题</h2><div class="muted">' + esc(o.msg || '老师暂时没有开放刷题') + '</div></div>';
    const mx = num(o.max, 100), mine = o.mine || {}, sc = (o.scopes || []).filter(x => x && SCN[x.k] && x.on);
    let h = '<div class="note dnote">刷题<b>不算成绩、不进错词本、不算打卡</b>（本周练过数也不变）。答错的只记在刷题记录里，可以在「我刷题时错过的」里再刷。' +
      (num(mine.n) ? '你一共刷了 ' + num(mine.n) + ' 题，答对 ' + Math.round(num(mine.right) * 100 / num(mine.n)) + '%。' : '') + '</div>';
    h += '<div class="box drill"><h2>刷哪些词</h2><div class="dscs" role="group" aria-label="刷哪些词">' + (sc.length ? sc.map(x => '<button type="button" class="dsc" data-dsc="' + x.k + '" aria-pressed="' + (DS.scope === x.k) + '"' + (num(x.n) ? '' : ' disabled') + '><span><b>' + SCN[x.k][0] + '</b><small>' + SCN[x.k][1] + '</small></span><span class="n">' + num(x.n) + ' 个词</span></button>').join('') : '<div class="muted">老师没有开放可以选的范围。</div>') + '</div>';
    const ords = ORD.filter(([k]) => !o.orders || o.orders[k]);
    if (ords.length > 1) h += '<h2>出题方式</h2><div class="dords" role="group" aria-label="出题方式">' + ords.map(([k, nm, sub]) => '<button type="button" class="ck dord" data-dord="' + k + '" aria-pressed="' + (DS.order === k) + '"><b>' + nm + '</b><small>' + sub + '</small></button>').join('') + '</div>';
    else if (ords.length === 1) h += '<div class="small muted dord1">出题方式：<b>' + ords[0][1] + '</b>（老师设的：' + ords[0][2] + '）</div>';
    h += '<h2>再筛 <small>可以不选＝都要</small></h2>' +
      '<div class="dfl"><span class="lab">档</span><div class="checks">' + (o.lv || []).map(l => '<button type="button" class="ck" data-dlv="' + l + '" aria-pressed="' + DS.lv.has(l) + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="dfl"><span class="lab">题型' + (acAvail(o) ? ' <small>不选＝5 种 JLPT 题型都要；「听音选意思」要听读音，想刷就点上它</small>' : '') + '</span><div class="checks">' + JN.map(([k, nm]) => '<button type="button" class="ck" data-dt="' + k + '" aria-pressed="' + DS.t.has(k) + '" lang="ja">' + nm + '</button>').join('') +
        (acAvail(o) ? '<button type="button" class="ck dac" data-dt="ac" aria-pressed="' + DS.t.has('ac') + '">听音选意思</button>' : '') + '</div></div>' +   // 第 38 步
      (o.star !== false ? '<div class="dfl"><span class="lab">难度 <small>同一档里比，1 星最容易</small></span><div class="checks">' + [1, 2, 3, 4, 5].map(s => '<button type="button" class="ck dst" data-dst="' + s + '" aria-pressed="' + DS.st.has(s) + '" aria-label="' + s + ' 星">' + '★'.repeat(s) + '</button>').join('') + '</div></div>' : '');
    h += '<h2>这次做多少 <small>最多 ' + mx + ' 题，题目随机</small></h2><div class="dnum">' + NSET.filter(x => x <= mx).map(x => '<button type="button" class="ck" data-dn="' + x + '" aria-pressed="' + (DS.custom === '' && DS.n === x) + '">' + x + ' 题</button>').join('') +
      '<label class="dcus">自己填<input id="dcustom" type="number" inputmode="numeric" min="1" max="' + mx + '" value="' + esc(DS.custom) + '" placeholder="1～' + mx + '" aria-label="自己填这次做多少题"></label></div>' +
      '<div class="dbar"><div class="small muted" id="dcnt" role="status" aria-live="polite"></div>' +
      '<button type="button" class="btn main dgo" id="dgo" data-act="dstart" disabled>开始刷题</button></div></div>';   // 「符合条件」和开始按钮贴在屏幕底下（手机上不用滚到最下面）
    setTimeout(dPaint, 0);
    return h;
  }
  // 出一份刷题：带请求编号（网络没回复再点，服务器给回同一份）；等的时候切走了就不再拉回来
  async function dStart(a, title) {
    if (prStarting) return;
    const key = 'drill|' + JSON.stringify(a), req = prPend && prPend.key === key ? prPend.req : uid(), my = ++prSeq;
    prPend = { key, req }; prStarting = true; dPaint(); unlockAudio();
    let r; try { r = await rpc('stu_drill', { act: 'start', a: Object.assign({ req, cv: CV }, a) }, { obj: true }); }   // 第 38 步：带上网页版本（20 以上才出听音题）
    catch (e) { if (my !== prSeq) return; prStarting = false; if (e.status >= 400 && e.status < 500) prPend = null; fail(e); dPaint(); return; }
    if (my !== prSeq) return;
    prStarting = false; prPend = null; syncStar(r);
    if (r && (r.state === 'exam' || r.state === 'off')) { toast(r.msg || '先交卷，再继续刷题'); DS = Object.assign(DS || {}, { opts: r }); if (tab === 'drill' && !PR) render(); return; }
    if (!r || r.state !== 'ok' || !Array.isArray(r.items) || !r.items.length) { toast((r && r.msg) || '没有符合条件的题'); dPaint(); return; }
    PR = { id: r.id, items: r.items, res: new Array(r.items.length).fill(null), qi: 0, sel: null, busy: false, title, back: 'drill', kind: 'drill',
           asked: num(r.asked, r.items.length), avail: num(r.avail, r.items.length), args: a.pid ? null : a, again: !!a.pid, all: !!a.all, ended: false };
    tab = 'drill'; render(); window.scrollTo({ top: 0 });
  }
  function drillRunHTML() {
    const n = PR.items.length, done = PR.res.filter(Boolean).length;
    if (PR.qi >= n || PR.ended) {
      const right = PR.res.filter(x => x && x.ok).length, by = {};
      PR.items.forEach((it, i) => { const r = PR.res[i]; if (!r) return; const b = by[it.t] || (by[it.t] = [0, 0]); b[0]++; if (r.ok) b[1]++; });
      const rows = TN.filter(([k]) => by[k]).map(([k, nm]) => '<tr><td' + (isJ(k) ? ' lang="ja"' : '') + '>' + nm + '</td><td>' + by[k][1] + ' / ' + by[k][0] + '</td><td>' + Math.round(by[k][1] * 100 / by[k][0]) + '%</td></tr>').join('');   // 第 38 步：听音选意思也按名字写
      const other = Object.keys(by).filter(k => !TN.some(([j]) => j === k));
      return '<div class="card"><h2>' + (PR.ended && done < n ? '这次刷到这里' : '刷完了') + '</h2><div class="stats"><div class="stat"><b>' + done + '</b><span>这次做了' + (done < n ? '（共 ' + n + ' 题）' : '') + '</span></div><div class="stat"><b>' + right + '</b><span>答对</span></div><div class="stat"><b>' + (done ? Math.round(right * 100 / done) : 0) + '%</b><span>正确率</span></div></div>' +
        (rows || other.length ? '<div class="scroll"><table class="t"><tr><th>题型</th><th>答对</th><th>正确率</th></tr>' + rows + other.map(k => '<tr><td>其他</td><td>' + by[k][1] + ' / ' + by[k][0] + '</td><td>' + Math.round(by[k][1] * 100 / by[k][0]) + '%</td></tr>').join('') + '</table></div>' : '') +
        '<div class="muted">刷题不算成绩、不进错词本、不算打卡' + (done < n ? '；没做的题不算' : '') + '。</div><div class="form">' +
        (done > right ? '<button class="btn main" data-act="dagain">再刷一遍做错的（' + (done - right) + ' 题）</button>' : '') +
        '<button class="btn' + (done > right ? '' : ' main') + '" data-act="dall">再刷一遍这组（' + n + ' 题）</button>' +
        (PR.args ? '<button class="btn" data-act="dmore">同样的条件再刷一组</button>' : '') +
        '<button class="btn" data-act="pexit">返回刷题设置</button></div></div>';
    }
    const it = PR.items[PR.qi], rs = PR.res[PR.qi], sk = skipped();
    const vd = rs ? '<div class="vd ' + (rs.ok ? 'ok' : 'bad') + '" role="status">' + (rs.ok ? '答对了' : '答错了，正确答案是第 ' + (rs.a + 1) + ' 个') + '</div>' + (rs.why ? '<div class="why">' + esc(rs.why) + '</div>' : '') + acCard(it, rs)
      : sk ? '<div class="vd warn" role="status">老师暂时关掉了「听音选意思」，这题不判了，点「下一题」跳过</div>'
      : PR.busy ? '<div class="vd muted" role="status">正在判……</div>' : '<div class="small muted">选了马上告诉你对不对</div>';
    return '<div class="wkline"><span class="muted">' + esc(PR.title) + ' · 第 ' + (PR.qi + 1) + ' / ' + n + ' 题 · 已做 ' + done + ' · 不算成绩</span><button type="button" class="gbtn" data-act="dend"' + (PR.busy ? ' disabled' : '') + '>结束</button></div>' +
      (PR.qi === 0 && PR.avail < PR.asked ? '<div class="note">' + (PR.again ? '上一组' + (PR.all ? '一共 ' : '做错 ') + PR.asked + ' 题，老师改了设置以后现在还能刷 ' + PR.avail + ' 题' : '符合条件的只有 ' + PR.avail + ' 题') + '，这次就做这 ' + n + ' 题。</div>'
        : PR.qi === 0 && n < Math.min(PR.avail, PR.asked) ? '<div class="note">老师设的每次最多 ' + n + ' 题，这次先做这 ' + n + ' 题。</div>' : '') +
      '<div class="card">' + qBody(it, PR.sel, rs, !!rs || PR.busy || sk) + vd + '</div>' +
      '<div class="bar two"><button class="btn" data-act="pprev"' + (PR.qi === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<button class="btn' + (rs || sk ? ' main' : '') + '" data-act="pnext"' + (rs || sk ? '' : ' disabled') + '>' + (PR.qi === n - 1 ? '看结果' : '下一题') + '</button></div>';
  }

  // ── 第 37 步：数据库跑过第 37 步才有（学生页读取会给 wl）；没有就不显示词表、题型表现、错词来源（新网页先上线时照常能用）──
  const has37 = () => !!(D && D.wl && typeof D.wl === 'object');
  const wlOn = () => has37() && D.wl.on !== false;
  // 题型的中文名（测验、刷题都用）：前 5 种是 JLPT 题型，后 3 种是简单题
  const TN = [['yomi', '漢字読み'], ['hyoki', '表記'], ['bunmyaku', '文脈規定'], ['iikae', '言い換え'], ['yoho', '用法'], ['jc', '看日语选中文'], ['cj', '看中文选日语'], ['kr', '看汉字选读音'], ['ac', '听音选意思']];
  const tName2 = t => (TN.find(([k]) => k === t) || [, '其他'])[1];
  const pct = (a, b) => num(b) ? Math.round(num(a) * 100 / num(b)) + '%' : '—';
  const partsName = pp => String(pp || '').split('+').filter(Boolean).map(p => KN[p] || p).join('＋') || '测验';

  // ── 全部词表：进「进度」页点「全部词表」才读（学生页打开时不读）；只读：看卡不改学习记录、不算练过 ──
  const WST = [['new', '没学过'], ['week', '本周在学'], ['rev', '学过（复习中）'], ['done', '已掌握'], ['wrong', '在错词本']];
  const WSORT = [['ord', '学习顺序'], ['lv', '档'], ['recent', '最近学过']];
  const WMASK = [['w', '遮住写法'], ['r', '遮住读音'], ['m', '遮住中文']];
  const WMK = 'vocab_wlmask';   // 遮挡开关记在这个浏览器（只是方便，存不了也照常用）
  function wlInit() {
    if (WL) return;
    let mk = { w: false, r: false, m: false };
    try { const v = JSON.parse(localStorage.getItem(WMK) || 'null'); if (v && typeof v === 'object') mk = { w: v.w === true, r: v.r === true, m: v.m === true }; } catch (e) {}
    WL = { lv: new Set(), st: new Set(), q: '', sort: 'ord', off: 0, mask: mk, open: new Set(), res: null, err: null, busy: false };
  }
  const wlArgs = () => ({ lv: [...WL.lv], st: [...WL.st], q: WL.q, sort: WL.sort, off: WL.off });
  // 读一页：后发的才算数；离开词表页时作废（wlDrop），回来再读
  function wlLoad(delay) {
    wlInit(); clearTimeout(wlTimer);
    const my = ++wlSeq; WL.busy = true;
    lqSeq++; lqLoading = false;   // 第 38 步：换了筛选、排序、重新核对：还在读的「随身听／快刷这些词」那一批作废，并且马上放开它占着的按钮（旧批次晚到的回复直接丢掉，不再动按钮）
    const go = async () => {
      if (my !== wlSeq) return;
      let r = null, err = null;
      try { r = await rpc('stu_info', { act: 'list', a: wlArgs() }, { obj: true, timeout: 20000 }); } catch (e) { err = e; }
      if (my !== wlSeq || !WL) return;
      WL.busy = false;
      let seeNew = false;
      if (err) { WL.err = err.message; WL.res = null; }   // 没读到：旧的一页也不留（可能已经开考、或者老师改了范围）
      else if (r.state === 'ok' && !Array.isArray(r.rows)) { WL.err = '没有读到内容，请再试一次'; WL.res = null; }
      else if (r.state === 'ok' && !r.rows.length && num(r.off) > 0 && num(r.total) > 0) { WL.off = Math.floor((num(r.total) - 1) / num(r.size, 100)) * num(r.size, 100); wlLoad(); return; }   // 翻到的那一页已经没有了（词变少了）：回到最后一页
      else {
        WL.err = null; WL.res = r;
        // 开没开以服务器这一次的回复为准：关了就记关；老师又开放了、这次读到了词，就恢复（不会一直记着「关闭」）
        if (r.state === 'off' && D.wl) D.wl.on = false;
        if (r.state === 'ok' && D.wl && D.wl.on === false) { D.wl.on = true; seeNew = true; }
        // 服务器这次按的范围（老师刚改了「没学过的词能不能看」）和页面上的不一样：说明、「没学过」筛选跟着这次的范围重画
        if (r.state === 'ok' && D.wl && (r.see === 'all' || r.see === 'learned') && D.wl.see !== r.see) { D.wl.see = r.see; seeNew = true; }
      }
      if (r && r.state !== 'ok') document.querySelectorAll('.modal.wcm').forEach(m => m.close ? m.close() : m.remove());   // 开考了、关掉了：开着的卡也收起
      // 现在显示的是「没有开放」「先交卷」那种整页提示（没有列表区）、或者开关／范围变了：整页重画（读取失败时按钮也恢复、写上没读到）；不然只换列表区
      if (tab === 'words' && !PR) { if ((r && r.state !== 'ok') || seeNew || !$('wlres')) render(); else wlPaint(); }
    };
    if (delay) wlTimer = setTimeout(go, delay); else go();
    if (tab === 'words' && !PR) wlPaint();
  }
  const wlDrop = () => { wlSeq++; clearTimeout(wlTimer); if (WL) WL.busy = false; cardBusy = false; lqSeq++; lqLoading = false; };   // 第 38 步：还没读完的「随身听／快刷这些词」也作废
  // 重新核对：进词表、从别的标签页／别的应用回到这一页时，先清掉上次的整页（筛选、遮挡开关留着），等服务器这次说能看再画
  // （中间可能开了考、老师改了范围或关了词表）
  function wlRecheck() {
    if (tab !== 'words' || !WL || PR) return;
    WL.res = null; WL.err = null; WL.open.clear(); WL.busy = true;
    document.querySelectorAll('.modal.wcm').forEach(m => m.close ? m.close() : m.remove());
    render(); wlLoad();
  }
  // 离开这一页（切到别的标签页、别的应用）时记下「回来要重新核对」；回来时第一次就清页、收卡、重新读（不管离开多久）。
  // 一次回来浏览器会连着发「看得见了」「拿到焦点」两个事件：第一个已经核对过，第二个就不再发请求
  let wlStale = false;
  const wlAway = () => { if (tab === 'words') wlStale = true; };
  const wlBack = () => { if (document.visibilityState !== 'visible' || !wlStale) return; wlStale = false; if (tab === 'words') wlRecheck(); };
  document.addEventListener('visibilitychange', () => { if ($('app').dataset.role === 'adm') return; if (document.visibilityState === 'hidden') wlAway(); else wlBack(); });
  window.addEventListener('blur', () => { if ($('app').dataset.role !== 'adm') wlAway(); });
  window.addEventListener('focus', () => { if ($('app').dataset.role !== 'adm') wlBack(); });
  // 一个格子：遮住时点一下显示、再点一下遮回
  function wlCell(id, k, txt, cls) {
    const key = id + '|' + k, lj = k === 'm' ? '' : ' lang="ja"';
    if (!WL.mask[k]) return k === 'w' ? '<button type="button" class="ww' + (cls || '') + '" data-wcard="' + esc(id) + '"' + lj + ' aria-label="看「' + esc(txt) + '」这张卡">' + esc(txt) + '</button>' : '<span class="w' + k + (cls || '') + '"' + lj + '>' + esc(txt) + '</span>';
    const open = WL.open.has(key), nm = { w: '写法', r: '读音', m: '中文' }[k];
    return '<button type="button" class="wmask w' + k + (open ? ' shown' : '') + '" data-wrev="' + esc(key) + '"' + (open ? lj : '') + ' aria-label="' + (open ? '再点一下遮回' + nm : '点一下显示' + nm) + '">' + (open ? esc(txt) : '点一下显示') + '</button>';
  }
  const stChip = s => ({ week: '<span class="chip">本周在学</span>', rev: '<span class="chip wst">复习中</span>', done: '<span class="chip ok">已掌握</span>', new: '<span class="chip wst">没学过</span>' }[s] || '');
  function wlRow(x) {
    return '<div class="wrow"><div class="wr1">' + wlCell(x.id, 'w', x.w) + (x.r && x.r !== x.w ? wlCell(x.id, 'r', x.r) : '') +    /* 写法就是假名的词不另写读音 */'<span class="wtags"><span class="chip wst">' + esc(x.lvl) + '</span>' + stChip(x.s) +
      (num(x.e) ? '<span class="chip warn">错 ' + num(x.e) + ' 次</span>' : '') + (x.off ? '<span class="chip">已停用</span>' : '') + '</span></div>' +
      '<div class="wr2">' + wlCell(x.id, 'm', x.m) + '<button type="button" class="gbtn wcard" data-wcard="' + esc(x.id) + '">看卡</button></div></div>';
  }
  // 带去刷题：只能按刷题现有的范围＋档带过去（全部／错词本里的词／本周的词）；带不过去时写明原因
  function wlDrill() {
    if (!drillOn()) return null;
    if (WL.q) return { why: '搜索出来的词不能直接带去刷题（刷题只能按范围和档选）' };
    const st = [...WL.st], see = WL.res && WL.res.see;
    const sc = !st.length ? (see === 'learned' ? null : 'all') : st.length === 1 && st[0] === 'wrong' ? 'err' : st.length === 1 && st[0] === 'week' ? 'week' : null;
    if (!sc) return { why: !st.length ? '老师设了词表只看学过的词，「全部」带不过去；可以只选「在错词本」或「本周在学」再带' : '刷题只能按「全部」「错词本里的词」「本周的词」加档来选：状态不选、或者只选「在错词本」「本周在学」其中一项，就能带过去' };
    return { scope: sc, lv: [...WL.lv] };
  }
  function wordsHTML() {
    wlInit();
    if (!has37()) return '<div class="box"><h2>全部词表</h2><div class="muted">要等数据库更新以后才能用。</div><div><button type="button" class="btn" data-tab="map">返回进度</button></div></div>';
    const r = WL.res;
    // 「没有开放」：点「再看看」时按钮先灰、写正在看；没读到（断网、超时）就恢复按钮、写没读到，可以原地再点
    if (!wlOn() || (r && r.state === 'off')) return '<div class="box"><h2>全部词表</h2><div class="muted">' + esc((r && r.msg) || '老师暂时没有开放词表') + (WL.busy ? '（正在重新看一下……）' : '') + '</div>' +
      (WL.err && !WL.busy ? '<div class="warnbox">没读到（' + esc(WL.err) + '），请再点一次「再看看」</div>' : '') +
      '<div class="form"><button type="button" class="btn" data-act="wreload"' + (WL.busy ? ' disabled' : '') + '>再看看</button><button type="button" class="btn" data-tab="map">返回进度</button></div></div>';
    if (r && r.state === 'exam') return '<div class="box"><h2>全部词表</h2><div class="warnbox">' + esc(r.msg || '先交卷，再看词表') + '</div><div class="form"><button type="button" class="btn main" data-tab="test">去测验</button><button type="button" class="btn" data-act="wreload">交完了，再看看</button><button type="button" class="btn" data-tab="map">返回进度</button></div></div>';
    return '<div class="box wl37"><div class="row"><h2 class="lh">全部词表</h2><button type="button" class="gbtn" data-tab="map">返回进度</button></div>' +
      '<div class="small muted">看卡、遮住自测都不算学习记录。' + (D.wl.see === 'learned' ? '老师设了只看学过的和本周的词。' : '学习范围里还没学的词也列出来了。') + '</div>' +
      '<input id="wq" class="wq" type="search" maxlength="30" placeholder="搜索：写法、读音、中文都行" value="' + esc(WL.q) + '" aria-label="搜索词表" autocomplete="off" spellcheck="false">' +
      '<div class="wmk" id="wlmask"><span class="lab">遮住自测</span>' + WMASK.map(([k, n]) => '<button type="button" class="ck" data-wm="' + k + '" aria-pressed="' + !!WL.mask[k] + '">' + n + '</button>').join('') + '</div>' +
      '<details class="wlf" id="wlf"' + (WL.fopen ? ' open' : '') + '><summary><span class="lab">筛选、排序</span><span class="small muted" id="wlfs"></span></summary>' +
      '<div class="wfr"><span class="lab">档</span><div class="checks" id="wllv"></div></div>' +
      '<div class="wfr"><span class="lab">状态<br><small>可多选</small></span><div class="checks" id="wlst"></div></div>' +
      '<div class="wfr"><span class="lab">排序</span><div class="seg wsort" role="group" aria-label="排序">' + WSORT.map(([k, n]) => '<button type="button" data-wsort="' + k + '" aria-pressed="' + (WL.sort === k) + '">' + n + '</button>').join('') + '</div></div></details>' +
      '<div class="small muted">遮住的格子点一下显示，再点一下遮回。</div>' +
      '<div id="wlres"></div></div>';
  }
  // 只换掉会变的部分（搜索框不动：打字时不会跳）
  function wlPaint() {
    if (tab !== 'words' || !WL || !$('wlres')) return;
    const r = WL.res && WL.res.state === 'ok' ? WL.res : null, cn = r ? r.counts || {} : {}, lvs = r ? r.lvs || {} : {};
    const lvList = LV.filter(l => lvs[l] || WL.lv.has(l));
    $('wllv').innerHTML = (lvList.length ? lvList : LV).map(l => '<button type="button" class="ck" data-wlv="' + l + '" aria-pressed="' + WL.lv.has(l) + '">' + l + (lvs[l] ? '<small> ' + num(lvs[l]) + '</small>' : '') + '</button>').join('');
    $('wlst').innerHTML = WST.filter(([k]) => !(k === 'new' && D.wl.see === 'learned' && !WL.st.has('new'))).map(([k, n]) => '<button type="button" class="ck" data-wst="' + k + '" aria-pressed="' + WL.st.has(k) + '">' + n + (r ? '<small> ' + num(cn[k]) + '</small>' : '') + '</button>').join('');
    document.querySelectorAll('[data-wsort]').forEach(b => b.setAttribute('aria-pressed', String(WL.sort === b.dataset.wsort)));
    const fs = $('wlfs'); if (fs) fs.textContent = (WL.lv.size ? LV.filter(l => WL.lv.has(l)).join('、') : '全部档') + ' · ' + (WL.st.size ? WST.filter(([k]) => WL.st.has(k)).map(([, n]) => n).join('、') : '全部状态') + ' · ' + (WSORT.find(([k]) => k === WL.sort) || [, ''])[1];
    document.querySelectorAll('[data-wm]').forEach(b => b.setAttribute('aria-pressed', String(!!WL.mask[b.dataset.wm])));
    let h = '';
    if (WL.err) h += '<div class="warnbox">没读到：' + esc(WL.err) + ' <button type="button" class="gbtn" data-act="wreload">再试一次</button></div>';
    if (!r) { $('wlres').innerHTML = h + (WL.err ? '' : '<div class="muted">正在读取……</div>'); return; }
    const tot = num(r.total), off = num(r.off), size = num(r.size, 100), rows = r.rows || [];
    const pager = tot > size ? '<div class="row wpg"><button type="button" class="gbtn" data-wpg="' + Math.max(0, off - size) + '"' + (off > 0 && !WL.busy ? '' : ' disabled') + '>上一页</button><span class="small muted">第 ' + (off + 1) + '～' + Math.min(tot, off + size) + ' 个</span><button type="button" class="gbtn" data-wpg="' + (off + size) + '"' + (off + size < tot && !WL.busy ? '' : ' disabled') + '>下一页</button></div>' : '';
    const dr = wlDrill();
    h += '<div class="row wsum"><span class="small muted" role="status">' + (WL.busy ? '正在读取…… ' : '') + '符合条件 <b>' + tot + '</b> 个（词表一共 ' + num(r.all) + ' 个）</span>' +
      (dr ? '<button type="button" class="gbtn" data-act="wdrill"' + (dr.scope && tot ? '' : ' disabled') + '>带去刷题</button>' : '') +
      (has38() && tot ? (lsOn() ? '<button type="button" class="gbtn" data-wlq="listen"' + (lqLoading || WL.busy ? ' disabled' : '') + '>随身听</button>' : '') + (qfOn() ? '<button type="button" class="gbtn" data-wlq="flash"' + (lqLoading || WL.busy ? ' disabled' : '') + '>快刷</button>' : '') : '') + '</div>' +   // 第 38 步：筛选还在读的时候先灰着
      (has38() && tot > LQMAX && (lsOn() || qfOn()) ? '<div class="small muted">从词表带去随身听、快刷一次最多带前 ' + LQMAX + ' 个（按现在的排序）；想听后面的，换个排序或多筛几个条件。</div>' : '') +
      (dr && dr.why ? '<div class="small muted">' + esc(dr.why) + '</div>' : '') +
      (WL.sort === 'recent' ? '<div class="small muted">「最近学过」按最近一次在学习页练、每天复习这个词的时间排；以前的记录没记时间的排在后面。</div>' : '') + pager +
      (rows.length ? '<div class="wlist">' + rows.map(wlRow).join('') + '</div>' : '<div class="muted">没有符合条件的词。' + (WL.q || WL.lv.size || WL.st.size ? '少选几个条件试试。' : '') + '</div>') + pager;
    $('wlres').innerHTML = h;
  }
  // 看一张卡（和学习页同样的卡面）；只看，不改学习记录、不算练过。等的时候离开了词表页就不弹
  async function wlCard(id) {
    if (cardBusy) return;
    cardBusy = true; const my = wlSeq;
    let r = null, err = null;
    try { r = await rpc('stu_info', { act: 'card', a: { id } }, { obj: true, timeout: 20000 }); } catch (e) { err = e; }
    cardBusy = false;
    if (my !== wlSeq || tab !== 'words' || PR) return;
    if (err) { fail(err); return; }
    if (!r || r.state !== 'ok' || !r.card) { if (r && (r.state === 'exam' || r.state === 'off')) { WL.res = r; render(); } toast((r && r.msg) || '没读到这张卡'); return; }
    const c = r.card;
    quiet();
    const m = modal('<div class="row"><h2>' + esc(c.w) + ' <small class="muted">' + esc(c.lvl) + '</small></h2><button type="button" class="gbtn" data-close>关闭</button></div>' +
      '<div class="card wcardm">' + cardBack(c, { noEx: true, chip: stChip(c.s) + (num(c.wrong) ? ' <span class="chip warn">错过 ' + num(c.wrong) + ' 次</span>' : '') + (c.off ? ' <span class="chip">已停用</span>' : '') }) + '</div>' +
      '<div class="small muted">只是看看，不算学习记录、不算练过。拓展例句在学习页、错词本的卡片上点。</div>');
    m.classList.add('wcm');
  }
  const quiet = () => { const el = $('toast'); if (el) { el.hidden = true; clearTimeout(toast.h); } };

  // ── 「进度」页：全部词表的入口、各题型正确率（正式测验、刷题分开；最近几天／全部）──
  async function tyLoad() {
    if (!has37()) return;
    const my = ++tySeq;
    let r = null, err = null;
    try { r = await rpc('stu_info', { act: 'types', a: {} }, { obj: true, timeout: 20000 }); } catch (e) { err = e; }
    if (my !== tySeq) return;
    TY = err ? { r: TY && TY.r, err: err.message } : { r, err: null };
    tyPaint();
  }
  const tyPaint = () => { const el = $('tybox'); if (el && tab === 'map' && !PR) el.outerHTML = tyHTML(); };
  function tyHTML() {
    if (!has37()) return '';
    const R = TY && TY.r, days = num(R ? R.days : D.wl.days, 30), mn = num(R ? R.min : D.wl.min, 10);
    let h = '<div class="box" id="tybox"><div class="row"><h2 class="lh">各题型正确率</h2><div class="seg" role="group" aria-label="看哪段时间"><button type="button" data-tyall="0" aria-pressed="' + !tyAll + '">最近 ' + days + ' 天</button><button type="button" data-tyall="1" aria-pressed="' + tyAll + '">全部</button></div></div>';
    if (!R) return h + (TY && TY.err ? '<div class="warnbox">没读到：' + esc(TY.err) + ' <button type="button" class="gbtn" data-act="tyre">再试一次</button></div>' : '<div class="muted">正在读取……</div>') + '</div>';
    const k = tyAll ? 'all' : 'recent', A = (R.test || {})[k] || {}, B = (R.drill || {})[k] || {};
    const ks = TN.map(([t]) => t).concat(Object.keys(A).concat(Object.keys(B)).filter(t => !TN.some(([x]) => x === t))).filter((t, i, a) => a.indexOf(t) === i && (A[t] || B[t]));
    const cell = x => x && num(x.n) ? '<b>' + pct(x.right, x.n) + '</b><span class="small muted"> ' + num(x.right) + '/' + num(x.n) + '</span>' + (num(x.n) < mn ? '<br><span class="chip warn tyfew">题少，仅供参考</span>' : '') : '<span class="muted">—</span>';
    if (!ks.length) h += '<div class="muted">' + (tyAll ? '还没有交过卷、也没刷过题。' : '最近 ' + days + ' 天没有交过卷、也没刷过题。') + '</div>';
    else h += '<div class="scroll"><table class="t tyt"><tr><th>题型</th><th>正式测验</th><th>刷题</th></tr>' + ks.map(t => '<tr><td lang="ja">' + esc(tName2(t)) + '</td><td>' + cell(A[t]) + '</td><td>' + cell(B[t]) + '</td></tr>').join('') + '</table></div>';
    return h + '<div class="small muted">正式测验：交了卷的周测、回顾测、季度测、年测（' + (tyAll ? '一共 ' + num(R.test && R.test.tests) : '最近 ' + days + ' 天 ' + num(R.test && R.test.rtests)) + ' 场，没答的题算错，和成绩一样）；刷题：只算答了的题。一种题型少于 ' + mn + ' 题时标「题少，仅供参考」。</div></div>';
  }
  function wlEntry() {
    if (!wlOn()) return '';
    return '<div class="box"><h2>全部词表</h2><div class="small muted">学过的、要学的词都在这里：可以筛选、搜索，遮住读音或中文自测，点一个词看卡片（不算学习记录）。</div><div><button type="button" class="btn main" data-act="words">打开词表</button></div></div>';
  }

  // ── 测验页：一场测验按题型的对错（点了才读；交了卷的成绩不会再变，读过就留着）──
  async function ttLoad(tid) {
    if (!tid || TT.busy.has(tid)) return;
    TT.busy.add(tid); ttPaint(tid);
    let r = null, err = null;
    try { r = await rpc('stu_info', { act: 'test', a: { tid } }, { obj: true, timeout: 20000 }); } catch (e) { err = e; }
    TT.busy.delete(tid);
    if (err) TT.res.set(tid, { err: err.message }); else TT.res.set(tid, r);
    if (tab === 'test' && !T && !PR) ttPaint(tid);
  }
  function ttHTML(tid) {
    const x = TT.res.get(tid);
    if (TT.busy.has(tid)) return '<span class="muted">正在读取……</span>';
    if (!x) return '';
    if (x.err) return '<span class="bad">没读到（' + esc(x.err) + '）</span> <button type="button" class="link" data-act="ttre" data-tid="' + esc(tid) + '">再试一次</button>';
    const ty = x.types || {}, ks = TN.map(([t]) => t).concat(Object.keys(ty).filter(t => !TN.some(([k]) => k === t))).filter((t, i, a) => a.indexOf(t) === i && ty[t]);
    return ks.length ? '<span class="ttl">' + ks.map(t => '<span class="tti"><span lang="ja">' + esc(tName2(t)) + '</span> <b>' + num(ty[t].right) + '/' + num(ty[t].n) + '</b></span>').join('') + '</span>' : '<span class="muted">这场没有题</span>';
  }
  const ttPaint = tid => document.querySelectorAll('[data-ttbox="' + CSS.escape(tid) + '"]').forEach(el => { el.innerHTML = ttHTML(tid); });
  const ttBtn = (tid, txt) => has37() && tid ? ' <button type="button" class="link" data-act="ttypes" data-tid="' + esc(tid) + '" aria-expanded="' + TT.open.has(tid) + '">' + (TT.open.has(tid) ? '收起题型' : txt || '按题型看') + '</button>' : '';

  // ── 错词本：每个词第一次错在哪、错过几次、最近一次哪天、错在什么题型（进错词本页签时读）──
  async function esLoad() {
    if (!has37()) return;
    const my = ++esSeq;
    let r = null, err = null;
    try { r = await rpc('stu_info', { act: 'err', a: {} }, { obj: true, timeout: 20000 }); } catch (e) { err = e; }
    if (my !== esSeq) return;
    ES = err ? { words: ES && ES.words, err: err.message } : { words: (r && r.words) || {}, err: null };
    if (tab === 'err' && !PR) esPaint();
  }
  // 读到以后只换掉筛选那一块和每张卡上「错在哪」那一行（不重画整页：正在播的读音不会停）
  function esPaint() {
    const f = $('esf'); if (!f) return;
    f.outerHTML = esFilter();
    document.querySelectorAll('[data-es]').forEach(el => { const c = D.errbook.find(x => x.id === el.dataset.es); if (c) el.outerHTML = esLine(c); });
  }
  function esFilter() {
    let h = '';
    if (ES && ES.words) {
      const ts = [...new Set(D.errbook.flatMap(c => { const s = esOf(c); return s ? s.types : []; }))];
      const srcs = ESRC.filter(([k]) => D.errbook.some(c => { const s = esOf(c); return k === 'old' ? !s || s.old > 0 : s && s.kinds.includes(k); }));
      h += '<div class="box esf"><div class="dfl"><span class="lab">在哪错过 <small>不选＝都要</small></span><div class="checks">' + srcs.map(([k, n]) => '<button type="button" class="ck" data-esrc="' + k + '" aria-pressed="' + ESF.src.has(k) + '">' + n + '</button>').join('') + '</div></div>' +
        (ts.length ? '<div class="dfl"><span class="lab">错在什么题型</span><div class="checks">' + TN.filter(([t]) => ts.includes(t)).map(([t, n]) => '<button type="button" class="ck" data-est="' + t + '" aria-pressed="' + ESF.t.has(t) + '" lang="ja">' + n + '</button>').join('') + '</div></div>' : '') + '</div>';
    } else if (ES && ES.err) h += '<div class="warnbox">错在哪没读到：' + esc(ES.err) + ' <button type="button" class="gbtn" data-act="esre">再试一次</button></div>';
    return '<div id="esf">' + h + '</div>';
  }
  // 一个词的来源整理好：first 第一次错在哪（早期记录时是 null）、old 来源不明的次数、last 最近一次（那一场）、types 错在什么题型、kinds 在哪几种测验错过
  // 服务器给的每一次：[第几周, 哪几场, 题型, 当场答错 1/0, 交了卷 1/0, 开考那天, 交卷那天]（早的在前）
  function esOf(c) {
    const x = ES && ES.words ? ES.words[c.id] : null; if (!x) return null;
    const occ = Array.isArray(x.occ) ? x.occ.filter(Array.isArray) : [], n = Math.max(num(x.n), num(c.wrong)), old = Math.max(0, n - occ.length);
    const types = [...new Set(occ.map(o => o[2]).filter(Boolean))], kinds = [...new Set(occ.flatMap(o => String(o[1] || '').split('+')).filter(Boolean))];
    return { first: old ? null : occ[0], old, last: occ.length ? occ[occ.length - 1] : null, types, kinds, n };
  }
  // 那一次是哪天：只写试卷上能核实的——交卷时判错的写交卷那天；当场答错的只知道在开考和交卷之间（同一天就是那天）；没交卷的只知道开考以后
  function occDay(o) {
    const d1 = o[5], d2 = o[6];
    if (!o[3]) return d2 ? md(d2) + '交卷时判错' : '具体答错日期不明';
    if (!o[4]) return d1 ? md(d1) + '开考以后当场答错（没交卷）' : '当场答错（没交卷），具体日期不明';
    if (d1 && d2) return d1 === d2 ? md(d1) + '当场答错' : md(d1) + '～' + md(d2) + '之间当场答错';
    return '当场答错，具体日期不明';
  }
  const occTxt = o => '第 ' + num(o[0]) + ' 周 ' + partsName(o[1]) + ' · ' + occDay(o) + (o[2] ? ' · ' + tName2(o[2]) : '');
  function esLine(c) {
    if (!has37()) return '';
    const at = ' data-es="' + esc(c.id) + '"';
    if (!ES || !ES.words) return ES && ES.err ? '<div' + at + ' hidden></div>' : '<div class="esrc muted"' + at + '>正在读取错在哪……</div>';
    const s = esOf(c);
    if (!s) return '<div class="esrc muted"' + at + '>早期记录，来源和日子都不明</div>';
    return '<div class="esrc"' + at + '><div><span class="muted">第一次错：</span>' + (s.first ? esc(occTxt(s.first)) : '早期记录，来源和日子都不明') + '</div>' +
      '<div class="muted">共错 ' + s.n + ' 次' + (s.old && s.n > s.old ? '（其中 ' + s.old + ' 次是早期记录，来源和日子都不明）' : '') +
      ' · 最近一次：' + (s.last ? esc(occDay(s.last)) : '具体日期不明') + (s.types.length ? ' · 错在 ' + s.types.map(tName2).join('、') : '') + '</div></div>';
  }
  const ESRC = [['week', '周测'], ['review', '回顾测'], ['quarter', '季度测'], ['year', '年测'], ['old', '早期记录']];
  function esPass(c) {
    if (!ESF.src.size && !ESF.t.size) return true;
    const s = esOf(c); if (!s) return ESF.src.has('old') && !ESF.t.size;
    const srcOk = !ESF.src.size || s.kinds.some(k => ESF.src.has(k)) || (ESF.src.has('old') && s.old > 0);
    const tOk = !ESF.t.size || s.types.some(t => ESF.t.has(t));
    return srcOk && tOk;
  }

  // ── 学习页顶上「本周任务」：全部用学生页读到的本周词单、学习记录、复习、测验算（和「本周全部词」、顶上「本周练过」是同样的数）──
  const dayN = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  function taskHTML() {
    const w = D.week; if (!w || w.waiting || w.today < w.start) return '';
    const L = w.kind === 'L', cs = cards(), rows = [];
    const grp = src => { const g = cs.filter(c => c.src === src); return [g.length, g.filter(c => c.done).length]; };
    let sum = '';
    if (L) {
      const [nn, nd] = grp('new'), [cn, cd] = grp('carry'), [en, ed] = grp('extra'), tot = cs.length, done = doneN();
      const days = Math.max(1, num(D.cfg.days, 5)), per = Math.ceil(tot / days), di = Math.min(days, Math.max(1, dayN(w.start, w.today) + 1)), goal = Math.min(tot, per * di), left = Math.max(0, goal - done);
      rows.push(['本周新词', nn + ' 个', '练过 ' + nd]);
      if (cn) rows.push(['上周错词', cn + ' 个', '练过 ' + cd]);
      if (en) rows.push(['追加的词', en + ' 个', '练过 ' + ed]);
      rows.push(['今天目标', done >= tot && tot ? '本周的词都练过了' : left ? '还差 <b>' + left + '</b> 个' : '已经完成', tot ? '每个学习日约 ' + per + ' 个，今天累计练到 ' + goal + ' 个' : '']);
      sum = !tot ? '这周没有新词' : done >= tot ? '本周的词都练过了' : left ? '今天还差 ' + left + ' 个' : '今天的目标完成了';
      sum += ' · 练过 ' + done + '/' + tot;
    } else if (roundNone === w.id) {
      // 已经知道本轮没有可复习的词：和下面的说明一样，只说这一句（单独一场回顾测没有题，不叫学生去考；和季度测、年测合成一场的照实际安排）
      rows.push(['复习本轮', '本轮没有可复习的词', '']);
      sum = '本轮没有可复习的词';
    } else {
      rows.push(['复习本轮', '这一轮学过的词', '点下面「复习本轮学过的词」']);
      if (num(w.ncarry)) rows.push(['带过来的错词', num(w.ncarry) + ' 个', '回顾测一起考']);
      sum = '复习本轮，再考回顾测';
    }
    if (D.cfg.srsOn) {
      const rl = (D.review || []).length, left = revLeft().length, dz = D.tday && Number.isInteger(D.tday.rev) ? D.tday.rev : null;
      if (dz === null) rows.push(['今天复习', left ? '还剩 ' + left + ' 个' : '今天没有要复习的了', '']);
      else rows.push(['今天复习', dz + rl ? (dz + rl) + ' 个' : '今天没有要复习的', dz + rl ? '做了 ' + (dz + rl - left) + (left ? '，还剩 ' + left : '') : '']);
    }
    // 单独一场回顾测、本轮没有可复习的词（也就没有题）：不算待完成
    const noRev = x => !L && roundNone === w.id && !x.started && !x.done && (x.parts || [x.kind]).length === 1 && (x.parts || [x.kind])[0] === 'review';
    (D.tests || []).forEach(x => {
      if (noRev(x)) { rows.push([tName(x), '本轮没有可复习的词，不用考', '']); return; }
      const st = x.done ? '已交卷：' + num(x.score) + '/' + num(x.total) + ' ' + (x.passed ? '及格' : x.manual ? '老师放行' : '没及格') : x.started ? '考到一半，还没交卷' : '还没开考';
      rows.push([tName(x), st, x.at ? md(x.at) + ' 开考' + (x.sub ? '，' + md(x.sub) + ' 交卷' : '') : md(w.end) + ' 前考完（过了这天自动进入下一周）']);
    });
    const tl = (D.tests || []).filter(x => !noRev(x));
    if (tl.length) { const nd = tl.filter(x => x.done).length; sum += ' · 测验 ' + (nd === tl.length ? '都考完了' : nd + '/' + tl.length); }
    return '<details class="task" id="task"' + (taskOpen ? ' open' : '') + '><summary><b>' + (L ? '本周任务' : '回顾周任务') + '</b><span>' + sum + '</span></summary>' +
      '<div class="tk">' + rows.map(([a, b, c]) => '<div class="tkr"><span class="tka">' + esc(a) + '</span><span class="tkb">' + b + '</span>' + (c ? '<span class="tkc">' + esc(c) + '</span>' : '') + '</div>').join('') + '</div></details>';
  }

  // ── 第 38 步：随身听、快刷 ──
  // 只在网页上做：用学生页已经读到的本周词单、错词本，或者词表筛出来的词（最多 300 个）；不写学习记录、不算练过、不打卡。
  // 数据库跑过第 38 步才有（学生页读取会给 lq：开没开、老师设的默认怎么播）；没有就不显示入口
  const has38 = () => !!(D && D.lq && typeof D.lq === 'object');
  const lsOn = () => has38() && !!D.lq.ls && D.lq.ls.on !== false;
  const qfOn = () => has38() && !!D.lq.qf && D.lq.qf.on !== false;
  const examOpen = () => (D.tests || []).some(x => x.started && !x.done);   // 这周有开了考、还没交卷的测验：和刷题、词表一样先停
  const LQMAX = 300;   // 从词表带去随身听、快刷一次最多几个（本周的词、错词本不限）
  // 存在这个浏览器里（名字按学生链接算的摘要，不存钥匙）：随身听、快刷自己改过的设置；快刷刷到第几个；会／不会小标。存不进浏览器的只记在页面里
  const LQH = PMK.slice(12), K_LS = 'vocab_lsset_' + LQH, K_QF = 'vocab_qfset_' + LQH, K_POS = 'vocab_qfpos_' + LQH, K_MK = 'vocab_qfmk_' + LQH, MEM = {};
  const jget = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch (e) {} return MEM[k] || null; };
  const jput = (k, v) => { MEM[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  // 设置＝老师设的默认（三层设置，学生页读取时给）＋学生在这个浏览器里自己改过的项（只存改过的；老师以后改默认，没改过的项跟着变）
  const LSDEF = { rep: 1, gap: 1.5, ex: true, order: 'seq', slow: false, hideM: false };
  const LSOK = { rep: v => Number.isInteger(v) && v >= 1 && v <= 5, gap: v => typeof v === 'number' && v >= 0 && v <= 10, ex: v => typeof v === 'boolean', order: v => v === 'seq' || v === 'rand', slow: v => typeof v === 'boolean', hideM: v => typeof v === 'boolean' };
  const QFDEF = { front: 'w', order: 'seq', say: true };
  const QFOK = { front: v => v === 'w' || v === 'm', order: v => v === 'seq' || v === 'rand', say: v => typeof v === 'boolean' };
  const TEACH = { ls: ['rep', 'gap', 'ex', 'order'], qf: ['front', 'order'] };   // 老师能设默认的几项（其余是学生自己的：慢速、遮住中文、翻面读单词）
  function cfgOf(def, ok, teach, key) {
    const mine = jget(key) || {}, out = { own: [] };
    for (const k in def) { if (ok[k](mine[k])) { out[k] = mine[k]; out.own.push(k); } else out[k] = teach && ok[k](teach[k]) ? teach[k] : def[k]; }
    return out;
  }
  const lsCfg = () => cfgOf(LSDEF, LSOK, D.lq && D.lq.ls, K_LS);
  const qfCfg = () => cfgOf(QFDEF, QFOK, D.lq && D.lq.qf, K_QF);
  const cfgPut = (key, ok, k, v) => { if (!ok[k] || !ok[k](v)) return false; const m = jget(key) || {}; m[k] = v; jput(key, m); return true; };
  // 打乱：按一个数打乱（同一个数打乱出来的顺序一样，快刷下次接着刷时顺序不变）
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffled = (a, seed) => { const r = rng(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  // LQ：正在用的随身听或快刷 = {kind listen 随身听／flash 快刷, src week 本周的词／err 错词本／wl 词表筛的, title, from 结束后回哪一页, sig 这一组词的记号（快刷记位置用）,
  //   base 原来的顺序, list 现在的顺序, order, seed, i 第几个词, st 这个词播到第几条, playing 正在播, tok 播放编号（换词、暂停时作废旧的等待）, timer, gen,
  //   wait 两条之间正在停, flip 快刷翻面了没有, done 播完／刷完, showM 遮住中文时这个词点开看了}
  let LQ = null, LQSRC = null, lqSeq = 0, lqLoading = false, qfSwipeAt = 0, qfDown = null, wake = null, qfMarkAt = 0, lqChecking = false;
  const lqWords = src => (src === 'week' ? cards() : src === 'err' ? (D.errbook || []) : []).map(c => ({ id: c.id, w: c.w, r: c.r, m: c.m, lvl: c.lvl, ex: Array.isArray(c.ex) ? c.ex : [], off: !!c.off }));
  const lqName = k => k === 'listen' ? '随身听' : '快刷';
  // 现在不能用的原因（开了考还没交卷、老师关了）；能用＝空
  const lqBlockMsg = kind => examOpen() ? '这周的测验开了考还没交卷：先交卷，再用' + lqName(kind) + '（和刷题、词表一样）'
    : kind === 'listen' && !lsOn() ? '老师暂时没有开放随身听' : kind === 'flash' && !qfOn() ? '老师暂时没有开放快刷' : '';
  function lqOpen(kind, src, list, title, from, sig) {
    if (!list.length) { toast('这里没有词'); return; }
    const bm = lqBlockMsg(kind); if (bm) { toast(bm); return; }
    lqLeave();
    const order = kind === 'listen' ? lsCfg().order : qfCfg().order;
    LQ = { kind, src, title, from, sig, base: list, order, seed: (Math.random() * 2147483647) | 0, list: null, i: 0, st: 0, playing: false, tok: 0, timer: 0, gen: 0, wait: false, flip: false, done: false, showM: false, miss: 0 };
    lqArrange();
    if (kind === 'flash') qfResume();
    prStop(); dropRound(); listView = false;
    tab = kind; window.scrollTo({ top: 0 });
    render();
    if (kind === 'listen') lsPlay();
    else if (LQ.resumed) toast('接着上次刷到的第 ' + (LQ.resumed + 1) + ' 个（记在这个浏览器里）');
    lqCheck();
  }
  // 和服务器再核对一次（别的设备刚开了考、老师刚关了随身听或快刷）：读回来交给平时的更新处理；
  // 同一周、同一天、能不能用也没变时，只换数据不重画（正在点的按钮、翻开的卡都不动）；变成不能用了才重画（停播、遮住词）
  async function lqCheck() {
    if (!LQ || lqChecking || syncing) return;
    lqChecking = true;
    let d = null; try { d = await load(); } catch (e) {}
    lqChecking = false;
    if (!d || !D) return;
    if (!d.week || !D.week || d.week.id !== D.week.id || d.week.today !== D.week.today || d.week.waiting !== D.week.waiting) { newer(d); return; }
    const was = LQ ? lqBlockMsg(LQ.kind) : '';
    lqQuiet = true; try { newer(d); } finally { lqQuiet = false; }
    if (LQ && tab === LQ.kind && lqBlockMsg(LQ.kind) !== was) render();
  }
  function lqArrange(keepId) {
    LQ.list = LQ.order === 'rand' ? shuffled(LQ.base, LQ.seed) : LQ.base.slice();
    if (keepId) { const j = LQ.list.findIndex(w => w.id === keepId); if (j >= 0) LQ.i = j; }
  }
  // 离开随身听、快刷（换页签、点「结束」、开别的一组）：停播、放开屏幕常亮、快刷记下刷到哪里
  function lqLeave() {
    if (!LQ) return;
    if (LQ.kind === 'listen') lsHalt(); else qfSave();
    lsMedia(false);
    LQ = null;
  }
  // ── 随身听：一个词＝单词 →（播例句时）例句 1 → 例句 2，连着播「几遍」；一个词里两条之间停 0.6 秒，词与词之间停设置的秒数 ──
  const lsSteps = w => { const c = lsCfg(), ex = c.ex ? (w.ex.length ? w.ex.map((e, j) => j + 1) : w.nex ? [1, 2] : []) : [], out = []; for (let k = 0; k < c.rep; k++) [0].concat(ex).forEach(p => out.push({ p, k })); return out; };
  function lsPlay() {
    if (!LQ || LQ.kind !== 'listen' || tab !== 'listen') return;
    if (!lqCan()) return;
    if (LQ.done) { LQ.i = 0; LQ.st = 0; LQ.done = false; }
    stopAudio(); LQ.gen = audioGen(); LQ.playing = true; LQ.blocked = false;
    wakeOn(); lsMedia(true); lsRun();
  }
  // 停下（不重画）：作废还在等的下一条、停掉声音、放开屏幕常亮
  function lsHalt() { if (!LQ) return; LQ.playing = false; LQ.tok++; clearTimeout(LQ.timer); LQ.wait = false; stopAudio(); LQ.gen = audioGen(); wakeOff(); }
  function lsPause() { if (!LQ || LQ.kind !== 'listen') return; lsHalt(); lsMediaState(); lsPaint(); }
  function lsRun() {
    if (!LQ || LQ.kind !== 'listen' || !LQ.playing) return;
    clearTimeout(LQ.timer); LQ.wait = false;
    if (audioGen() !== LQ.gen) { LQ.playing = false; wakeOff(); lsMediaState(); lsPaint(); return; }   // 中间点了别的喇叭：先停住，点「继续」接着播
    const w = LQ.list[LQ.i]; if (!w) { lsEnd(); return; }
    const steps = lsSteps(w); if (LQ.st >= steps.length) LQ.st = steps.length - 1;
    const s = steps[LQ.st], my = ++LQ.tok, c = lsCfg();
    if (LQ.st === 0 && s.k === 0) LQ.showM = false;
    LQ.now = s; lsPaint(); lsMediaMeta();
    playStep(aud(w.id, s.p || 0), { rate: c.slow ? SLOW : 1, quiet: true }).then(res => {
      if (!LQ || LQ.tok !== my || !LQ.playing) return;
      if (res === 'stop' || res === 'block') { LQ.playing = false; LQ.blocked = res === 'block'; wakeOff(); lsMediaState(); lsPaint(); return; }   // 被打断、手机不让自动播：先停住
      if (res === 'err') LQ.miss++;                                    // 这条读音没有：跳过，接着播
      const last = LQ.st + 1 >= steps.length;
      LQ.wait = true;
      LQ.timer = setTimeout(() => {
        if (!LQ || LQ.tok !== my || !LQ.playing) return;
        LQ.wait = false;
        if (last) { LQ.st = 0; LQ.i++; if (LQ.i >= LQ.list.length) { LQ.i = LQ.list.length - 1; lsEnd(); return; } } else LQ.st++;
        lsRun();
      }, last ? Math.round(lsCfg().gap * 1000) : 600);
    });
  }
  function lsEnd() { if (!LQ) return; lsHalt(); LQ.done = true; lsMediaState(); if (tab === 'listen') render(); }
  // 上一个／下一个：从那个词的单词读音开始；正在播就接着播
  function lsJump(d) {
    if (!LQ || LQ.kind !== 'listen' || !lqCan()) return;
    LQ.i = Math.max(0, Math.min(LQ.list.length - 1, LQ.i + d)); LQ.st = 0; LQ.done = false; LQ.showM = false;
    if (LQ.playing) { LQ.tok++; clearTimeout(LQ.timer); stopAudio(); LQ.gen = audioGen(); lsRun(); } else { LQ.now = null; render(); }
  }
  // 锁屏界面、耳机按键的「播放／暂停／上一个／下一个」（手机支持的话）
  function lsMedia(on) {
    try {
      if (!('mediaSession' in navigator)) return;
      const ms = navigator.mediaSession, h = (a, f) => { try { ms.setActionHandler(a, on ? f : null); } catch (e) {} };
      h('play', () => lsPlay()); h('pause', () => lsPause()); h('nexttrack', () => lsJump(1)); h('previoustrack', () => lsJump(-1));
      if (!on) { ms.metadata = null; ms.playbackState = 'none'; }
    } catch (e) {}
  }
  function lsMediaMeta() { try { const w = LQ && LQ.list[LQ.i]; if (w && 'mediaSession' in navigator && typeof MediaMetadata === 'function') navigator.mediaSession.metadata = new MediaMetadata({ title: w.w + (w.r && w.r !== w.w ? '（' + w.r + '）' : ''), artist: '随身听', album: LQ.title }); lsMediaState(); } catch (e) {} }
  function lsMediaState() { try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = LQ && LQ.playing ? 'playing' : 'paused'; } catch (e) {} }
  // 播放时尽量让屏幕不熄灭（手机支持的话；切到别的页面时浏览器会自动放开，回来再要）
  async function wakeOn() { try { if (!wake && navigator.wakeLock && document.visibilityState === 'visible') { const w = await navigator.wakeLock.request('screen'); if (LQ && LQ.playing) { wake = w; w.addEventListener('release', () => { if (wake === w) wake = null; }); } else w.release(); } } catch (e) {} }
  function wakeOff() { const w = wake; wake = null; try { if (w) w.release(); } catch (e) {} }
  document.addEventListener('visibilitychange', () => {
    if ($('app').dataset.role === 'adm' || document.visibilityState !== 'visible' || !LQ || tab !== LQ.kind) return;
    lqCheck();                                                         // 回到随身听、快刷：和服务器再核对一次
    if (LQ.kind !== 'listen' || !LQ.playing) return;
    wakeOn();
    if (!LQ.wait && player.paused && audioGen() === LQ.gen) lsRun();   // 回到这一页：声音被系统停了、又没收到通知的，从这一条重新播
  });
  const lsNowTxt = () => { const s = LQ.now; if (LQ.done) return '播完了'; if (!s) return LQ.playing ? '' : '已暂停'; const c = lsCfg(); return (LQ.playing ? '正在播：' : '停在：') + (s.p ? '例句 ' + s.p : '单词') + (c.rep > 1 ? '（第 ' + (s.k + 1) + ' / ' + c.rep + ' 遍）' : ''); };
  function lsNowHTML() {
    const w = LQ.list[LQ.i], c = lsCfg(), n = LQ.list.length, s = LQ.now, ex = s && s.p && w.ex[s.p - 1];
    let h = '<div class="card lsnow" id="lsnow"><div class="row"><span class="chip">' + esc(w.lvl || '') + '</span><span class="small muted" role="status">第 ' + (LQ.i + 1) + ' / ' + n + ' 个 · ' + esc(lsNowTxt()) + '</span></div>' +
      '<div class="lsw"><span class="big" lang="ja">' + esc(w.w) + '</span>' + (w.r && w.r !== w.w ? '<span class="r" lang="ja">' + esc(w.r) + '</span>' : '') + (w.off ? '<span class="chip">已停用</span>' : '') + '</div>' +
      (c.hideM && !LQ.showM ? '<button type="button" class="wmask lsm" data-act="lsshowm" aria-label="点一下看中文">中文遮住了，点一下看</button>' : '<div class="mean lsm">' + esc(w.m) + '</div>');
    if (ex) h += '<div class="lsex"><div class="jp" lang="ja">' + rb(ex[0]) + '</div>' + (c.hideM && !LQ.showM ? '' : '<div class="zh">' + esc(ex[1]) + '</div>') + '</div>';
    if (LQ.blocked) h += '<div class="vd warn" role="status">手机不让网页自己出声：点下面「继续」就能接着播（也看看手机音量）</div>';
    if (LQ.miss) h += '<div class="small muted">有 ' + LQ.miss + ' 条读音没找到，跳过了</div>';
    if (LQ.done) h += '<div class="form"><div class="muted">这 ' + n + ' 个词播完了。</div><button type="button" class="btn main" data-act="lsagain">从头再播</button><button type="button" class="btn" data-act="lqback">返回</button></div>';
    return h + '</div>';
  }
  const lsCtlHTML = () => '<div class="bar lsbar" id="lsctl"><button type="button" class="btn" data-act="lsprev"' + (LQ.i === 0 ? ' disabled' : '') + '>上一个</button>' +
    '<button type="button" class="btn main" data-act="lstoggle" aria-pressed="' + LQ.playing + '">' + (LQ.playing ? '暂停' : LQ.done ? '从头再播' : '继续') + '</button>' +
    '<button type="button" class="btn" data-act="lsnext"' + (LQ.i >= LQ.list.length - 1 ? ' disabled' : '') + '>下一个</button></div>';
  // 只换掉上面这个词和下面的按钮（播的时候每一条都会换；设置那一块不动，不会跳）
  function lsPaint() {
    if (tab !== 'listen' || !LQ || LQ.kind !== 'listen' || PR) return;
    const a = $('lsnow'), b = $('lsctl'); if (!a || !b) { render(); return; }
    a.outerHTML = lsNowHTML(); b.outerHTML = lsCtlHTML();
  }
  const stepBtn = (k, d, lab) => '<button type="button" data-lsk="' + k + '" data-lsd="' + d + '" aria-label="' + lab + '">' + (d > 0 ? '+' : '−') + '</button>';
  const segH = (k, cur, opts, attr) => '<div class="seg" role="group">' + opts.map(([v, n]) => '<button type="button" ' + attr + '="' + k + ':' + v + '" aria-pressed="' + (String(cur) === String(v)) + '">' + n + '</button>').join('') + '</div>';
  function lsSetHTML() {
    const c = lsCfg(), t = (D.lq && D.lq.ls) || {}, own = c.own.filter(k => TEACH.ls.includes(k));
    return '<details class="lqset" id="lqset"' + (LQ.setOpen ? ' open' : '') + '><summary><span class="lab">播放设置</span><span class="small muted">' + c.rep + ' 遍 · 停 ' + c.gap + ' 秒 · ' + (c.ex ? '播例句' : '只播单词') + ' · ' + (c.order === 'rand' ? '打乱' : '按顺序') + (c.slow ? ' · 慢速' : '') + '</span></summary>' +
      '<div class="lqf"><span class="lab">每个词连着播</span><div class="step">' + stepBtn('rep', -1, '少播一遍') + '<span class="v">' + c.rep + ' 遍</span>' + stepBtn('rep', 1, '多播一遍') + '</div></div>' +
      '<div class="lqf"><span class="lab">词与词之间停</span><div class="step">' + stepBtn('gap', -1, '少停半秒') + '<span class="v">' + c.gap + ' 秒</span>' + stepBtn('gap', 1, '多停半秒') + '</div></div>' +
      '<div class="lqf"><span class="lab">例句</span>' + segH('ex', c.ex, [[true, '播例句'], [false, '只播单词']], 'data-lsv') + '</div>' +
      '<div class="lqf"><span class="lab">顺序</span>' + segH('order', c.order, [['seq', '按顺序'], ['rand', '打乱']], 'data-lsv') + '</div>' +
      '<div class="lqf"><span class="lab">语速</span>' + segH('slow', c.slow, [[false, '正常'], [true, '慢（0.75 倍）']], 'data-lsv') + '</div>' +
      '<div class="lqf"><span class="lab">中文</span>' + segH('hideM', c.hideM, [[false, '显示'], [true, '遮住']], 'data-lsv') + '</div>' +
      '<div class="small muted">老师设的默认：每个词 ' + num(t.rep, 1) + ' 遍、停 ' + num(t.gap, 1.5) + ' 秒、' + (t.ex === false ? '只播单词' : '播例句') + '、' + (t.order === 'rand' ? '打乱' : '按顺序') + '。你改的只存在这个浏览器里。' +
      (own.length ? ' <button type="button" class="link" data-act="lsreset">恢复老师设的默认</button>' : '') + '</div></details>';
  }
  function lsHTML() {
    return '<div class="wkline"><span class="muted">随身听 · ' + esc(LQ.title) + ' · 不算学习记录</span><button type="button" class="gbtn" data-act="lqback">结束</button></div>' +
      lsNowHTML() + lsSetHTML() +
      '<div class="small muted">锁屏或切到别的应用后，手机可能会停播；回到这一页点「继续」接着播。播放时会尽量让屏幕不熄灭。</div>' + lsCtlHTML();
  }
  // ── 快刷：一词一屏；先看写法（或中文），点一下翻面看读音和中文；左右滑或按下面的按钮换词；会／不会只是这个浏览器里的小标 ──
  const qfMarks = () => jget(K_MK) || {};
  function qfMark(id, v) { const m = qfMarks(); delete m[id]; m[id] = v; const ks = Object.keys(m); if (ks.length > 3000) ks.slice(0, ks.length - 3000).forEach(k => delete m[k]); jput(K_MK, m); }
  // 刷到第几个：按「这一组词」记（本周的词按这一周、错词本、词表按筛选条件）；最多记 20 组；顺序是打乱的，连打乱用的数一起记（下次顺序一样）
  function qfSave() {
    if (!LQ || LQ.kind !== 'flash') return;
    const all = jget(K_POS) || {}, w = LQ.list[Math.min(LQ.i, LQ.list.length - 1)];
    if (LQ.done) delete all[LQ.sig];   // 刷完了：不记位置，下次从头开始
    else all[LQ.sig] = { order: LQ.order, seed: LQ.seed, id: w ? w.id : null, i: LQ.i, at: Date.now() };
    Object.keys(all).sort((a, b) => num(all[b].at) - num(all[a].at)).slice(20).forEach(k => delete all[k]);
    jput(K_POS, all);
  }
  function qfResume() {
    const p = (jget(K_POS) || {})[LQ.sig]; if (!p || typeof p !== 'object') return;
    if (p.order === LQ.order && Number.isInteger(p.seed)) { LQ.seed = p.seed; lqArrange(); }
    let j = p.id ? LQ.list.findIndex(w => w.id === p.id) : -1;
    if (j < 0 && Number.isInteger(p.i)) j = Math.min(p.i, LQ.list.length - 1);
    if (j > 0) { LQ.i = j; LQ.resumed = j; }
  }
  // 现在能不能动（开了考、老师关了：翻面、换词、标记、键盘、随身听的播放都不动，停掉声音）
  const lqCan = () => { if (!LQ || !lqBlockMsg(LQ.kind)) return !!LQ; if (LQ.kind === 'listen') lsHalt(); else stopAudio(); if (tab === LQ.kind) render(); return false; };
  function qfMove(d) {
    if (!LQ || LQ.kind !== 'flash' || !lqCan()) return;
    if (LQ.done) { if (d < 0) { LQ.done = false; LQ.i = LQ.list.length - 1; } }
    else { const j = LQ.i + d; if (j < 0) return; if (j >= LQ.list.length) LQ.done = true; else LQ.i = j; }
    LQ.flip = false; qfSave(); render();
  }
  function qfFlip() {
    if (!LQ || LQ.kind !== 'flash' || LQ.done || !lqCan()) return;
    LQ.flip = !LQ.flip; render();
    if (LQ.flip && qfCfg().say) play(aud(LQ.list[LQ.i].id));
  }
  function qfHTML() {
    const n = LQ.list.length, mk = qfMarks(), c = qfCfg();
    const head = '<div class="wkline"><span class="muted">快刷 · ' + esc(LQ.title) + ' · ' + (LQ.done ? '刷完了' : '第 ' + (LQ.i + 1) + ' / ' + n + ' 个') + ' · 不算学习记录</span><button type="button" class="gbtn" data-act="lqback">结束</button></div>';
    const note = '<div class="small muted">「会」「不会」只是给自己看的小标（存在这个浏览器里），不改学习记录、不进错词本；刷到第几个也只记在这个浏览器（换手机、换浏览器不同步）。</div>';
    if (LQ.done) {
      const k = LQ.list.filter(w => mk[w.id] === 'k').length, b = LQ.list.filter(w => mk[w.id] === 'n').length;
      return head + '<div class="card"><h2>这 ' + n + ' 个刷完了</h2><div class="stats"><div class="stat"><b>' + k + '</b><span>标了会</span></div><div class="stat"><b>' + b + '</b><span>标了不会</span></div><div class="stat"><b>' + (n - k - b) + '</b><span>没标</span></div></div>' +
        '<div class="form">' + (b ? '<button type="button" class="btn main" data-act="qfbad">只刷标了「不会」的（' + b + ' 个）</button>' : '') + '<button type="button" class="btn' + (b ? '' : ' main') + '" data-act="qfagain">从头再刷</button><button type="button" class="btn" data-act="lqback">返回</button></div></div>' + note;
    }
    const w = LQ.list[LQ.i], m = mk[w.id];
    const chips = '<div class="chips"><span class="chip">' + esc(w.lvl || '') + '</span>' + (m === 'k' ? '<span class="chip ok">会</span>' : m === 'n' ? '<span class="chip bad">不会</span>' : '') + (w.off ? '<span class="chip">已停用</span>' : '') + '</div>';
    const face = !LQ.flip
      ? (c.front === 'm' ? '<div class="qfm">' + esc(w.m) + '</div>' : '<div class="big" lang="ja">' + esc(w.w) + '</div>') + '<div class="hint">点一下翻面 · 左右滑换词</div>'
      : '<div class="head qfh"><span class="w" lang="ja">' + esc(w.w) + '</span>' + (w.r && w.r !== w.w ? '<span class="r" lang="ja">' + esc(w.r) + '</span>' : '') + sayBtn(aud(w.id), '听单词发音') + slowBtn(aud(w.id), '慢速听单词') + '</div><div class="mean">' + esc(w.m) + '</div><div class="hint">再点一下翻回去 · 左右滑换词</div>';
    return head + '<div class="card front qfcard' + (LQ.flip ? ' back' : '') + '" id="qfcard" tabindex="0" role="button" aria-label="' + (LQ.flip ? '翻回去' : '翻面看读音和中文') + '">' + chips + face + '</div>' +
      '<details class="lqset" id="lqset"' + (LQ.setOpen ? ' open' : '') + '><summary><span class="lab">快刷设置</span><span class="small muted">先看' + (c.front === 'm' ? '中文' : '写法') + ' · ' + (c.order === 'rand' ? '打乱' : '按顺序') + ' · 翻面' + (c.say ? '读' : '不读') + '单词</span></summary>' +
      '<div class="lqf"><span class="lab">先看</span>' + segH('front', c.front, [['w', '写法'], ['m', '中文']], 'data-qfv') + '</div>' +
      '<div class="lqf"><span class="lab">顺序</span>' + segH('order', c.order, [['seq', '按顺序'], ['rand', '打乱']], 'data-qfv') + '</div>' +
      '<div class="lqf"><span class="lab">翻面时</span>' + segH('say', c.say, [[true, '读单词'], [false, '不读']], 'data-qfv') + '</div>' +
      '<div class="small muted">老师设的默认：先看' + (D.lq && D.lq.qf && D.lq.qf.front === 'm' ? '中文' : '写法') + '、' + (D.lq && D.lq.qf && D.lq.qf.order === 'rand' ? '打乱' : '按顺序') + '。你改的只存在这个浏览器里。' +
      (c.own.some(k => TEACH.qf.includes(k)) ? ' <button type="button" class="link" data-act="qfreset">恢复老师设的默认</button>' : '') + '</div></details>' + note +
      '<div class="bar qfbar"><button type="button" class="btn" data-act="qfprev"' + (LQ.i === 0 ? ' disabled' : '') + ' aria-label="上一个">‹<span class="qft"> 上一个</span></button><button type="button" class="btn no" data-qfm="n">不会</button><button type="button" class="btn ok" data-qfm="k">会</button><button type="button" class="btn" data-act="qfnext" aria-label="下一个"><span class="qft">下一个 </span>›</button></div>';
  }
  function lqHTML() {
    if (!LQ || LQ.kind !== tab) return '<div class="box"><h2>' + lqName(tab) + '</h2><div class="muted">没有在用的词了。</div><div><button type="button" class="btn" data-tab="map">返回进度</button></div></div>';
    const bm = lqBlockMsg(LQ.kind);
    if (bm) {   // 开了考、老师关了：停播，不显示词
      if (LQ.kind === 'listen') { lsHalt(); lsMediaState(); } else stopAudio();
      return '<div class="box"><h2>' + lqName(LQ.kind) + '</h2><div class="warnbox">' + esc(bm) + '</div><div class="form">' + (examOpen() ? '<button type="button" class="btn main" data-tab="test">去测验</button>' : '') + '<button type="button" class="btn" data-act="lqback">返回</button></div></div>';
    }
    return LQ.kind === 'listen' ? lsHTML() : qfHTML();
  }
  // 「进度」页的入口：选用哪些词（本周的词／错词本；词表里筛的从「全部词表」进去），再点随身听或快刷
  function lqEntry() {
    if (!has38() || (!lsOn() && !qfOn())) return '';
    const nw = cards().length, ne = (D.errbook || []).length;
    if (!LQSRC || (LQSRC === 'week' && !nw) || (LQSRC === 'err' && !ne)) LQSRC = nw ? 'week' : ne ? 'err' : null;
    const ex = examOpen(), n = LQSRC === 'week' ? nw : LQSRC === 'err' ? ne : 0, dis = ex || !n ? ' disabled' : '';
    return '<div class="box" id="lqbox"><h2>随身听 · 快刷 <small>不算学习记录、不算打卡</small></h2>' +
      '<div class="small muted">' + (lsOn() ? '随身听：连着播单词和例句的读音，可以边走边听。' : '') + (qfOn() ? '快刷：一词一屏，点一下翻面，左右滑换词。' : '') + '</div>' +
      (ex ? '<div class="warnbox">这周的测验开了考还没交卷：先交卷，再用随身听、快刷</div>' : '') +   // 页面知道开了考就停；进随身听、快刷和从别的应用切回来时会再和服务器核对一次
      '<div class="checks lqsrc" role="group" aria-label="用哪些词">' + [['week', '本周的词', nw], ['err', '错词本', ne]].map(([k, nm, c]) => '<button type="button" class="ck" data-lqsrc="' + k + '" aria-pressed="' + (LQSRC === k) + '"' + (c ? '' : ' disabled') + '>' + nm + ' <small>' + c + '</small></button>').join('') +
      (wlOn() ? '<button type="button" class="ck" data-act="words">从全部词表里筛…</button>' : '') + '</div>' +
      (!nw && D.week.kind === 'R' ? '<div class="small muted">回顾周没有本周词单，可以用错词本，或者在全部词表里筛。</div>' : '') +
      '<div class="lqgo">' + (lsOn() ? '<button type="button" class="btn main" data-lq="listen"' + dis + '>随身听' + (n ? '（' + n + ' 个）' : '') + '</button>' : '') +
      (qfOn() ? '<button type="button" class="btn" data-lq="flash"' + dis + '>快刷' + (n ? '（' + n + ' 个）' : '') + '</button>' : '') + '</div></div>';
  }
  // 从词表「随身听」「快刷」：按现在的筛选，从第一页起一页一页读（最多 300 个）。总数用这一次读到的第一页的（不用页面上可能还没更新的旧数）；
  // 筛选还在读的时候按钮是灰的；读的时候换了筛选、排序、重新核对（词表又读了一次）、离开了词表页，这一批就作废，不打开
  async function wlLq(kind, btn) {
    if (!WL || tab !== 'words' || lqLoading || WL.busy || !WL.res || WL.res.state !== 'ok') return;
    const bm = lqBlockMsg(kind); if (bm) { toast(bm); return; }
    unlockAudio();
    const args = wlArgs(), my = ++lqSeq, ws = wlSeq, rows = [], seen = new Set();
    lqLoading = true; busy(btn, true); toast('正在读这些词……');
    const stale = () => my !== lqSeq || ws !== wlSeq || tab !== 'words';
    let err = null, bad = null, want = LQMAX;
    for (let off = 0; off < want; off += 100) {
      let r = null;
      try { r = await rpc('stu_info', { act: 'list', a: Object.assign({}, args, { off }) }, { obj: true, timeout: 20000 }); } catch (e) { err = e; break; }
      if (stale()) { if (my === lqSeq) lqLoading = false; return; }
      if (!r || r.state !== 'ok' || !Array.isArray(r.rows)) { bad = r || {}; break; }
      if (off === 0) want = Math.min(num(r.total), LQMAX);   // 这一批的总数：第一页回来时定下
      for (const x of r.rows) if (x && x.id && !seen.has(x.id) && rows.length < want) { seen.add(x.id); rows.push(x); }
      if (r.rows.length < num(r.size, 100)) break;
    }
    if (stale()) { if (my === lqSeq) lqLoading = false; return; }
    lqLoading = false; quiet();
    if (tab !== 'words') return;
    if (err) { busy(btn, false); fail(err); return; }
    if (bad) { WL.res = bad.state ? bad : null; render(); toast(bad.msg || '没读到词表'); return; }   // 开考了、老师关了词表：和词表页一样停
    if (!rows.length) { busy(btn, false); toast('这个筛选现在没有词了'); wlLoad(); return; }
    const list = rows.map(x => ({ id: x.id, w: x.w, r: x.r, m: x.m, lvl: x.lvl, ex: [], nex: 2, off: !!x.off }));
    wlDrop();
    lqOpen(kind, 'wl', list, '词表筛出来的 ' + list.length + ' 个', 'words', 'wl:' + JSON.stringify({ lv: args.lv.slice().sort(), st: args.st.slice().sort(), q: args.q, sort: args.sort }));
  }
  // 结束随身听、快刷：回到进来的那一页（词表要重新核对一次）
  function lqBack() {
    const from = LQ ? LQ.from : 'map';
    lqLeave(); tab = from === 'words' && wlOn() ? 'words' : 'map'; window.scrollTo({ top: 0 });
    if (tab === 'words') { wlInit(); wlRecheck(); return; }
    render(); refreshSide('map'); tyLoad();
  }

  // ── 错词本 ──
  function errHTML() {
    if (!D.errbook.length) return '<div class="box"><h2>错词本是空的</h2><div class="muted">测验答错的词会放到这里。</div></div>';
    let h = has37() ? esFilter() : '';
    const list = D.errbook.filter(esPass);
    h += '<div class="muted">一共 ' + D.errbook.length + ' 个' + (list.length < D.errbook.length ? '，筛出来 ' + list.length + ' 个' : '') + '，最近一周错的排在前面。</div>';
    return h + list.map(c => '<div class="card">' + cardBack(c, { chip: '<span class="chip warn">错过 ' + num(c.wrong) + ' 次</span>' + (c.st === 'correct' ? ' <span class="chip ok">后来答对了</span>' : '') + (c.pok ? ' <span class="chip ok">练习答对过</span>' : '') + (c.off ? ' <span class="chip">已停用</span>' : '') }).replace('</div>', '</div>' + esLine(c)) + '</div>').join('');   // 错在哪：放在词的下面一行
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
      '<div class="small muted">下一张新生成的周词单起按这个（已经发的这一周照旧）。</div>' + adjHTML();
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
  // 老师调过新词量：第几周调成多少、哪一周恢复（或者从哪一周起每周多少）
  function adjHTML() {
    const a = D.adj; if (!a) return '';
    const per = x => x && x.rule === 'B' ? '每周总数 ' + num(x.total) + ' 个' : '每周新词 ' + num(x && x.new) + ' 个';
    let t = '';
    if (a.cut) t = '老师已将第 ' + num(a.cut.no) + ' 周（' + md(a.cut.start) + ' 开始）新词调整为 ' + num(a.cut.n) + ' 个' + (num(a.cut.n) === 0 ? '（这一周暂停新词）' : '') +
      (a.cut.then_no ? '，第 ' + num(a.cut.then_no) + ' 周' + (a.long ? '起' : '恢复') + per(a.cut.then) : '') + '。第 ' + num(a.cut.no) + ' 周照常带上之前的全部错词';
    else if (a.long) {
      const pw = a.long.rule === 'B' ? '每周总数 ' + num(a.long.n) + ' 个' : '每周新词 ' + num(a.long.n) + ' 个';
      t = (a.long.from_no ? '老师已将新词调整为从第 ' + num(a.long.from_no) + ' 周起' + pw : '老师给你单独设了' + pw) +
        (a.long.rule === 'B' ? '（总数不变：错词先占位，多出的错词往后排）' : '。上周的错词照常全部带上');
    }
    return t ? '<div class="note adjn">' + t + '。</div>' : '';
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
    let h = wlEntry() + lqEntry() + '<div class="box"><h2>我的进度</h2><div class="stats">' +
      '<div class="stat"><b>' + num(s.streak) + ' 天</b><span>连续打卡</span></div><div class="stat"><b>' + num(s.learned) + '</b><span>学过的词（累计）</span></div><div class="stat"><b>' + num(s.correct) + '</b><span>现在全亮的词</span></div></div>';
    const on = new Set(s.last30 || []);
    let cal = ''; for (let i = 29; i >= 0; i--) { const k = addDays(D.week.today, -i), [, mm, dd] = k.split('-'); cal += '<i' + (on.has(k) ? ' class="f"' : '') + ' title="' + (+mm) + '月' + (+dd) + '日"></i>'; }
    h += '<div class="lab muted">最近 30 天（学过卡、复习过或考过试就亮）</div><div class="cal">' + cal + '</div>';
    h += '<div class="lab muted">成就</div><div class="badges">' + BADGES.map(([k, n, name]) => '<span class="badge' + ((k === 'streak' ? Math.max(num(s.streak), num(s.best)) : num(s[k])) >= n ? ' got' : '') + '">' + name + '</span>').join('') + '</div></div>';
    h += tyHTML();   // 第 37 步：各题型正确率（进「进度」页时读）
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
    // 拓展例句：只显示，不评分、不打卡、不翻卡。上面两个按钮＝看这一类（已经有了就直接切过去）；句子下面的「换一句」＝再要一句
    const xk = t.closest('[data-exk]'); if (xk) { if (!xk.disabled) exGen(xk.dataset.wid, xk.dataset.exk, KEY, !!xk.closest('.xs')); return; }
    const xr = t.closest('[data-exrep]'); if (xr) { exReport(xr.dataset.exrep); return; }
    if (saving && t.closest('[data-tab],[data-act="all"],[data-act="rev"],[data-act="back"],[data-act="more"],[data-act="list"],[data-act="unlist"],[data-act="round"],[data-wid]')) { toast('正在保存，等一下'); return; }
    const po = t.closest('[data-opt]'); if (po && PR) { if (!po.disabled) pAnswer(+po.dataset.opt); return; }
    const tb = t.closest('[data-tab]'); if (tb) {
      if (submitting) { toast('正在交卷，等一下'); return; }
      prStop();                                    // 换页签：结束练习（每题的对错已经记下了；还没回来的出题回复作废）
      if (T && tb.dataset.tab !== 'test' && !(await leaveQuiz())) return;
      dropRound();
      if (tab === 'words') wlDrop();                // 离开词表页：还没回来的读取作废（回来再读）
      if (tab === 'listen' || tab === 'flash') lqLeave();   // 第 38 步：离开随身听、快刷：停播、记下快刷刷到哪里
      tab = tb.dataset.tab; listView = false; window.scrollTo({ top: 0 });
      render();
      if (tab === 'map' || tab === 'err') refreshSide(tab);
      if (tab === 'map') tyLoad();                  // 第 37 步：进「进度」页读一次各题型正确率
      if (tab === 'err') esLoad();                  // 第 37 步：进错词本读一次错在哪
      if (tab === 'drill') dLoad();                 // 每次进刷题页读一次（各范围的词数会变）
      return;
    }
    // ── 第 37 步：全部词表（筛选一变就重新读第一页；后发的才算数）、题型表现、错词来源筛选 ──
    const wlv = t.closest('[data-wlv],[data-wst]'); if (wlv) {
      if (!WL || tab !== 'words') return;
      const [set, v] = wlv.dataset.wlv ? [WL.lv, wlv.dataset.wlv] : [WL.st, wlv.dataset.wst];
      if (set.has(v)) set.delete(v); else set.add(v);
      WL.off = 0; wlLoad(); return;
    }
    const wso = t.closest('[data-wsort]'); if (wso) { if (WL && tab === 'words' && WL.sort !== wso.dataset.wsort) { WL.sort = wso.dataset.wsort; WL.off = 0; wlLoad(); } return; }
    const wm = t.closest('[data-wm]'); if (wm) {   // 遮住：开关只管这一样，点开过的这一样重新遮上；切换筛选、翻页时开关不变
      if (!WL || tab !== 'words') return;
      const k = wm.dataset.wm; WL.mask[k] = !WL.mask[k];
      for (const x of [...WL.open]) if (x.endsWith('|' + k)) WL.open.delete(x);
      try { localStorage.setItem(WMK, JSON.stringify(WL.mask)); } catch (er) {}
      wlPaint(); return;
    }
    const wrv = t.closest('[data-wrev]'); if (wrv) { if (WL) { const k = wrv.dataset.wrev; if (WL.open.has(k)) WL.open.delete(k); else WL.open.add(k); wlPaint(); } return; }
    const wpg = t.closest('[data-wpg]'); if (wpg) { if (WL && !wpg.disabled && !WL.busy) { WL.off = num(wpg.dataset.wpg); wlLoad(); const el = $('wlres'); if (el) el.scrollIntoView({ block: 'start' }); } return; }
    const wcd = t.closest('[data-wcard]'); if (wcd) { if (tab === 'words') wlCard(wcd.dataset.wcard); return; }
    const tya = t.closest('[data-tyall]'); if (tya) { tyAll = tya.dataset.tyall === '1'; tyPaint(); return; }
    const esb = t.closest('[data-esrc],[data-est]'); if (esb) {
      const [set, v] = esb.dataset.esrc ? [ESF.src, esb.dataset.esrc] : [ESF.t, esb.dataset.est];
      if (set.has(v)) set.delete(v); else set.add(v);
      render(); return;
    }
    if (t.closest('#front')) { flip(); return; }
    const r = t.closest('[data-rate]'); if (r) { rate(r.dataset.rate); return; }
    const o = t.closest('[data-opt]'); if (o && T) { if (!o.disabled) pick(+o.dataset.opt); return; }
    const wc = t.closest('[data-wid]'); if (wc) { jumpTo(wc.dataset.wid); return; }
    const pq = t.closest('[data-preq]'); if (pq) { if (!pq.disabled) reqModal(pq.dataset.preq); return; }
    // ── 第 38 步：随身听、快刷 ──
    const lqs = t.closest('[data-lqsrc]'); if (lqs) { if (!lqs.disabled && tab === 'map') { LQSRC = lqs.dataset.lqsrc; render(); } return; }
    const lqg = t.closest('[data-lq]'); if (lqg) { if (!lqg.disabled && tab === 'map' && !T && LQSRC) { unlockAudio(); const k = lqg.dataset.lq; lqOpen(k, LQSRC, lqWords(LQSRC), LQSRC === 'week' ? '本周的词' : '错词本', 'map', LQSRC === 'week' ? 'week:' + D.week.id : 'err'); } return; }
    const wq = t.closest('[data-wlq]'); if (wq) { if (!wq.disabled && tab === 'words') wlLq(wq.dataset.wlq, wq); return; }
    const lsk = t.closest('[data-lsk]'); if (lsk) {
      if (!LQ || LQ.kind !== 'listen') return;
      const c = lsCfg(), k = lsk.dataset.lsk, d = +lsk.dataset.lsd;
      if (k === 'rep') cfgPut(K_LS, LSOK, 'rep', Math.max(1, Math.min(5, c.rep + d)));
      else cfgPut(K_LS, LSOK, 'gap', Math.max(0, Math.min(10, Math.round((c.gap + d * 0.5) * 10) / 10)));
      LQ.setOpen = true; render(); return;
    }
    const lsv = t.closest('[data-lsv],[data-qfv]'); if (lsv) {
      if (!LQ) return;
      const isLs = !!lsv.dataset.lsv, [k, raw] = (lsv.dataset.lsv || lsv.dataset.qfv).split(':'), v = raw === 'true' ? true : raw === 'false' ? false : raw;
      const cur = isLs ? lsCfg() : qfCfg();
      if (cur[k] === v) return;
      cfgPut(isLs ? K_LS : K_QF, isLs ? LSOK : QFOK, k, v);
      if (k === 'order') { const w = LQ.list[LQ.i]; LQ.order = v; LQ.seed = (Math.random() * 2147483647) | 0; lqArrange(w && w.id); if (!isLs) qfSave(); }   // 换顺序：现在这个词还是现在这个
      if (k === 'hideM') LQ.showM = false;
      LQ.setOpen = true; render(); return;
    }
    const qm = t.closest('[data-qfm]'); if (qm) { if (LQ && LQ.kind === 'flash' && !LQ.done && Date.now() - qfMarkAt > 500 && lqCan()) { qfMarkAt = Date.now(); qfMark(LQ.list[LQ.i].id, qm.dataset.qfm); qfMove(1); } return; }   // 防连点：0.5 秒内的第二下不算
    if (t.closest('#qfcard')) { if (t.closest('button')) return; if (Date.now() - qfSwipeAt > 500) qfFlip(); return; }
    // 刷题页：选范围、再筛（再点一次取消）、选题数；选项一变就重新数符合条件的题
    const dsc = t.closest('[data-dsc]'); if (dsc) { if (!dsc.disabled && DS && !PR) { DS.scope = dsc.dataset.dsc; DS.scopeWant = null; render(); dCount(); } return; }   // 学生自己选了范围：不再等词表带过来的那个
    const dfl = t.closest('[data-dlv],[data-dt],[data-dst]'); if (dfl) {
      if (!DS || PR) return;
      const [set, v] = dfl.dataset.dlv ? [DS.lv, dfl.dataset.dlv] : dfl.dataset.dt ? [DS.t, dfl.dataset.dt] : [DS.st, +dfl.dataset.dst];
      if (set.has(v)) set.delete(v); else set.add(v);
      if (dfl.dataset.dlv) { DS.lvBad = null; DS.lvGone = null; }   // 学生自己重新选了档
      if (dfl.dataset.dt) DS.acGone = false;
      render(); dCount(); return;
    }
    const dn = t.closest('[data-dn]'); if (dn) { if (DS && !PR) { DS.n = +dn.dataset.dn; DS.custom = ''; render(); } return; }
    const dor = t.closest('[data-dord]'); if (dor) { if (DS && !PR && DS.order !== dor.dataset.dord) { DS.order = dor.dataset.dord; render(); dCount(); } return; }
    const a = t.closest('[data-act]'); if (!a || a.disabled) return;
    const act = a.dataset.act;
    // 第 38 步：随身听、快刷的按钮
    if (act === 'lstoggle') { if (LQ && LQ.kind === 'listen') { if (LQ.playing) lsPause(); else { unlockAudio(); lsPlay(); } } return; }
    if (act === 'lsprev' || act === 'lsnext') { lsJump(act === 'lsnext' ? 1 : -1); return; }
    if (act === 'lsagain') { if (LQ && LQ.kind === 'listen') { LQ.done = true; lsPlay(); } return; }
    if (act === 'lsshowm') { if (LQ) { LQ.showM = true; lsPaint(); } return; }
    if (act === 'lsreset' || act === 'qfreset') {
      const isLs = act === 'lsreset', key = isLs ? K_LS : K_QF, m = jget(key) || {};
      (isLs ? TEACH.ls : TEACH.qf).forEach(k => delete m[k]); jput(key, m);
      if (LQ) { const c = isLs ? lsCfg() : qfCfg(), w = LQ.list[LQ.i]; if (c.order !== LQ.order) { LQ.order = c.order; LQ.seed = (Math.random() * 2147483647) | 0; lqArrange(w && w.id); } LQ.setOpen = true; }
      render(); toast('已经恢复成老师设的默认'); return;
    }
    if (act === 'qfprev' || act === 'qfnext') { qfMove(act === 'qfnext' ? 1 : -1); return; }
    if (act === 'qfagain') { if (LQ && LQ.kind === 'flash') { LQ.done = false; LQ.i = 0; LQ.flip = false; qfSave(); render(); window.scrollTo({ top: 0 }); } return; }
    if (act === 'qfbad') { if (LQ && LQ.kind === 'flash') { const mk = qfMarks(), L = LQ.list.filter(w => mk[w.id] === 'n'); if (L.length) { const o = LQ; lqOpen('flash', o.src, L, '标了「不会」的 ' + L.length + ' 个', o.from, o.sig + ':n'); } } return; }
    if (act === 'lqback') { lqBack(); return; }
    if (act === 'dlvall') { if (DS && !PR) { DS.lvBad = null; DS.lv = new Set(); render(); dCount(); } return; }   // 第 37 步：学生确认改成全部档
    if (act === 'dstart') { if (!DS || PR || T) return; if (dPre) { toast('正在按词表的筛选选好，稍等'); return; } if (DS.lvBad) { toast('先在「档」里重新选'); return; } const want = dWant(); if (!want || !DS.scope) { toast('先选好刷哪些词和题数'); return; } dStart(Object.assign(dArgs(), { n: want }), '刷题'); return; }
    if (act === 'dagain') { if (PR && PR.kind === 'drill' && !PR.busy) dStart({ pid: PR.id }, '再刷一遍做错的'); return; }
    if (act === 'dall') { if (PR && PR.kind === 'drill' && !PR.busy) dStart({ pid: PR.id, all: true }, '再刷一遍这组'); return; }
    if (act === 'dmore') { if (PR && PR.kind === 'drill' && PR.args && !PR.busy) dStart(PR.args, '刷题'); return; }
    if (act === 'dend') { if (!PR || PR.kind !== 'drill' || PR.busy) return; if (PR.res.some(Boolean)) { PR.ended = true; render(); window.scrollTo({ top: 0 }); } else { prStop(); render(); dLoad(); } return; }   // 中途结束：只算做了的
    if (act === 'dreload') { busy(a, true); dLoad(); return; }
    // 第 37 步
    if (act === 'words') { if (!wlOn() || T) return; prStop(); dropRound(); tab = 'words'; listView = false; wlInit(); window.scrollTo({ top: 0 }); wlRecheck(); return; }   // 每次进来都先清掉上次的整页，等这次的回复
    if (act === 'wreload') { if (tab === 'words') wlRecheck(); return; }
    if (act === 'wdrill') {
      if (tab !== 'words' || !WL) return;
      const dr = wlDrill(); if (!dr || !dr.scope) { if (dr && dr.why) toast(dr.why); return; }
      wlDrop(); dPre = dr; tab = 'drill'; window.scrollTo({ top: 0 }); render(); dLoad(); return;
    }
    if (act === 'ttypes') { const tid = a.dataset.tid; if (TT.open.has(tid)) TT.open.delete(tid); else { TT.open.add(tid); if (!TT.res.has(tid) || TT.res.get(tid).err) { TT.res.delete(tid); ttLoad(tid); } } render(); return; }
    if (act === 'ttre') { const tid = a.dataset.tid; TT.res.delete(tid); ttLoad(tid); return; }
    if (act === 'tyre') { TY = null; tyPaint(); tyLoad(); return; }
    if (act === 'esre') { ES = null; render(); esLoad(); return; }
    if (['all', 'rev', 'back', 'list', 'more', 'tstart'].includes(act)) dropRound();   // 转去做别的：还没回来的取卡请求作废
    if (act === 'ptest') { if (T) return; pStart({ tid: a.dataset.tid }, '练本次错题', 'test'); return; }
    if (act === 'pretest') { if (T) return; pStart({ rid: a.dataset.tid }, '整卷再做一遍', 'test'); return; }
    if (act === 'pgroup') { const ids = [...again].filter(id => pool().some(c => c.id === id) || cards().some(c => c.id === id)).slice(0, 40); pStart({ ids }, '只练不太确定/不会的词', 'study'); return; }
    if (act === 'pagain') { if (PR) pStart({ pid: PR.id }, '再练一遍错的', PR.back); return; }
    if (act === 'pexit') { const wasDrill = !!(PR && PR.kind === 'drill'); prStop(); render(); window.scrollTo({ top: 0 }); if (wasDrill) dLoad(); return; }
    if (act === 'pmore') { if (PR && (PR.tid || PR.rid) && PR.more) pStart(PR.rid ? { rid: PR.rid, part: PR.part + 1 } : { tid: PR.tid, part: PR.part + 1 }, PR.title, PR.back); return; }
    if (act === 'pprev') { if (PR && PR.qi > 0 && !PR.busy) { PR.qi--; PR.sel = PR.res[PR.qi] ? PR.res[PR.qi].mine : null; render(); } return; }
    if (act === 'pnext') { if (PR && (PR.res[PR.qi] || skipped()) && !PR.busy) { PR.qi++; PR.sel = PR.qi < PR.items.length && PR.res[PR.qi] ? PR.res[PR.qi].mine : null; render(); window.scrollTo({ top: 0 }); } return; }
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
    else if (act === 'round') startRound(a);
    else if (act === 'remark') flushMarks();
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
  // 刷题页「自己填」题数：只更新按钮和那一行（不重画整页，输入框不跳）
  // 词表搜索：打字停一下（300 毫秒）再读第一页；只换下面的列表，搜索框不动
  document.addEventListener('input', e => {
    if (!D || $('app').dataset.role === 'adm' || !e.target || e.target.id !== 'wq' || !WL || tab !== 'words') return;
    const v = e.target.value.trim().slice(0, 30);
    if (v === WL.q) return;
    WL.q = v; WL.off = 0; wlLoad(300);
  });
  // 第 38 步：快刷的卡片左右滑换词（横着滑 60 像素以上、比竖着多才算；滑完紧接着的「点一下」不翻面）
  document.addEventListener('pointerdown', e => { const c = e.target && e.target.closest && e.target.closest('#qfcard'); qfDown = c && LQ && tab === 'flash' ? { x: e.clientX, y: e.clientY, i: LQ.i } : null; });
  document.addEventListener('pointerup', e => {
    const d = qfDown; qfDown = null; if (!d || !LQ || tab !== 'flash' || LQ.i !== d.i) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { qfSwipeAt = Date.now(); qfMove(dx < 0 ? 1 : -1); }
  });
  document.addEventListener('pointercancel', () => { qfDown = null; });
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'lqset' && LQ) LQ.setOpen = e.target.open; }, true);
  // 「本周任务」点开、收起：记住（重画页面时照样）
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'task') taskOpen = e.target.open; if (e.target && e.target.id === 'wlf' && WL) WL.fopen = e.target.open; }, true);
  document.addEventListener('input', e => {
    if (!D || $('app').dataset.role === 'adm' || !e.target || e.target.id !== 'dcustom' || !DS) return;
    DS.custom = e.target.value.trim();
    document.querySelectorAll('[data-dn]').forEach(b => b.setAttribute('aria-pressed', DS.custom === '' && DS.n === +b.dataset.dn ? 'true' : 'false'));
    dPaint();
  });
  document.addEventListener('keydown', e => {
    if (!D || $('app').dataset.role === 'adm' || document.querySelector('.modal')) return;
    if (e.target && e.target.id === 'dcustom') { if (e.key === 'Enter') { const b = $('dgo'); if (b && !b.disabled) b.click(); } return; }
    if (PR) { if (PR.qi < PR.items.length && ['1', '2', '3', '4'].includes(e.key) && PR.items[PR.qi].o[+e.key - 1] !== undefined) pAnswer(+e.key - 1); return; }
    if (LQ && tab === LQ.kind && !(e.target && e.target.closest && e.target.closest('button,input,summary'))) {   // 第 38 步
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1; if (LQ.kind === 'flash') qfMove(d); else lsJump(d); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (LQ.kind === 'flash') qfFlip(); else if (LQ.playing) lsPause(); else lsPlay(); return; }
    }
    if (tab === 'study' && !flipped && !listView && (e.key === ' ' || e.key === 'Enter') && queue.length && !e.target.closest('button')) { e.preventDefault(); flip(); }
    else if (tab === 'study' && flipped && ['1', '2', '3'].includes(e.key)) rate({ 1: 'no', 2: 'mid', 3: 'ok' }[e.key]);
    else if (T && ['1', '2', '3', '4'].includes(e.key) && T.items[qi].o[+e.key - 1] !== undefined) pick(+e.key - 1);
    else if (T && !submitting && e.key === 'ArrowRight' && qi < T.items.length - 1) { qi++; render(); }
    else if (T && !submitting && e.key === 'ArrowLeft' && qi > 0) { qi--; render(); }
  });
  window.addEventListener('beforeunload', e => { if (unsaved.size || (T && !instant && (!stored || !canStore)) || (T && instant && (answering || pend.size))) { e.preventDefault(); e.returnValue = ''; } });
  return { start };
})();
