// 单词学习系统 · 管理端：学生、设置面板（全局 → 方案 → 学生三层）、改动记录
const Adm = (() => {
  let D = null, tab = 'stu', scope = 'global', tplKey = 'weak', stuKey = null, draft = null, savingCfg = false, copying = false;
  let stuFilter = 'all', stuQ = '', cfgCat = 'all';
  let copied = null, copyAt = null;   // 刚复制好、方案列表还没读到的新方案（记着它：不会让老师再复制一份）；点复制时在看的是哪一层
  let typing = false;                 // 这一页画出来以后老师在设置里输入过（数字框打字时还没离开、草稿还没更新，也算正在改）
  let draftBase = null, draftVer = null, rebase = null, detailSeq = 0, deciding = false;   // 草稿开始编辑时的设置和版本号（两个窗口同时改时用来核对、合并）
  const NUM = { srsN: ['个', 0, 200, 5], weekly: ['个', 10, 500, 10], days: ['天', 1, 7, 1], addN: ['个', 5, 100, 5], learnW: ['周', 1, 12, 1], revW: ['周', 0, 4, 1], pass: ['%', 50, 100, 5],
    revN: ['个', 10, 500, 10], revPass: ['%', 50, 100, 5], qEvery: ['周', 4, 52, 1], qN: ['个', 10, 1000, 10], qPass: ['%', 50, 100, 5], yEvery: ['周', 12, 104, 1], yN: ['个', 10, 2000, 10], yPass: ['%', 50, 100, 5],
    exPerWord: ['句', 1, 20, 1], exPerDay: ['次', 0, 5000, 10], exPerMin: ['次', 1, 60, 1], exInflight: ['个', 1, 50, 1], exNewsDays: ['天', 1, 365, 1], exNewsWin: ['天', 7, 365, 1], exNoMatchDays: ['天', 1, 60, 1],
    drillMax: ['题', 5, 500, 10], drillPer: ['题', 1, 5, 1], starN: ['次', 10, 1000, 10], starMinQ: ['道', 5, 500, 5], retestN: ['场', 0, 50, 1],
    tyDays: ['天', 7, 365, 1], tyMin: ['题', 1, 100, 1], lsRep: ['遍', 1, 5, 1], lsGap: ['秒', 0, 10, 0.5],   // 第 38 步：随身听（停几秒可以有一位小数）
    chkDays: ['天', 7, 365, 1], chkN: ['个', 1, 50, 1], chkMax: ['天', 7, 730, 10], rvDays: ['天', 0, 7, 1] };   // 第 39 步：一个月后抽查、回顾周每天的目标
  const LAB = { weekly: '每周新词数', days: '每周学几天', addOn: '再来一组', addN: '一组几个', mode: '学法', ratio: '各档比例', start: '从哪一档开始', only: '学哪几档',
    srsOn: '每天复习', srsN: '每天最多复习', learnW: '先学几周', revW: '回顾几周', untaught: '还没学的词', pass: '周测及格线', types: '周测题型', carryFail: '没及格带错词', carryPass: '及格也带错词', total: '下周学多少',
    revN: '回顾周抽多少', revMust: '错词一定抽到', revPass: '回顾周及格线', qOn: '季度测', qEvery: '季度测间隔', qN: '季度测抽多少', qPass: '季度测及格线',
    yOn: '年测', yEvery: '年测间隔', yN: '年测抽多少', yPass: '年测及格线', merge: '同周测验', dim: '答错变暗', tplOf: '方案',
    order: '本周词单顺序', instant: '答题时当场判对错', whyT: '当场显示解析的题型',
    exOn: '拓展例句', exWhoK: '知识例句用哪家', exWhoN: '时事例句用哪家', exModelA: 'Claude 模型', exModelO: 'OpenAI 模型', exPerWord: '每个词每类最多几句',
    exPerDay: '每人每天最多生成几次', exPerMin: '每人每分钟最多生成几次', exInflight: '全站同时生成几个', exNewsDays: '时事句多久换新', exNewsWin: '只用多少天内的新闻',
    exNoMatchDays: '找不到新闻后隔几天再搜', exDomains: '新闻只搜哪些网站',
    drillOn: '开放刷题', drillScopes: '刷题可选范围', drillMax: '每次最多几题', drillPer: '同一次同一个词最多几题', starShow: '题目上方显示档和难度星级',
    testFresh: '测验优先抽没练过的题', starAuto: '按真实答对率自动修正星级', starN: '作答多少次以后开始修正', starMinQ: '同一档至少几道够数的题才排位',
    drillOrder: '默认出题方式', drillOrders: '学生可以选的出题方式', retestN: '最近几场可以整卷再做',
    wlOn: '开放全部词表', wlSee: '没学过的词能不能看', tyDays: '题型表现「最近几天」', tyMin: '少于几题标「题少」',
    acOn: '刷题、练习里出「听音选意思」', lsOn: '开放随身听', lsRep: '随身听每个词连着播几遍', lsGap: '随身听词与词之间停几秒', lsEx: '随身听播例句', lsOrder: '随身听顺序',
    qfOn: '开放快刷', qfFront: '快刷先看哪一面', qfOrder: '快刷顺序',
    chkOn: '一个月后抽查', chkDays: '复习毕业满几天开始抽查', chkN: '每天最多抽查几个', chkMax: '抽查间隔最长几天', chkErr: '抽查忘了的进错词本', rvDays: '回顾周「复习本轮」分几天' };
  const WHO = { anthropic: '只用 Claude', openai: '只用 OpenAI', both: '两家轮流', off: '关闭' };
  const SW = ['srsOn', 'addOn', 'carryFail', 'carryPass', 'revMust', 'qOn', 'yOn', 'dim', 'instant', 'exOn', 'drillOn', 'starShow', 'testFresh', 'starAuto', 'wlOn', 'acOn', 'lsOn', 'lsEx', 'qfOn', 'chkOn', 'chkErr'];
  const WLSEE = [['all', '能看（学习范围里的词都列）'], ['learned', '只看学过的和本周的']];   // 第 37 步
  const has37 = () => !!(D && D.global && 'wlOn' in D.global);   // 数据库跑过第 37 步（所有学生的默认里有词表的设置）
  const has38 = () => !!(D && D.global && 'acOn' in D.global);   // 数据库跑过第 38 步（所有学生的默认里有听力、随身听、快刷的设置）
  const has39 = () => !!(D && D.global && 'chkOn' in D.global);   // 数据库跑过第 39 步（所有学生的默认里有一个月后抽查、回顾周每天的目标）
  const ORDS = [['seq', '按顺序'], ['rand', '打乱']];
  // 刷题可选范围（第 36 步）：没写的算开
  const DSC = [['learned', '学过的词'], ['err', '错词本里的词'], ['dwrong', '我刷题时错过的'], ['week', '本周的词'], ['all', '全部（含没学过的）']];
  const scOn = (v, k) => !(v && v[k] === false);
  const DORD = [['fresh', '优先没做过的'], ['done', '只出做过的题'], ['rand', '全部随机']];   // 刷题出题方式（第 36 步）
  const has36 = () => !!(D && D.global && 'drillOn' in D.global);   // 数据库跑过第 36 步（所有学生的默认里有刷题的设置）
  const SEGS = [['mode', 'c-mode'], ['total', 'c-total'], ['start', 'c-start'], ['untaught', 'c-untaught'], ['merge', 'c-merge'], ['order', 'c-order'], ['exWhoK', 'c-exWhoK'], ['exWhoN', 'c-exWhoN'], ['drillOrder', 'c-drillOrder'], ['wlSee', 'c-wlSee'], ['lsOrder', 'c-lsOrder'], ['qfFront', 'c-qfFront'], ['qfOrder', 'c-qfOrder']];
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
  // 11-27 折叠块：key 记开合（见 app.js 的 foldAttr）、def 默认开不开、title 标题（可以带 <small>）、stat 标题后面的数量或状态、body 里面的内容（都是已经转义好的网页代码）
  // 一整块（box）的标题就是折叠开关：后面接内容，最后接 '</details></section>'
  const secFold = (key, def, h2, stat, cls) => '<section class="box' + (cls ? ' ' + cls : '') + '"><details class="fold sec"' + foldAttr(key, def) + '><summary>' + h2 + '<span class="fst">' + (stat || '') + '</span></summary>';
  const foldHTML = (key, def, title, stat, body, id) => '<details class="fold"' + (id ? ' id="' + id + '"' : '') + foldAttr(key, def) + '><summary><span class="ftl">' + title + '</span>' + (stat ? '<span class="fst">' + stat + '</span>' : '') + '</summary><div class="fbd">' + body + '</div></details>';

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
    const tabs = [['stu', '学生'], ['cfg', '设置'], ['ex', '拓展例句'], ['qs', '题目难度'], ['wd', '词库'], ['log', '改动记录']];   // 第 40 步：词库
    let h = '<header class="top"><div class="wrap wide"><div class="row"><div class="brand"><span class="brand-mark" aria-hidden="true">管</span><div class="brand-txt"><b>单词系统 · 管理</b><span>' + esc(D.me) + '</span></div></div><div class="hdr-right">' + themeBarHTML() + '</div></div>' +
      '<div class="seg nav-main" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-atab="' + k + '" aria-pressed="' + (tab === k) + '">' + navIcon(k) + n + '</button>').join('') + '</div>' +
      (tab === 'cfg' ? '<div class="scope-wrap">' + scopeBar() + '</div>' : '') + '</div></header>';
    if (tab === 'stu') h += '<main class="wrap wide">' + stuHTML() + '</main>';
    else if (tab === 'log') h += '<main class="wrap wide">' + logHTML() + '</main>';
    else if (tab === 'ex') h += '<main class="wrap wide">' + exaHTML() + '</main>';
    else if (tab === 'qs') h += '<main class="wrap wide">' + qsHTML() + '</main>';
    else if (tab === 'wd') h += '<main class="wrap wide">' + wdHTML() + '</main>';   // 第 40 步
    else h += '<main class="wrap">' + (copied ? copyWarn() : '') + cfgHTML() + '</main>' + saveBar();
    $('app').innerHTML = h;
    if (tab === 'wd') wdBind();
    if (tab === 'cfg') {
      buildSteps(); loadDraft(); applyCfgCat();
      // 方案多、名字长时顶上一排横着滑：把选中的那个滑到看得见的地方
      const bar = document.querySelector('.seg.scopes'), on = bar && bar.querySelector('[aria-pressed="true"]');
      if (on && (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollLeft = Math.max(0, on.offsetLeft - 8);
    }
  }

  // ── 学生 ──
  function stuListHTML() {
    const t = TPL(), rqs = new Set(D.reqs.map(r => r.sid)), q = stuQ.trim().toLowerCase();
    const list = D.students.filter(s => {
      if (stuFilter === 'attn' && !(failOpen(s) || rqs.has(s.id))) return false;
      if (stuFilter === 'streak' && !(s.active && num(s.streak) > 0)) return false;
      if (!q) return true;
      return String(s.name || '').toLowerCase().includes(q) || String(s.grp || '').toLowerCase().includes(q) || String(t[s.plan] || s.plan || '').toLowerCase().includes(q);
    });
    if (!list.length) return '<div class="muted">没有符合筛选条件的学生。</div>';
    return '<div class="list">' + list.map(s => {
      const w = s.week, lt = s.last_test;
      const wk = w ? '第 ' + num(w.no) + ' 周' + (w.kind === 'R' ? '（回顾）' : '') + (w.cur ? (w.kind === 'L' ? (num(w.n) ? ' · 本周练过 ' + num(w.done) + '/' + num(w.n) : ' · <span class="chip warn">这周没有词</span>') : '') : '（已到期，学生还没打开新的一周）') : md(s.start) + ' 开始';
      const bar = w && w.cur && w.kind === 'L' && num(w.n) > 0 ? '<div class="stu-mini-track" aria-hidden="true"><div class="stu-mini-fill" style="width:' + Math.min(100, Math.round(num(w.done) * 100 / num(w.n))) + '%"></div></div>' : '';
      return '<div class="it clickable" data-stu="' + esc(s.id) + '" role="button" tabindex="0"><div class="main"><div class="nm">' + esc(s.name) + (s.grp ? ' <span class="chip">' + esc(s.grp) + '</span>' : '') + (s.streak ? ' <span class="chip ok">连续 ' + num(s.streak) + ' 天</span>' : '') + (s.active ? '' : ' <span class="chip bad">已停用</span>') + (rqs.has(s.id) ? ' <span class="chip warn">申请中</span>' : '') + (failOpen(s) ? ' <span class="chip bad">没及格待处理</span>' : '') + '</div>' +
        '<div class="sub">' + esc(t[s.plan] || s.plan) + (Object.keys(s.ov || {}).length ? ' · 单独改了 ' + Object.keys(s.ov).length + ' 项' : '') + (s.next_cut != null ? ' · 下周新词 ' + num(s.next_cut) + ' 个' : '') + '</div>' + bar + '</div>' +
        '<div class="sub side"><div>' + wk + ' · 累计学过 ' + num(s.learned) + ' · 全亮 ' + num(s.correct) + '</div>' +
        '<div>' + (lt ? '最近测验 ' + num(lt.score) + '/' + num(lt.total) + (lt.passed ? ' 及格' : lt.manual ? ' 放行' : ' 没及格' + (lt.fix ? '（已处理）' : '')) : '还没考过') + ' · ' + (s.last_seen ? '最后打开 ' + stamp(s.last_seen) : '还没打开过') + '</div></div></div>';
    }).join('') + '</div>';
  }
  function stuHTML() {
    let h = '<div class="row"><div class="muted">词库：' + LV.map(l => l + ' ' + (D.counts[l] || 0)).join(' · ') + '</div><button class="btn main" data-a="add">＋ 加学生</button></div>';
    if (D.reqs.length) h += '<div class="note rqbar"><span><b>有 ' + D.reqs.length + ' 个换方案申请</b>在等你处理</span><button class="gbtn" data-a="reqs">查看、处理</button></div>';
    const fs = failList();
    if (fs.length) h += '<div class="note rqbar fbar"><span><b>有 ' + fs.length + ' 个学生最近一次交卷没及格</b>：' + fs.slice(0, 3).map(x => esc(x.name) + '（' + esc(x.last_test.name || '') + ' ' + num(x.last_test.score) + '/' + num(x.last_test.total) + '）').join('、') + (fs.length > 3 ? ' 等' : '') + '</span><button class="gbtn" data-a="fails">查看、调整新词量</button></div>';
    if (!D.students.length) return h + '<div class="box"><h2>还没有学生</h2><div class="muted">点右上角「加学生」，加好后把专属链接发给学生，学生用手机打开就能学。</div></div>';
    const nAct = D.students.filter(s => s.active).length, nStr = D.students.filter(s => s.active && num(s.streak) > 0).length;
    h += '<div class="adm-kpis">' +
      '<div class="adm-kpi"><b>' + nAct + '</b><span>在读学生' + (D.students.length > nAct ? '（停用 ' + (D.students.length - nAct) + '）' : '') + '</span></div>' +
      '<div class="adm-kpi"><b>' + nStr + '</b><span>连续打卡中</span></div>' +
      '<div class="adm-kpi"><b>' + fs.length + '</b><span>待调量处理</span></div>' +
      '<div class="adm-kpi"><b>' + D.reqs.length + '</b><span>换方案申请</span></div></div>';
    h += '<div class="stu-bar"><input type="search" id="stuQ" maxlength="30" placeholder="搜学生名字、班级或方案…" value="' + esc(stuQ) + '" aria-label="搜学生" autocomplete="off" spellcheck="false">' +
      '<div class="seg" role="group" aria-label="筛选学生">' + [['all', '全部'], ['attn', '待处理'], ['streak', '打卡中']].map(([k, nm]) => '<button type="button" data-sf="' + k + '" aria-pressed="' + (stuFilter === k) + '">' + nm + '</button>').join('') + '</div></div>';
    h += '<div class="box" id="stuList">' + stuListHTML() + '</div>';
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
    // 11-27：折叠块标题上的数：调整有几项（这一周没有新词时多一项「补发新词」）；每一周里最近交的一场
    const refill = !!(cur && cur.kind === 'L' && !num(cur.nnew) && !cur.tested), adjN = refill ? 4 : 3;
    let lastW = null, lastX = null;
    for (const w of weeks) for (const x of (w.tests || [])) if (x.done && (!lastW || num(w.no) >= num(lastW.no))) { lastW = w; lastX = x; }
    const lastT = lastX ? '第 ' + num(lastW.no) + ' 周' + (KN[lastX.kind] || '') + ' ' + num(lastX.score) + '/' + num(lastX.total) + (lastX.passed ? ' 及格' : lastX.manual ? ' 放行' : ' 没及格') : '';
    const m = modal('<div class="row"><h2>' + esc(s.name) + ' <small class="muted">学生编号 ' + esc(String(sid).slice(0, 8)) + '</small></h2><button class="gbtn" data-close>关闭</button></div>' +
      '<div class="muted">' + esc(t[s.plan] || s.plan) + ' · ' + md(s.start) + ' 开始' + (s.memo ? ' · ' + esc(s.memo) : '') + '</div>' +
      (cur ? '<div class="note">现在第 <b>' + num(cur.no) + '</b> 周' + (cur.kind === 'R' ? '（回顾周）' : '') + '：' + md(cur.start) + '～' + md(cur.end) + (cur.kind === 'L' ? ' · 本周练过 <b>' + num(cur.done) + ' / ' + num(cur.n) + '</b>' : '') + '</div>' : '') +
      (failOpen(s) ? '<div class="warnbox">' + esc(s.last_test.name || '最近一次测验') + '没及格（' + num(s.last_test.score) + '/' + num(s.last_test.total) + '，及格线 ' + num(s.last_test.pass, 95) + '%）<button class="gbtn" data-d="fail">调整新词量</button></div>' :
        s.last_test && s.last_test.fix ? '<div class="note">' + esc(s.last_test.name || '最近一次测验') + '没及格，已处理：' + esc(fixTxt(s.last_test.fix)) + '</div>' : '') +
      // 11-27：常用的三个按钮直接放；打印、改名字/停用收进「更多操作」；调整、每一周、错过的词、抽查、刷题、各题型正确率各自折起来（标题写数量或状态）
      '<div class="row" style="justify-content:flex-start">' + (cur && cur.kind === 'L' ? '<button class="gbtn" data-d="words">这一周的词单（换词）</button>' : '') +
      '<button class="gbtn" data-d="cfg">改这个学生的设置</button><button class="gbtn" data-d="link">专属链接</button></div>' +
      '<div class="folds">' +
      foldHTML('det.more', false, '更多操作', '打印、改名字/备注/停用',
        '<div class="row" style="justify-content:flex-start"><button class="gbtn" data-d="pweek">打印' + (cur && cur.kind === 'R' ? '本轮复习的词' : '本周词单') + '</button><button class="gbtn" data-d="perr">打印错词本</button><button class="gbtn" data-d="edit">改名字/备注/停用</button></div>') +   // 第 40 步：打印
      foldHTML('det.adj', false, '调整这个学生 <small>只对这个学生、马上生效</small>', adjN + ' 项：延长 1 周' + (refill ? '、补发新词' : '') + '、下周新词数、手动放行' + (refill ? ' <span class="chip warn">这一周没有新词</span>' : ''),
        '<div class="form"><div class="row"><span>' + esc(extTxt) + '</span><button class="gbtn" data-d="extend"' + (cur ? '' : ' disabled') + '>延长 1 周</button></div>' +
        (refill ? '<div class="row"><span>' + (cur.check ? '<b>请核对：</b>旧记录分不清有没有给这个学生设过「下周暂停/减量」，这一周先没自动发词。确认要学的话，补发几个：' : '这一周没有新词（还没开考）。现在补发几个：') + '</span><span class="copyrow"><input id="refv" type="number" min="1" max="500" value="' + num(cur.weekly, 100) + '" style="width:80px" aria-label="补发几个新词"><button class="gbtn" data-d="refill">补发新词</button></span></div>' : '') +
        '<div class="row"><span>设置下周新词数（只改下一个学新词周，遇回顾周顺延；上周的错词照常全部带上；0 ＝ 暂停新词）</span><span class="copyrow"><input id="cutv" type="number" min="0" max="500" value="' + num(s.next_cut ?? 50, 50) + '" style="width:80px" aria-label="下周新词数"><button class="gbtn" data-d="cut">设好</button></span></div>' +
        '<div class="row"><span>把这一周最近交的那场记为及格（原分数保留）；以前的某一场在「每一周」表里点「记为及格」</span><button class="gbtn" data-d="pass">手动放行</button></div></div>') +
      foldHTML('det.weeks', false, '每一周', weeks.length + ' 周' + (lastT ? ' · 最近一次：' + lastT : ''),
        '<div class="scroll"><table class="t"><tr><th>周</th><th>开始</th><th>词数</th><th>练过</th><th>测验</th></tr>' +
        (weeks.length ? weeks.map(w => '<tr><td>第 ' + num(w.no) + ' 周' + (w.kind === 'R' ? '（回顾）' : '') + (w.extended ? '（延长）' : '') + '</td><td>' + md(w.start) + '</td><td>' + (w.kind === 'L' ? '共 ' + num(w.n) + ((w.carry || w.extra) ? '（' + [w.carry ? '错词 ' + num(w.carry) : '', w.extra ? '追加 ' + num(w.extra) : ''].filter(Boolean).join('、') + '）' : '') : (w.carry ? '错词 ' + num(w.carry) : '—')) + '</td><td>' + (w.kind === 'L' ? num(w.done) : '—') + '</td><td>' +
          ((w.tests || []).length ? w.tests.map(x => (KN[x.kind] || '') + ' ' + (x.done ? num(x.score) + '/' + num(x.total) + ' ' + (x.passed ? '<span class="chip ok">及格</span>' : x.manual ? '<span class="chip">放行</span>' : '<span class="chip bad">没及格</span> <button class="link" data-tpass="' + esc(x.id) + '">记为及格</button>') : '考到一半')).join('<br>') : '没考') + '</td></tr>').join('') : '<tr><td colspan="5" class="muted">' + (s.active ? '还没有开始的周（开课日之前不生成）' : '没有记录') + '</td></tr>') +
        '</table></div>') +
      foldHTML('det.wrong', false, '错过的词', wrong.length + ' 个' + (wrong.length > 60 ? '（下面显示错得最多的 60 个）' : ''),
        wrong.length ? '<div class="list">' + wrong.slice(0, 60).map(x => '<div class="it"><span><span class="nm" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r) + '</span></span><span class="sub">' + esc(x.m) + ' · 错 ' + num(x.times) + ' 次' + (x.st === 'correct' ? ' · 后来对了' : '') + (x.off ? ' · 已停用' : '') + '</span></div>').join('') + '</div>' : '<div class="muted">还没有。</div>') +
      (det.chk && typeof det.chk === 'object' ? foldHTML('det.chk', false, '一个月后抽查（试点）', (det.chk.on ? '开着' : '关着') + (num(det.chk.n) ? ' · 抽查了 ' + num(det.chk.n) + ' 个，忘了 ' + num(det.chk.forgot) + ' 个' : ''), chkHTML(det.chk)) : '') +   // 第 39 步
      foldHTML('det.drill', false, '刷题 <small>不算成绩、不进错词本</small>', '<span id="dsum">正在读取……</span>', '<div id="dstat" class="muted">正在读取……</div>') +
      (has37() ? foldHTML('det.types', false, '各题型正确率', '正式测验、刷题分开看', '<div class="small muted">和学生「进度」页看到的一样</div><div id="tstat" class="muted">正在读取……</div>') : '') +
      '</div>');
    m.classList.add('det');
    drillStats(sid, m, seq);
    if (has37()) typeStats(sid, m, seq);   // 第 37 步
    let acting = false;
    m.addEventListener('click', async e => {
      const tp = e.target.closest('[data-tpass]');
      if (tp) { if (tp.disabled || acting) return; acting = true; tp.disabled = true; try { await rpc('adm_test_pass', { tid: tp.dataset.tpass }); toast('已记为及格（原分数保留）'); m.close(); await reload(); detailModal(sid); } catch (er) { fail(er); tp.disabled = false; } acting = false; return; }
      const b = e.target.closest('[data-d]'); if (!b || b.disabled || acting) return;
      const d = b.dataset.d;
      if (d === 'link') { acting = true; try { const k = await rpc('adm_student_key', { sid, fresh: false }, { str: true }); m.close(); linkModal(sid, k); } catch (er) { fail(er); } acting = false; return; }
      if (d === 'cfg') { m.close(); tab = 'cfg'; scope = 'stu'; stuKey = sid; draft = null; render(); return; }
      if (d === 'edit') { m.close(); editModal(sid); return; }
      if (d === 'fail') { m.close(); failModal(sid, s.last_test.id); return; }
      if (d === 'words') { m.close(); wordsModal(sid); return; }
      if (d === 'pweek' || d === 'perr') {   // 第 40 步：打印这个学生本周的词单（回顾周＝本轮复习的词）或错词本（只读：不建周、不改学习记录）
        acting = true; busy(b, true);
        let r = null; try { r = await rpc('adm_word', { act: 'print', a: { sid, kind: d === 'perr' ? 'err' : 'week' } }, { obj: true, timeout: 30000 }); } catch (er) { toast(wdErr(er)); }
        acting = false; busy(b, false);
        if (m.isConnected) try { b.focus({ preventScroll: true }); } catch (er) {}   // 11-27：等回复时按钮暂时不能点、焦点丢了：放回这个按钮（打印对话框关掉以后焦点回到这里）
        if (!r || !m.isConnected || seq !== detailSeq) return;
        if (r.state !== 'ok') { toast(r.msg || '没有可以打印的词'); return; }
        const wk = r.week || {}, nOff = num(r.off);
        if (!(r.words || []).length) { toast(d === 'perr' ? '错词本里没有可以打印的词' + (nOff ? '（' + nOff + ' 个已停用）' : '') : '这一周没有可以打印的词'); return; }
        printDialog({ title: d === 'perr' ? '错词本' : wk.kind === 'R' ? '第 ' + num(wk.no) + ' 周（回顾周）本轮复习的词' : '本周的词（第 ' + num(wk.no) + ' 周）', who: r.name || s.name, words: r.words, exOk: true, note: nOff ? '已停用的 ' + nOff + ' 个不印' : '' });
        return;
      }
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
  // 学生详情里的一个月后抽查（第 39 步）：抽查了几个、忘了几个（比例）、最近 30 天；复习毕业的词几个、到了抽查日子的几个；这个学生现在的设置；最近忘了的词
  function chkHTML(c) {
    const pc = (a, b) => num(b) ? Math.round(num(a) * 100 / num(b)) + '%' : '—', rc = Array.isArray(c.recent) ? c.recent : [];
    const set = '设置：毕业满 ' + num(c.days, 30) + ' 天开始、每天最多 ' + num(c.per, 5) + ' 个、间隔最长 ' + num(c.max, 90) + ' 天、忘了的' + (c.err ? '进' : '不进') + '错词本';
    if (!num(c.n)) return '<div class="muted small" id="chkst">' + (c.on ? '还没抽查过。' : '这个学生没开（要试用请在「改这个学生的设置」里打开）。') + '复习毕业的词 ' + num(c.grad) + ' 个' + (c.on ? '，到了抽查日子的 ' + num(c.due) + ' 个' : '') + '。' + (c.on ? set : '') + '</div>';
    return '<div id="chkst"><div class="stats"><div class="stat"><b>' + num(c.n) + '</b><span>一共抽查了</span></div><div class="stat"><b>' + num(c.forgot) + '</b><span>忘了（' + pc(c.forgot, c.n) + '）</span></div>' +
      '<div class="stat"><b>' + num(c.n30) + '</b><span>最近 30 天（忘了 ' + num(c.forgot30) + ' 个，' + pc(c.forgot30, c.n30) + '）</span></div></div>' +
      '<div class="small muted">复习毕业的词 ' + num(c.grad) + ' 个，到了抽查日子的 ' + num(c.due) + ' 个' + (num(c.inbook) ? ' · 忘了记进错词本的 ' + num(c.inbook) + ' 个' : '') + (c.last ? ' · 最后一次 ' + md(c.last) : '') + ' · ' + set + '</div>' +
      (rc.length ? '<div class="small muted" style="margin-top:6px">最近忘了的词（回到每天复习了）</div><div class="list">' + rc.map(x => '<div class="it"><span><span class="nm" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r && x.r !== x.w ? x.r : '') + '</span></span><span class="sub">' + esc(x.m) + ' · ' + md(x.d) + (x.err ? ' · 进了错词本' : '') + '</span></div>').join('') + '</div>' : '') + '</div>';
  }
  // 学生详情里的刷题统计（第 36 步）：总题数、正确率、最近 7 天／30 天、按题型、刷题常错的词前 20 个
  async function drillStats(sid, m, seq) {
    let r = null, err = null;
    try { r = await rpc('adm_stu_op', { sid, act: 'drill', a: {} }, { obj: true }); } catch (e) { err = e; }
    const el = m.querySelector('#dstat'); if (!el || seq !== detailSeq || !m.isConnected) return;
    const sm = m.querySelector('#dsum'), sum = t => { if (sm) sm.textContent = t; };   // 11-27：折叠块标题上写一句
    if (err) { el.textContent = '没读到（' + err.message + '）'; sum('没读到'); return; }
    const pc = (a, b) => num(b) ? Math.round(num(a) * 100 / num(b)) + '%' : '—';
    const d7 = r.d7 || {}, d30 = r.d30 || {}, ty = r.types || {}, top = Array.isArray(r.top) ? r.top : [];
    if (!num(r.n)) { el.textContent = '还没刷过题。'; sum('还没刷过题'); return; }
    sum('一共 ' + num(r.n) + ' 题，正确率 ' + pc(r.right, r.n));
    el.classList.remove('muted');
    el.innerHTML = '<div class="stats"><div class="stat"><b>' + num(r.n) + '</b><span>一共刷的题</span></div><div class="stat"><b>' + pc(r.right, r.n) + '</b><span>正确率</span></div><div class="stat"><b>' + num(d7.n) + '</b><span>最近 7 天（正确率 ' + pc(d7.right, d7.n) + '）</span></div></div>' +
      '<div class="small muted">最近 30 天 ' + num(d30.n) + ' 题，正确率 ' + pc(d30.right, d30.n) + (r.last ? ' · 最后一次 ' + stamp(r.last) : '') + '</div>' +
      '<div class="scroll"><table class="t dst-t"><tr><th>题型</th><th>题数</th><th>正确率</th></tr>' + TYN.map(([k]) => k).filter(k => ty[k]).map(k => '<tr><td' + (QT[k] ? ' lang="ja"' : '') + '>' + tyName(k) + '</td><td>' + num(ty[k].n) + '</td><td>' + pc(ty[k].right, ty[k].n) + '</td></tr>').join('') + '</table></div>' +
      (top.length ? '<div class="small muted" style="margin-top:6px">刷题常错的词（前 ' + top.length + ' 个）</div><div class="list">' + top.map(x => '<div class="it"><span><span class="nm" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r && x.r !== x.w ? x.r : '') + '</span> <span class="chip" data-lv="' + esc(x.lvl) + '">' + esc(x.lvl) + '</span></span><span class="sub">' + esc(x.m) + ' · 错 ' + num(x.wrong) + ' / ' + num(x.n) + ' 次</span></div>').join('') + '</div>' : '');
  }
  // 学生详情里的各题型正确率（第 37 步）：正式测验（交了卷的，没答的算错）、刷题（只算答了的）分开；最近几天／全部可以切换；题数少的标「题少」
  const TYN = [['yomi', '漢字読み'], ['hyoki', '表記'], ['bunmyaku', '文脈規定'], ['iikae', '言い換え'], ['yoho', '用法'], ['jc', '看日语选中文'], ['cj', '看中文选日语'], ['kr', '看汉字选读音'], ['ac', '听音选意思']];
  const tyName = t => (TYN.find(([k]) => k === t) || [, '其他'])[1];
  const tyKeys = (...objs) => TYN.map(([t]) => t).concat(objs.flatMap(o => Object.keys(o || {}))).filter((t, i, a) => a.indexOf(t) === i && objs.some(o => o && o[t] && num(o[t].n)));
  const tyCell = (x, mn, two) => x && num(x.n) ? '<b>' + Math.round(num(x.right) * 100 / num(x.n)) + '%</b>' + (two ? '<br>' : ' ') + '<span class="small muted">' + num(x.right) + '/' + num(x.n) + '</span>' + (num(x.n) < mn ? ' <span class="chip warn">题少</span>' : '') : '<span class="muted">—</span>';   // two：百分比和题数分两行（列多的表）
  async function typeStats(sid, m, seq) {
    let r = null, err = null;
    try { r = await rpc('adm_stu_op', { sid, act: 'types', a: {} }, { obj: true }); } catch (e) { err = e; }
    const el = m.querySelector('#tstat'); if (!el || seq !== detailSeq || !m.isConnected) return;
    if (err) { el.textContent = '没读到（' + err.message + '）'; return; }
    let all = false;
    const paint = () => {
      const k = all ? 'all' : 'recent', A = (r.test || {})[k] || {}, B = (r.drill || {})[k] || {}, mn = num(r.min, 10), ks = tyKeys(A, B);
      el.classList.remove('muted');
      el.innerHTML = '<div class="seg" role="group" aria-label="看哪段时间"><button type="button" data-tya="0" aria-pressed="' + !all + '">最近 ' + num(r.days, 30) + ' 天</button><button type="button" data-tya="1" aria-pressed="' + all + '">全部</button></div>' +
        (ks.length ? '<div class="scroll"><table class="t dst-t"><tr><th>题型</th><th>正式测验</th><th>刷题</th></tr>' + ks.map(t => '<tr><td lang="ja">' + esc(tyName(t)) + '</td><td>' + tyCell(A[t], mn) + '</td><td>' + tyCell(B[t], mn) + '</td></tr>').join('') + '</table></div>' : '<div class="muted">' + (all ? '还没有交过卷、也没刷过题。' : '这段时间没有交过卷、也没刷过题。') + '</div>') +
        '<div class="small muted">正式测验 ' + (all ? '一共 ' + num(r.test && r.test.tests) : '最近 ' + num(r.days, 30) + ' 天 ' + num(r.test && r.test.rtests)) + ' 场（没答的题算错，和成绩一样）；刷题只算答了的。少于 ' + mn + ' 题标「题少」。</div>';
    };
    paint();
    el.addEventListener('click', e => { const b = e.target.closest('[data-tya]'); if (!b) return; all = b.dataset.tya === '1'; paint(); });
  }
  // ── 考没过后「调整新词量」 ──
  // 最近一次正式交卷没及格（老师放行的不算）、还没处理
  const failOpen = s => { const lt = s && s.last_test; return !!(s && s.active && lt && lt.id && num(lt.total) && !lt.passed && !lt.manual && !lt.fix); };
  const failList = () => D.students.filter(failOpen);
  // 打开新弹窗前收起上一条黑色提示（不挡弹窗里的内容）
  const quiet = () => { const el = $('toast'); if (el) { el.hidden = true; clearTimeout(toast.h); } };
  // 一周的安排（服务器按实际发词规则算好的，老师端、学生端、处理记录用同一个结果）
  const wkTxt = w => w && w.no ? '第 ' + num(w.no) + ' 周（' + md(w.start) + ' 开始）' : '';
  function firstTxt(pl) {
    const f = pl && pl.first; if (!f) return '';
    if (f.rule === 'B') return '总数 ' + num(f.total) + ' 个（其中预计新词 ' + num(f.new) + '、带回错词 ' + num(f.carry) + (num(f.over) ? '，错词多出的 ' + num(f.over) + ' 个往后排' : '') + '）';
    return num(f.new) === 0 ? '暂停新词，只学带回的错词 ' + num(f.carry) + ' 个' : '新词 ' + num(f.new) + '＋带回错词 ' + num(f.carry) + '＝' + num(f.total) + ' 个';
  }
  // 处理记录里「原来」的说法：「总数不变」写原总数和其中预计新词
  const firstShort = f => !f ? '' : f.rule === 'B' ? '总数 ' + num(f.total) + ' 个（其中预计新词 ' + num(f.new) + ' 个）' : '新词 ' + num(f.new) + ' 个';
  const secondTxt = pl => { const s = pl && pl.second; return s ? (s.rule === 'B' ? '每周总数 ' + num(s.total) + ' 个' : '每周新词 ' + num(s.new) + ' 个') : ''; };
  function planTxt(pl) {
    if (!pl || !pl.target) return '';
    const th = pl.then && pl.then.no ? '第 ' + num(pl.then.no) + ' 周起' : '之后';
    return wkTxt(pl.target) + '：' + firstTxt(pl) + '；' + th + (pl.how === 'once' ? '恢复' : '') + secondTxt(pl) + '。';
  }
  // 保存时带回：这份方案怎么改、数字、保留选择、指纹（服务器在锁里重算，指纹不一样就不保存）
  const seenOf = pl => ({ target_no: pl.target && pl.target.no, target_start: pl.target && pl.target.start, old_cut: pl.old_cut, old_weekly: pl.old_weekly, b: pl.b });
  const planArgs = pl => ({ how: pl.how, n: pl.n, cut: pl.cut || null, sig: pl.sig, base: pl.base, seen: seenOf(pl) });
  function fixTxt(f) {
    if (!f) return '';
    const who = '（' + (f.by || '老师') + '，' + stamp(f.at) + '）', f0 = f.plan0 && f.plan0.first;
    if (f.how === 'once') return '第 ' + num(f.no) + ' 周新词改为 ' + num(f.n) + ' 个' + (num(f.n) === 0 ? '（暂停新词）' : '') + '，原来' + (f0 ? firstShort(f0) : ' ' + num(f.old) + ' 个') + who;
    if (f.how === 'long') return '每周' + (f.plan && f.plan.b ? '总数 ' : '新词 ') + num(f.old_weekly) + ' → ' + num(f.n) + ' 个，从第 ' + num(f.long_from || f.no) + ' 周起' +
      (f.kept != null ? '（第 ' + num(f.no) + ' 周仍是之前单独设的 ' + num(f.kept) + ' 个）' : '') + who;
    return '维持原量（第 ' + num(f.no) + ' 周 ' + firstShort(f0 || (f.plan && f.plan.first)) + '）' + who;
  }
  function failsModal() {
    quiet();
    const fs = failList();
    if (!fs.length) { toast('现在没有待处理的没及格'); return; }
    const m = modal('<div class="row"><h2>最近一次交卷没及格 <small class="muted">' + fs.length + ' 个学生</small></h2><button class="gbtn" data-close>关闭</button></div>' +
      '<div class="muted">只看每个学生最近一次交卷（老师放行的不算）。老师暂时不处理的话，学生照日历继续学（不卡进度）。处理过的不再提示。</div><div class="list">' +
      fs.map(x => '<div class="it"><div class="main"><div class="nm">' + esc(x.name) + '</div><div class="sub">' + esc(x.last_test.name || '') + ' ' + num(x.last_test.score) + '/' + num(x.last_test.total) + '，及格线 ' + num(x.last_test.pass, 95) + '% · ' + stamp(x.last_test.at) + '</div></div>' +
        '<div class="side"><button type="button" class="gbtn" data-fx="' + esc(x.id) + '">调整新词量</button></div></div>').join('') + '</div>');
    m.addEventListener('click', e => { const b = e.target.closest('[data-fx]'); if (!b) return; const x = stuOf(b.dataset.fx); m.close(); if (x && x.last_test) failModal(x.id, x.last_test.id); });
  }
  async function failModal(sid, tid) {
    quiet();
    let d; try { d = await rpc('adm_stu_op', { sid, act: 'fail', a: { tid } }, { obj: true }); } catch (e) { fail(e); return; }
    const s = stuOf(sid) || { name: '' }, te = d.test || {}, wr = Array.isArray(d.wrong) ? d.wrong : [];
    let pl = d.plan || {};
    const head = '<div class="row"><h2>' + esc(s.name) + '：调整新词量</h2><button class="gbtn" data-close>关闭</button></div>' +
      '<div><b>' + esc(te.name || '') + '</b>：' + num(te.score) + ' / ' + num(te.total) + '，及格线 ' + num(te.pass, 95) + '%' + (te.at ? '（' + stamp(te.at) + ' 交卷）' : '') + '</div>';
    const wrongH = '<details><summary>本次错词 ' + wr.length + ' 个</summary><div class="list">' + wr.map(x => '<div class="it"><span><span class="nm" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r) + '</span></span><span class="sub">' + esc(x.m) + '</span></div>').join('') + '</div></details>';
    if (d.fix) { modal(head + wrongH + '<div class="note pok">已处理：' + esc(fixTxt(d.fix)) + '</div><button class="btn" data-close>好的</button>'); return; }
    if (!te.latest) { modal(head + '<div class="warnbox">这个学生之后又交过卷了，只处理最近一次交卷。请关掉，从学生页顶上重新打开。</div><button class="btn" data-close>好的</button>'); return; }
    const base = pl.old_cut != null ? num(pl.old_cut) : num(pl.old_weekly);
    const m = modal(head +
      '<div class="note" id="fxk"></div>' + wrongH +
      '<form class="form" id="fxf"><label>新词数<input id="fxn" type="number" inputmode="numeric" min="0" max="500" value="' + Math.floor(base / 2) + '" style="max-width:120px"></label>' +
      '<div class="small" id="fxw" role="status"></div><div class="fxp" id="fxp" aria-live="polite"></div>' +
      '<div class="fxb"><button type="button" class="btn main" data-fh="once" disabled>只改下个新学周</button><button type="button" class="btn" data-fh="long" disabled>从下个新学周起每周都改</button><button type="button" class="btn" data-fh="keep" disabled>维持原量</button></div>' +
      '<div class="small muted">只改下个新学周：写进「下周新词数」，只减新词、错词照常全部带上，填 0＝暂停新词。每周都改：写进这个学生自己的每周新词数（10～500），以后在「单个学生」设置里点「跟随上一级」就恢复。' +
      '每个按钮保存的就是上面显示的那一份；数字改了要等重新算好才能点，保存时会再核对一次，情况变了会请你再确认。</div></form>');
    const inp = m.querySelector('#fxn'), pv = m.querySelector('#fxp'), kp = m.querySelector('#fxk'), wn = m.querySelector('#fxw');
    // 每个按钮绑定它自己最后一次算好、显示出来的那份方案；没有（正在算、算失败、数字不合格、情况变了正在重算）就不能点
    let ready = { once: null, long: null, keep: null }, acting = false;
    const setBtns = () => m.querySelectorAll('[data-fh]').forEach(b => { b.disabled = acting || !ready[b.dataset.fh]; });
    // 「维持原量」和现在的情况
    const showKeep = () => {
      kp.innerHTML = '现在是第 ' + num(pl.cur_no) + ' 周（已经发了的词单不改）。下个新学周：<b>' + esc(wkTxt(pl.target)) + '</b>' + (num(pl.target && pl.target.skip) ? '（前面 ' + num(pl.target.skip) + ' 周是回顾周，跳过）' : '') +
        '。不改的话：' + esc(firstTxt(pl)) + (pl.old_cut != null ? '（之前单独设的「下周新词数」）' : d.own_weekly ? '（这个学生自己的每周新词数）' : '') +
        (pl.b ? '；「下周学多少」选的是总数不变（错词先占位）' : '') + (pl.open ? '。这周还没结束，错词数是现在的，届时按实际带上' : '') + '。';
    };
    showKeep();
    // 一次请求、同一把锁里算三份（维持、只改一周、每周都改），顶上「现在的样子」和三个按钮都用这一次的结果；后发的请求才算数
    let pseq = 0, ptimer = 0;
    // 回复要齐：指纹、基准、怎么改和按钮一致；页面上显示的周号、日期、各发多少（first）、之后每周多少（second）都要是数字
    const isN = v => Number.isInteger(v) && v >= 0, isWk = w => !!w && Number.isInteger(w.no) && w.no > 0 && typeof w.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.start);
    const okPlan = (x, base, how) => !!x && typeof x.sig === 'string' && x.base === base && x.how === how && isWk(x.target) && (x.then == null || isWk(x.then))
      && !!x.first && ['cut', 'A', 'B'].includes(x.first.rule) && isN(x.first.new) && isN(x.first.total) && isN(x.first.carry)
      && !!x.second && (x.second.rule === 'B' ? isN(x.second.total) : x.second.rule === 'A' && isN(x.second.new)) && isN(x.cur_no);
    const preview = () => {
      clearTimeout(ptimer);
      const raw = inp.value.trim(), v = Number(raw), my = ++pseq, good = raw !== '' && Number.isInteger(v) && v >= 0 && v <= 500;
      ready = { once: null, long: null, keep: null }; setBtns();
      pv.innerHTML = raw === '' ? '<div class="muted">请填写新词数（只改一周时填 0＝暂停新词）</div>' : !good ? '<div class="muted">请填 0～500 之间的整数</div>' : '<div class="muted">正在算……</div>';
      ptimer = setTimeout(async () => {
        let r = null, err = null;
        try {
          r = await rpc('adm_stu_op', { sid, act: 'plans', a: { tid, n: good ? v : '' } }, { obj: true });
          // 回复不完整（缺指纹、三份的基准对不上）也当没算出来
          if (!r || typeof r.base !== 'string' || !okPlan(r.keep, r.base, 'keep') || (good && !okPlan(r.once, r.base, 'once')) || (good && v >= 10 && !okPlan(r.long, r.base, 'long'))) throw new Error('回复不对');
        } catch (e) { err = e; }
        if (my !== pseq || !m.isConnected) return;
        if (err) {   // 没算出来：都不能点，给「重新算」
          pv.innerHTML = '<div class="warnbox">预览没算出来：' + esc(err.message) + ' <button type="button" class="gbtn" data-fxr>重新算</button></div>';
          return;
        }
        const a1 = good ? r.once : null, a2 = good && v >= 10 ? r.long : null;
        pl = r.keep; if (typeof r.own_weekly === 'boolean') d.own_weekly = r.own_weekly;   // 第 36 步：这个学生自己的每周新词数也跟着这一次刷新（别的老师可能刚改过）
        showKeep();
        ready = { keep: r.keep, once: a1, long: a2 };
        if (good) pv.innerHTML = (a1 ? '<div><b>只改下个新学周：</b>' + esc(planTxt(a1)) + '</div>' : '') +
          '<div><b>每周都改：</b>' + (a2 ? esc(planTxt(a2)) + (a2.old_cut != null ? '（第 ' + num(a2.target.no) + ' 周已经单独设过 ' + num(a2.old_cut) + ' 个，保存时会问要不要保留）' : '') : '每周新词数要 10～500') + '</div>';
        setBtns();
      }, 300);
    };
    inp.addEventListener('input', () => { wn.innerHTML = ''; preview(); }); preview();
    const send = async plan => {
      if (!plan || acting) return;
      acting = true; setBtns(); wn.innerHTML = '';
      let r; try { r = await rpc('adm_stu_op', { sid, act: 'adjust', a: Object.assign({ tid }, planArgs(plan)) }, { obj: true }); }
      catch (er) { acting = false; setBtns(); fail(er); if (/已经处理过|及格|又交过卷/.test(er.message)) { m.close(); await reload(); } return; }
      acting = false;
      if (!m.isConnected) return;
      if (r.stale) {
        // 情况变了（发了新的一周、别的老师改了设置、错词数变了）：不保存；三个按钮先都不能点，重新算好、显示出来以后老师再点
        preview();
        wn.innerHTML = '<div class="warnbox">' + esc(r.msg || '情况变了，请看新的预览再确认一次') + '</div>';
        return;
      }
      if (r.confirm) {
        setBtns(); quiet();
        const t1 = '第 ' + num(r.target && r.target.no) + ' 周';
        const ch = await ask(t1 + '已经单独设过新词数', '保留：' + esc(planTxt(r.keep_plan)) + '<br>也改：' + esc(planTxt(r.clear_plan)),
          [['keep', '保留' + t1 + ' ' + num(r.cut) + ' 个', true], ['clear', t1 + '也改成 ' + num(r.n) + ' 个'], ['no', '先不改']]);
        if ((ch === 'keep' || ch === 'clear') && m.isConnected) send(ch === 'keep' ? r.keep_plan : r.clear_plan);   // 提交确认框里显示的那一份
        return;
      }
      toast('已处理：' + fixTxt(r.fix)); m.close(); await reload();
    };
    m.addEventListener('click', e => {
      if (e.target.closest('[data-fxr]')) { preview(); return; }
      const b = e.target.closest('[data-fh]'); if (!b || b.disabled || acting) return;
      send(ready[b.dataset.fh]);
    });
    m.querySelector('#fxf').addEventListener('submit', e => e.preventDefault());
  }

  // ── 这一周的词单：换掉个别词 ──
  const SRCN = { carry: '上周错词', extra: '追加', new: '新词' };
  async function wordsModal(sid, done) {
    quiet();
    let d; try { d = await rpc('adm_stu_op', { sid, act: 'wlist', a: {} }, { obj: true }); } catch (e) { fail(e); return; }
    const s = stuOf(sid) || { name: '' }, ws = Array.isArray(d.words) ? d.words : [], wk = d.week || {};
    document.querySelectorAll('.modal.wds').forEach(x => x.close ? x.close() : x.remove());
    const m = modal('<div class="row"><h2>' + esc(s.name) + '：第 ' + num(wk.no) + ' 周词单 <small class="muted">' + ws.length + ' 个</small></h2><button class="gbtn" data-close>关闭</button></div>' +
      (done ? '<div class="note pok" role="status">' + esc(done) + '</div>' : '') +
      (d.can ? '<div class="muted">周测开考前可以换。「换掉」＝从同一档按常用顺序补一个没学过的新词；也可以「指定」换成哪个词。换下来的新词回到词库（这周练过的记录作废）；换下来的上周错词仍在错词本里，这周不学不考，从下个学新词周起优先带上。</div>'
             : '<div class="warnbox">' + esc(d.why || '现在不能换') + '</div>') +
      '<div class="list">' + ws.map(x => '<div class="it"><div class="main"><div class="nm"><span lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r) + '</span> <span class="chip">' + esc(x.lvl) + '</span>' +
        (x.src !== 'new' ? ' <span class="chip warn">' + SRCN[x.src] + '</span>' : '') + (x.done ? ' <span class="chip ok">练过</span>' : '') + (x.off ? ' <span class="chip">已停用</span>' : '') + '</div><div class="sub">' + esc(x.m) + '</div></div>' +
        (d.can ? '<div class="side"><button type="button" class="gbtn" data-sw="' + esc(x.id) + '">换掉</button> <button type="button" class="link" data-sp="' + esc(x.id) + '">指定</button></div>' : '') + '</div>').join('') + '</div>');
    m.classList.add('wds');
    let acting = false;
    m.addEventListener('click', async e => {
      const sw = e.target.closest('[data-sw]'), sp = e.target.closest('[data-sp]');
      if (sp) { const x = ws.find(y => y.id === sp.dataset.sp); if (x) pickWordModal(sid, wk.id, x); return; }
      if (!sw || sw.disabled || acting) return;
      acting = true; busy(sw, true);
      let msg = '';
      try { msg = swapMsg(await rpc('adm_stu_op', { sid, act: 'wswap', a: { wk: wk.id, from: sw.dataset.sw } }, { obj: true })); }
      catch (er) { fail(er); }
      acting = false; wordsModal(sid, msg);
    });
  }
  // 换好以后的说明（写在重新打开的词单顶上，不用会挡住列表的黑色提示）
  const swapMsg = r => '已换：「' + r.from.w + '」→「' + r.to.w + '」' + (r.hold_no ? '；「' + r.from.w + '」这周不学不考，第 ' + num(r.hold_no) + ' 周起优先带' : '') + '（学生刷新后看到）';
  // 指定换成哪个词：输入词号或写法找（只给学习范围里、没学过、没停用的）
  function pickWordModal(sid, wk, x) {
    quiet();
    const m = modal('<h2>把「' + esc(x.w) + '」换成…</h2><form class="form" id="pkf"><div class="copyrow"><input id="pkq" maxlength="20" placeholder="词的写法、读音或编号"><button class="gbtn">找</button></div></form><div id="pkr" class="checks"></div><button class="btn" data-close>取消</button>');
    const q = m.querySelector('#pkq'), out = m.querySelector('#pkr');
    m.querySelector('#pkf').addEventListener('submit', async e => {
      e.preventDefault();
      let r; try { r = await rpc('adm_stu_op', { sid, act: 'wfind', a: { q: q.value.trim() } }); } catch (er) { fail(er); return; }
      out.innerHTML = (r || []).length ? r.map(c => '<button type="button" class="ck" data-to="' + esc(c.id) + '">' + esc(c.lvl + ' ' + c.w + '（' + c.r + '）' + c.m) + '</button>').join('') : '<div class="muted">没找到（只找学习范围里、没学过、没停用的词）</div>';
    });
    out.addEventListener('click', async e => {
      const b = e.target.closest('[data-to]'); if (!b || b.disabled) return;
      out.querySelectorAll('[data-to]').forEach(y => y.disabled = true);
      try { const r = await rpc('adm_stu_op', { sid, act: 'wswap', a: { wk, from: x.id, to: b.dataset.to } }, { obj: true }); m.close(); wordsModal(sid, swapMsg(r)); }
      catch (er) { fail(er); out.querySelectorAll('[data-to]').forEach(y => y.disabled = false); }
    });
    setTimeout(() => q.focus(), 50);
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
    const one = x => {
      const its = Array.isArray(x.items) ? x.items : [];
      const tail = x.eff ? '（' + md(x.eff) + '起生效）' : '';
      if (!its.length) return '<div><time>' + stamp(x.at) + '</time><span>' + esc(x.txt) + tail + '</span></div>';
      return '<div><time>' + stamp(x.at) + '</time><details' + (its.length === 1 ? ' open' : '') + '><summary>' + esc(x.txt) + tail + '</summary><ul>' + its.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></details></div>';
    };
    // 11-27：先列最近 30 条，更早的收进下面的折叠块
    const N = 30, top = D.logs.slice(0, N), old = D.logs.slice(N);
    return '<div class="box"><h2>改动记录 <small>最近 ' + D.logs.length + ' 条（最多留 200 条）</small></h2><div class="log">' + top.map(one).join('') + '</div>' +
      (old.length ? foldHTML('log.old', false, '更早的改动', old.length + ' 条（' + md(old[old.length - 1].at) + '～' + md(old[0].at) + '）', '<div class="log">' + old.map(one).join('') + '</div>') : '') + '</div>';
  }

  // ── 题目难度页（第 36 步）：各档星级分布、够数的题、星级和初始不一样的题；可以马上重算 ──
  let QS = null, qsBusy = false, qsSeq = 0;
  const QT = { yomi: '漢字読み', hyoki: '表記', bunmyaku: '文脈規定', iikae: '言い換え', yoho: '用法' };
  const starTxt = v => Number.isInteger(v) && v >= 1 && v <= 5 ? '★'.repeat(v) : '—';
  const qsArgs = extra => Object.assign({ view: (QS && QS.view) || 'diff' }, QS && QS.lv ? { lv: QS.lv } : {}, extra || {});
  async function qsLoad(act, a) {
    if (qsBusy && act !== 'load') return;
    const my = ++qsSeq; qsBusy = true;
    let r = null, err = null;
    try { r = await rpc('adm_qstar', { act: act || 'load', a: a || {} }, { obj: true }); } catch (e) { err = e; }
    if (my !== qsSeq) return;
    qsBusy = false;
    if (err) { if (act === 'recalc') fail(err); QS = QS && !QS.err ? QS : { err: err.message }; }
    else { QS = r; QS.lv = (a && a.lv) || ''; if (act === 'recalc') toast('已重算：' + num(r.done && r.done.changed) + ' 道题显示的星变了'); }
    if (tab === 'qs') render();
  }
  function qsHTML() {
    if (!QS) { if (!qsBusy) setTimeout(() => qsLoad('load'), 0); return '<div class="box">正在读取……</div>'; }
    if (QS.err) return '<div class="box"><h2>没读到</h2><div class="muted">' + esc(QS.err) + '（数据库跑完第 36 步才有这一页）</div><button class="gbtn" data-qa="reload">重新读取</button></div>';
    const R = QS.run || {}, LVS = Array.isArray(QS.levels) ? QS.levels : [], L = Array.isArray(QS.list) ? QS.list : [], NL = num(QS.nlist), off = num(QS.off);
    let h = '<div class="note">每道题 1～5 星，<b>同一档里比</b>（1 星最容易）。初始星级是 Codex 逐题打的；一道题有效作答（每个学生只算第一次）够 ' + num(QS.min, 30) + ' 次以后，' +
      (QS.auto === false ? '<b>自动修正现在关着</b>（在「设置 → 所有学生的默认 → 题目难度星级」打开）。' : '在同一档里按真实答对率排位，再和初始星级按作答数加权（答的人越多越靠真实答对率）。') + '</div>';
    h += '<div class="box"><div class="row"><b>最近一次重算：' + (R.at ? stamp(R.at) : '还没算过') + '</b><button type="button" class="gbtn" data-qa="recalc"' + (qsBusy ? ' disabled' : '') + '>' + (qsBusy ? '正在算……' : '现在重算') + '</button></div>' +
      '<div class="muted small">够数的题 ' + num(R.n) + ' 道，其中按真实答对率排了位的 ' + num(R.nreal) + ' 道（同一档够数的题要有 ' + num(QS.minq, 20) + ' 道以上、答对率不全一样才排）；上次重算变了 ' + num(R.changed) + ' 道（在下面「上一次重算变了的」看）。每天第一次打开管理端时自动算一次。</div></div>';
    h += qtyHTML();   // 第 37 步：全班各题型正确率（点了才读）
    h += '<div class="box"><h2>各档星级 <small>1～5 星各几道：上一行初始，下一行现在</small></h2><div class="scroll"><table class="t qst"><tr><th>档</th><th>题数</th><th>1 星 → 5 星</th><th>变了</th></tr>' +
      (LVS.length ? LVS.map(x => '<tr><td>' + esc(x.lvl) + '</td><td>' + num(x.q) + '<div class="small muted">够数 ' + num(x.enough) + '</div>' + (num(x.nostar) ? '<div class="small bad">没有星级 ' + num(x.nostar) + '</div>' : '') + '</td><td><div class="qsd">' + (x.est || []).map(v => '<span>' + num(v) + '</span>').join('') + '</div><div class="qsd" style="margin-top:3px">' + (x.cur || []).map(v => '<span>' + num(v) + '</span>').join('') + '</div></td><td>' + num(x.diff) + '</td></tr>').join('') : '<tr><td colspan="4" class="muted">题库里还没有题</td></tr>') + '</table></div></div>';
    const lvSel = '<select id="qsLv" aria-label="只看哪一档"><option value="">全部档</option>' + LV.map(l => '<option' + (QS.lv === l ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const pager = NL > 100 ? '<div class="row" style="justify-content:flex-start;gap:8px"><button type="button" class="gbtn" data-qa="page" data-off="' + Math.max(0, off - 100) + '"' + (off > 0 ? '' : ' disabled') + '>上一页</button><span class="muted small">第 ' + (off + 1) + '～' + Math.min(NL, off + 100) + ' 道（共 ' + NL + ' 道）</span><button type="button" class="gbtn" data-qa="page" data-off="' + (off + 100) + '"' + (off + 100 < NL ? '' : ' disabled') + '>下一页</button></div>' : '';
    const last = QS.view === 'last', vseg = '<div class="seg" role="group" aria-label="看哪些题"><button type="button" data-qa="view" data-v="diff" aria-pressed="' + !last + '">现在和初始不一样的</button><button type="button" data-qa="view" data-v="last" aria-pressed="' + last + '">上一次重算变了的</button></div>';
    h += '<section class="box qsl"><h2>星级变了的题 <small>' + (last ? '上一次重算时显示的星变了的（含变回初始星级的）' : '现在的星和初始星级不一样的，最近变的在前') + '</small></h2><div class="row" style="justify-content:flex-start;gap:8px">' + vseg + lvSel + '</div>' + pager +
      (L.length ? '<div class="list">' + L.map(x => '<div class="it"><div><b lang="ja">' + esc(x.w) + '</b> <span class="muted" lang="ja">' + esc(x.r && x.r !== x.w ? x.r : '') + '</span> <span class="chip" data-lv="' + esc(x.lvl) + '">' + esc(x.lvl) + '</span> <span class="chip">' + esc(QT[x.t] || x.t) + '</span></div>' +
        '<div class="qq">' + esc(plain(x.q || '')) + '</div>' +
        '<div class="small">初始 ' + starTxt(x.est) + ' → 现在 <b>' + starTxt(Number.isInteger(x.now) ? x.now : x.star) + '</b>' + (Number.isInteger(x.now) && x.now === x.est ? '（回到初始）' : '') + (Number.isInteger(x.prev) && x.prev !== (Number.isInteger(x.now) ? x.now : x.star) ? '（变之前 ' + starTxt(x.prev) + '）' : '') + ' · 按答对率排位 ' + starTxt(x.real) +
        ' · 有效作答 ' + num(x.n) + ' 次，答对 ' + (num(x.n) ? Math.round(num(x.ok) * 100 / num(x.n)) : 0) + '%' + (x.at ? ' · ' + stamp(x.at) + ' 变的' : '') + '</div></div>').join('') + '</div>' : '<div class="muted">没有。' + (num(R.n) ? '' : '作答次数还不够（一道题要 ' + num(QS.min, 30) + ' 个学生做过）。') + '</div>') + pager + '</section>';
    return h;
  }
  // JLPT 题型首次作答正确率（第 37 步）：每个学生每道题只算第一次作答（测验、练习、刷题都算，和星级同一份数据），按档、题型分；
  // 默认所有学生（含已停用的以前的学生），可以只看某个班；点了才读，再点收起
  let QTY = null, qtyOpen = false, qtySeq = 0, qtyGrp = '';
  async function qtyLoad() {
    const my = ++qtySeq; QTY = { busy: true };
    if (tab === 'qs') render();
    let r = null, err = null;
    try { r = await rpc('adm_qstar', { act: 'types', a: qtyGrp ? { grp: qtyGrp } : {} }, { obj: true }); } catch (e) { err = e; }
    if (my !== qtySeq) return;
    QTY = err ? { err: err.message } : { r };
    if (tab === 'qs') render();
  }
  function qtyHTML() {
    if (!has37()) return '';
    const grps = [...new Set(D.students.map(s => s.grp).filter(Boolean))].sort();
    let h = '<div class="box" id="qtybox"><div class="row"><h2 class="lh">' + (qtyGrp ? '「' + esc(qtyGrp) + '」班' : '所有学生') + '的 JLPT 题型首次作答正确率 <small>每个学生每道题只算第一次作答（测验、练习、刷题都算）' + (qtyGrp ? '' : '，含已停用的以前的学生') + '</small></h2><button type="button" class="gbtn" data-qa="qty">' + (qtyOpen ? '收起' : '看一看') + '</button></div>';
    if (!qtyOpen) return h + '</div>';
    if (grps.length) h += '<div class="row" style="justify-content:flex-start;gap:8px"><select id="qtyGrp" aria-label="看哪个班"><option value="">所有学生</option>' + grps.map(g => '<option' + (g === qtyGrp ? ' selected' : '') + '>' + esc(g) + '</option>').join('') + '</select></div>';
    if (!QTY || QTY.busy) return h + '<div class="muted">正在读取……</div></div>';
    if (QTY.err) return h + '<div class="warnbox">没读到：' + esc(QTY.err) + ' <button type="button" class="gbtn" data-qa="qtyre">再试一次</button></div></div>';
    const r = QTY.r || {}, L = Array.isArray(r.levels) ? r.levels : [], mn = num(r.min, 10), J = TYN.slice(0, 5);
    if (!L.length) return h + '<div class="muted">' + (qtyGrp ? '这个班' : '') + '还没有学生作答过题库里的题。</div></div>';
    return h + '<div class="scroll"><table class="t qty"><tr><th>档</th>' + J.map(([, n]) => '<th lang="ja">' + n + '</th>').join('') + '</tr>' +
      L.map(x => '<tr><td>' + esc(x.lvl) + '</td>' + J.map(([t]) => '<td>' + tyCell((x.types || {})[t], mn, true) + '</td>').join('') + '</tr>').join('') +
      '<tr><td>合计</td>' + J.map(([t]) => '<td>' + tyCell((r.all || {})[t], mn, true) + '</td>').join('') + '</tr></table></div>' +
      '<div class="small muted">一共 ' + num(r.students) + ' 个学生作答过' + (num(r.off) ? '（其中 ' + num(r.off) + ' 个已经停用）' : '') + '。少于 ' + mn + ' 题标「题少」（这个数在「设置 → 全部词表和题型表现」里改）。</div></div>';
  }
  document.addEventListener('change', e => { if (D && $('app').dataset.role === 'adm' && tab === 'qs' && e.target && e.target.id === 'qtyGrp') { qtyGrp = e.target.value; qtyLoad(); } });
  async function qsAct(a) {
    const act = a.dataset.qa;
    if (act === 'qty') { qtyOpen = !qtyOpen; if (qtyOpen && (!QTY || QTY.err)) await qtyLoad(); else render(); return; }
    if (act === 'qtyre') { await qtyLoad(); return; }
    if (act === 'reload') { QS = null; render(); return; }
    if (act === 'recalc') { busy(a, true); await qsLoad('recalc', qsArgs()); return; }
    if (act === 'view') { if (QS && QS.view === a.dataset.v) return; busy(a, true); await qsLoad('load', qsArgs({ view: a.dataset.v })); return; }
    if (act === 'page') { busy(a, true); await qsLoad('load', qsArgs({ off: num(a.dataset.off) })); }
  }
  document.addEventListener('change', e => { if (D && $('app').dataset.role === 'adm' && tab === 'qs' && e.target && e.target.id === 'qsLv') qsLoad('load', Object.assign(qsArgs(), { lv: e.target.value || undefined })); });

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
    if (HD.length) h += secFold('ex.hidden', false, '<h2>隐藏的句子 <small>最近 30 条</small></h2>', HD.length + ' 句，点开可以恢复', 'exl') + HD.map(x => '<div class="it">' + exaSent(x) + '<div class="row" style="justify-content:flex-start"><span class="muted small">词「' + esc(x.w) + '」</span><button type="button" class="gbtn" data-xa="show" data-id="' + esc(x.id) + '">恢复</button></div></div>').join('') + '</details></section>';   // 11-27：收起来
    // 试生成
    const sg = (id, cur, opts) => '<div class="seg" role="group" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + n + '</button>').join('') + '</div>';
    const held = !!exT.rid && exT.ridFor === exSig();   // 上一次结果不明：按钮只按原编号查询
    h += '<section class="box" id="xtry"><h2>试生成 <small>真实调用（算进预算，标记为测试，不给学生看）：知识一次通常一笔；时事一次通常有搜证、制卡、核对三笔</small></h2>' +
      '<div class="row" style="justify-content:flex-start;gap:8px;flex-wrap:wrap"><button type="button" class="gbtn" data-xa="ping"' + (exT.pinging ? ' disabled' : '') + '>检查云函数</button>' +
      (exT.ping ? '<span class="chip ' + (exT.ping.ok ? 'ok' : 'bad') + '" style="white-space:normal">' + esc(exT.ping.text) + '</span>' : '<span class="muted small">验收第一步：云函数能启动、数据库连得上、两把钥匙填了、DNS 检查（不调用两家、不花钱）</span>') + '</div>' +
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
    h += secFold('ex.price', false, '<h2>价格 <small>每百万 token、每千次搜索（美元）；按「哪家＋模型＋生效日期」，用当天以前最新的一行</small></h2>', PR.length + ' 行；在这里填新价格') + '<div class="extw"><table class="extbl"><tr><th>哪家</th><th>模型</th><th>生效</th><th>输入</th><th>缓存读</th><th>缓存写</th><th>输出</th><th>搜索</th></tr>' +
      PR.map(x => '<tr><td>' + PN(x.provider) + '</td><td>' + esc(x.model) + '</td><td>' + esc(x.eff_date) + '</td><td>' + num(x.in_per_m) + '</td><td>' + num(x.cached_per_m) + '</td><td>' + num(x.cwrite_per_m) + '</td><td>' + num(x.out_per_m) + '</td><td>' + num(x.search_per_k) + '</td></tr>').join('') + '</table></div>' +
      '<div class="muted small">正在生成的调用用的那一版价格不能改；要改价就填一个新的生效日期。输入、输出要大于 0。</div>' +
      '<form class="form" id="xpf"><div class="row" style="flex-wrap:wrap;gap:8px"><label>哪家<select name="provider"><option value="openai">OpenAI</option><option value="anthropic">Claude</option></select></label><label>模型<input name="model" maxlength="64" required></label><label>生效日期<input name="eff" type="date"></label></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><label>输入<input name="in" type="number" step="0.01" min="0" required></label><label>缓存读<input name="cached" type="number" step="0.01" min="0" required></label><label>缓存写<input name="cwrite" type="number" step="0.01" min="0" required></label><label>输出<input name="out" type="number" step="0.01" min="0" required></label><label>每千次搜索<input name="search" type="number" step="0.01" min="0" required></label></div><button class="btn">保存这一行价格</button></form></details></section>';   // 11-27：价格、最近 20 次调用收起来
    const RC = EXA.recent || [];
    if (RC.length) h += secFold('ex.recent', false, '<h2>最近 20 次调用</h2>', RC.length + ' 次') + '<div class="extw"><table class="extbl"><tr><th>时间</th><th>哪家</th><th>步骤</th><th>结果</th><th>花费</th><th>预留</th><th></th></tr>' +
      RC.map(c => '<tr><td>' + stamp(c.at) + '</td><td>' + PN(c.provider) + '</td><td>' + esc(STEPN[c.step] || c.step) + '</td><td>' + esc(c.swept ? '待对账（先按预留额记）' : CALLN[c.status] || c.status) + '</td><td>' + money(c.cost) + '</td><td>' + money(c.reserved) + '</td><td>' + (c.test ? '测试' : '') + (c.err ? ' ' + esc(c.err) : '') + '</td></tr>').join('') + '</table></div></details></section>';
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
        // dnsCheck：打开新闻原文前查 DNS 挡内网地址。fn＝运行环境有没有 Deno.resolveDns，ok＝实际查一个公网网站查得通；不通时时事例句会全部弃稿（知识例句不受影响）
        const dc = r.dnsCheck && typeof r.dnsCheck === 'object' ? r.dnsCheck : null, newsOn = !!(EXA && EXA.who && EXA.who.news && EXA.who.news !== 'off');
        const dnsOk = !!(dc && dc.fn && dc.ok);
        const dnsText = 'DNS 检查：' + (!dc ? '云函数没回（旧版云函数）' : 'fn=' + (dc.fn ? '有' : '没有') + '、ok=' + (dc.ok ? '查得通' : '查不通') + (dnsOk ? '（时事例句能核对原文网站）' : '（时事例句打开原文会全部弃稿，知识例句不受影响）'));
        const ok = r.state === 'ok' && !!r.sdk && !!r.db && need.every(pv => ks[pv]) && (!newsOn || dnsOk);
        exT.ping = { ok, text: '云函数正常启动 · ' + (r.sdk ? 'SDK 已加载' : 'Claude SDK 没加载好') + ' · ' + (r.db ? '数据库连上了' : '数据库没连上') + ' · ' + keyText('openai') + ' · ' + keyText('anthropic') + ' · ' + dnsText };
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

  // ── 第 40 步：词库（搜词、看整张卡、改中文意思／小提示／中日同形提醒／例句的中文、停用启用、表格导入、待补读音和题目、最近的改动）──
  // 读音、写法、词性、日文例句不在网页上改（改了读音音频就对不上）。每次搜、读都有自己的编号（后发的才算数）；离开这一页时作废还没回来的（不会画到别的页上）。
  // 改词、停用启用、导入都带请求编号：回复丢了（断网、超时）再点一次用同一个编号，服务器不会改两次、记两次
  let WD = null, wdSeq = 0, tdSeq = 0, lgSeq = 0, wmSeq = 0;
  const WDST = [['all', '全部'], ['on', '在用'], ['off', '已停用'], ['new', '网页导入的'], ['todo', '待补读音或题目']];
  const NO40 = '数据库还没有升级到第 40 步（要先运行 40_打印改词导入.sql），「词库」页和打印暂时用不了';
  const no40 = e => /adm_word|Could not find the function|schema cache|PGRST202/i.test((e && e.message) || '');
  const wdErr = e => no40(e) ? NO40 : (e && e.message) || '没读到，请再试一次';
  const wdCall = (act, a, ms) => rpc('adm_word', { act, a: a || {} }, { obj: true, timeout: ms || 30000 });
  const unsure = e => !!(e && (e.net || e.timeout || !e.status || e.status >= 500));   // 不知道服务器做了没有（断网、超时、服务器出错）
  const ACTN = { edit: '改了', off: '停用了', on: '重新启用了', add: '导入新增了', imp: '导入更新了' };
  const FLDN = { m: '中文意思', tip: '小提示', trap: '中日同形提醒', ex1: '例句1的中文', ex2: '例句2的中文' };
  const IMPK = { new: '新增', upd: '更新', same: '和词库一样', err: '出错' };
  function wdInit() { if (!WD) WD = { q: '', lv: '', st: 'all', off: 0, res: null, err: null, busy: false, todo: null, todoErr: null, log: null, logErr: null }; }
  const wdChips = x => (x.active ? '' : '<span class="chip bad">已停用</span>') + (x.new ? '<span class="chip">网页导入</span>' : '') +
    (x.au ? '' : '<span class="chip warn">没有单词读音</span>') + (num(x.nq) ? '' : '<span class="chip warn">没有 JLPT 题</span>');
  const wdItem = (x, sub) => '<div class="it" data-wdid="' + esc(x.id) + '" role="button" tabindex="0"><div class="main"><div><span class="w" lang="ja">' + esc(x.w) + '</span> <span class="muted" lang="ja">' + esc(x.r && x.r !== x.w ? x.r : '') + '</span> <span class="chip" data-lv="' + esc(x.lvl) + '">' + esc(x.lvl) + '</span>' + wdChips(x) + '</div>' +
    '<div class="sub">' + esc(x.m) + ' · 编号 ' + esc(x.id) + (sub ? ' · ' + sub : '') + '</div></div></div>';
  function wdHTML() {
    wdInit();
    return '<div class="box"><h2>词库 <small>搜词、看整张卡、改中文和提示、停用</small></h2>' +
      '<form class="wdq" id="wdf"><input id="wdqi" type="search" maxlength="30" placeholder="写法、读音、中文或编号" value="' + esc(WD.q) + '" aria-label="搜词" autocomplete="off" spellcheck="false"><button class="btn main">找</button></form>' +
      '<div class="checks" role="group" aria-label="档">' + [['', '全部档']].concat(LV.map(l => [l, l])).map(([v, n]) => '<button type="button" class="ck" data-wdlv="' + v + '" aria-pressed="' + (WD.lv === v) + '">' + n + '</button>').join('') + '</div>' +
      '<div class="checks" role="group" aria-label="筛选">' + WDST.map(([v, n]) => '<button type="button" class="ck" data-wdst="' + v + '" aria-pressed="' + (WD.st === v) + '">' + n + '</button>').join('') + '</div>' +
      '<div class="small muted">点一个词看整张卡。能改：中文意思、小提示、中日同形提醒、例句的中文翻译（学生刷新页面后看到）。读音、写法、日文例句不在网页上改（改了读音音频就对不上）：要改请联系管理员。</div>' +
      '<div id="wdres">' + wdResHTML() + '</div></div>' +
      '<div class="box"><div class="row"><h2 class="lh">表格导入 <small>一次最多 500 行</small></h2><button type="button" class="btn" data-wa="imp">导入表格…</button></div>' +
      '<div class="small muted">先预览：新增几个、更新几个、哪几行有错；确认后整批写入（有一行出错就一行都不写）。更新已有的词只改中文、例句中文、小提示；新增的词没有读音、没有 JLPT 题，先列在下面「待补」里。</div></div>' +
      '<div class="box" id="wdtodo">' + wdTodoHTML() + '</div>' +
      // 11-27：最近的改动收起来（标题上写几条）；点开再看
      secFold('wd.log', false, '<h2>最近的改动 <small>谁、什么时候、改前 → 改后（最近 50 条）</small></h2>', '<span id="wdlogn">' + wdLogN() + '</span>') + '<div id="wdlog">' + wdLogHTML() + '</div></details></section>';
  }
  const wdLogN = () => WD && WD.logErr ? '没读到' : WD && WD.log ? (Array.isArray(WD.log.rows) && WD.log.rows.length ? WD.log.rows.length + ' 条' : '还没有改动') : '正在读取……';
  function wdResHTML() {
    const r = WD.res;
    if (WD.err) return '<div class="warnbox">' + esc(WD.err) + (WD.err === NO40 ? '' : ' <button type="button" class="gbtn" data-wa="refind">再试一次</button>') + '</div>';
    if (!r) return WD.busy ? '<div class="muted">正在找……</div>' : '<div class="muted">输入写法、读音、中文或编号点「找」；也可以只点上面的筛选（比如「已停用」「待补读音或题目」）。</div>';
    const tot = num(r.total), off = num(r.off), size = num(r.size, 50), rows = Array.isArray(r.rows) ? r.rows : [];
    const pager = tot > size ? '<div class="row wpg"><button type="button" class="gbtn" data-wdpg="' + Math.max(0, off - size) + '"' + (off > 0 && !WD.busy ? '' : ' disabled') + '>上一页</button><span class="small muted">第 ' + (off + 1) + '～' + Math.min(tot, off + size) + ' 个</span><button type="button" class="gbtn" data-wdpg="' + (off + size) + '"' + (off + size < tot && !WD.busy ? '' : ' disabled') + '>下一页</button></div>' : '';
    return '<div class="small muted" role="status">' + (WD.busy ? '正在找…… ' : '') + '找到 ' + tot + ' 个</div>' + pager +
      (rows.length ? '<div class="list wdl">' + rows.map(x => wdItem(x)).join('') + '</div>' : '<div class="muted">没有找到。</div>') + pager;
  }
  const wdPaint = () => { const el = $('wdres'); if (el && tab === 'wd') el.innerHTML = wdResHTML(); };
  // 找词：搜索框空着、档和筛选都是「全部」时不找（8,000 个词一页页翻没用）
  async function wdFind(off) {
    wdInit();
    if (off != null) WD.off = off;
    const my = ++wdSeq, args = { q: WD.q, lv: WD.lv, st: WD.st, off: WD.off };
    if (!args.q && !args.lv && args.st === 'all') { WD.res = null; WD.err = null; WD.busy = false; wdPaint(); return; }
    WD.busy = true; wdPaint();
    let r = null, err = null;
    try { r = await wdCall('find', args); } catch (e) { err = e; }
    if (my !== wdSeq || tab !== 'wd') return;
    WD.busy = false;
    if (err) { WD.err = wdErr(err); WD.res = null; } else { WD.err = null; WD.res = r; }
    wdPaint();
  }
  function wdTodoHTML() {
    const t = WD && WD.todo, rows = t && Array.isArray(t.rows) ? t.rows : [];
    let h = '<div class="row"><h2 class="lh">待补读音、待出题 <small>网页导入的新词</small></h2>' + (rows.length ? '<button type="button" class="gbtn" data-wa="todocopy">复制这些编号</button>' : '') + '</div>';
    if (WD && WD.todoErr) return h + '<div class="warnbox">' + esc(WD.todoErr) + '</div>';
    if (!t) return h + '<div class="muted">正在读取……</div>';
    h += '<div class="small muted">没有单词读音：读音按钮没声音、不出「听音选意思」；没有 JLPT 题：出题只出「看日语选中文」这类简单题。请把编号发给管理员补读音、出题，补好以后自动从这里消失。</div>';
    h += rows.length ? '<div class="list wdl">' + rows.map(x => wdItem(x, md(x.at) + ' ' + esc(x.who) + ' 导入')).join('') + '</div>' : '<div class="muted">现在没有待补的词。</div>';
    return h + '<div class="small muted">另外，词库原有的词里没有单词读音的 ' + num(t.noau) + ' 个、没有 JLPT 题的 ' + num(t.noq) + ' 个（以前就这样，出题时只出简单题；不在这里列）。</div>';
  }
  async function wdTodo() {
    const my = ++tdSeq;
    let r = null, err = null; try { r = await wdCall('todo'); } catch (e) { err = e; }
    if (my !== tdSeq || tab !== 'wd') return;
    WD.todo = err ? null : r; WD.todoErr = err ? wdErr(err) : null;
    const el = $('wdtodo'); if (el) el.innerHTML = wdTodoHTML();
  }
  // 改动记录里的一条：改了哪几项（改前 → 改后）
  function logLine(x, withWord) {
    const b = x.before || {}, a = x.after || {};
    let d = '';
    if (x.act === 'add') d = '<div class="small muted">' + esc(a.lvl || '') + ' · ' + esc(a.m || '') + '</div>';
    else if (x.act === 'edit' || x.act === 'imp') d = Object.keys(a).map(k => '<div class="small muted">' + esc(FLDN[k] || k) + '：' + esc(b[k] || '（没有）') + ' → ' + esc(a[k] || '（删掉）') + '</div>').join('');
    return '<div><time>' + stamp(x.at) + '</time>' + esc(x.who) + ' ' + (ACTN[x.act] || x.act) + (withWord ? ' <button type="button" class="link" data-wdid="' + esc(x.id) + '" lang="ja">「' + esc(x.w || x.id) + '」</button>' : '') + d + '</div>';
  }
  function wdLogHTML() {
    const L = WD && WD.log, rows = L && Array.isArray(L.rows) ? L.rows : [];
    const h = '';   // 11-27：标题移到折叠块的开关上
    if (WD && WD.logErr) return h + '<div class="warnbox">' + esc(WD.logErr) + '</div>';
    if (!L) return h + '<div class="muted">正在读取……</div>';
    return h + (rows.length ? '<div class="wdlog">' + rows.map(x => logLine(x, true)).join('') + '</div>' : '<div class="muted">还没有改动。</div>');
  }
  async function wdLog() {
    const my = ++lgSeq;
    let r = null, err = null; try { r = await wdCall('log'); } catch (e) { err = e; }
    if (my !== lgSeq || tab !== 'wd') return;
    WD.log = err ? null : r; WD.logErr = err ? wdErr(err) : null;
    const el = $('wdlog'); if (el) el.innerHTML = wdLogHTML();
    const ln = $('wdlogn'); if (ln) ln.textContent = wdLogN();
  }
  function wdEnter() { wdInit(); wdTodo(); wdLog(); if (WD.q || WD.lv || WD.st !== 'all') wdFind(); }
  function wdLeave() { wdSeq++; tdSeq++; lgSeq++; wmSeq++; if (WD) WD.busy = false; }   // 还没回来的都作废
  function wdBind() { const f = $('wdf'); if (f) f.addEventListener('submit', e => { e.preventDefault(); WD.q = $('wdqi').value.trim().slice(0, 30); wdFind(0); }); }
  const wdAfter = () => { if (tab !== 'wd') return; wdTodo(); wdLog(); if (WD && WD.res) wdFind(); };   // 改过、导入过以后：列表、待补、改动记录重新读
  // 一个词：整张卡（学生看到的样子）、能改的几项、停用启用、这个词的改动记录。msg：顶上一句（保存好了／别人刚改过）；bad＝是提醒
  async function wordModal(id, msg, bad) {
    quiet();
    const my = ++wmSeq;
    let w = null; try { w = await wdCall('get', { id }); } catch (e) { if (my === wmSeq) toast(wdErr(e)); return; }
    if (my !== wmSeq) return;
    document.querySelectorAll('.modal.wdm').forEach(x => x.close ? x.close() : x.remove());
    const c = w.card || {}, ed = w.ed || { m: '', tip: '', trap: '', ex: [] }, ex = Array.isArray(c.ex) ? c.ex : [], u = w.use || {}, lg = Array.isArray(w.log) ? w.log : [];
    const m = modal('<div class="row"><h2><span lang="ja">' + esc(c.w) + '</span> <small class="muted" lang="ja">' + esc(c.r !== c.w ? c.r : '') + '</small></h2><button type="button" class="gbtn" data-close>关闭</button></div>' +
      (msg ? '<div class="' + (bad ? 'warnbox' : 'note pok') + '" role="status">' + esc(msg) + '</div>' : '') +
      '<div><span class="chip" data-lv="' + esc(w.lvl) + '">' + esc(w.lvl) + '</span>' + wdChips(w) + ' <span class="small muted">编号 ' + esc(w.id) + (num(w.nq) ? ' · JLPT 题 ' + num(w.nq) + ' 道' : '') + '</span></div>' +
      '<div class="small muted">' + num(u.learned) + ' 个学生学过 · ' + num(u.wrong) + ' 个学生的错词本里有 · ' + num(u.week) + ' 个学生这周的词单里有</div>' +
      '<details><summary>看学生看到的卡片</summary><div class="card">' + cardBack(Object.assign({}, c, { id: w.id }), { noEx: true }) + '</div></details>' +
      '<form class="form" id="wde"><div class="note">写法「' + esc(c.w) + '」、读音「' + esc(c.r) + '」、词性「' + esc(c.p || '') + '」、日文例句不在网页上改（改了读音音频就对不上）。<b>要改读音或例句请联系管理员。</b></div>' +
      '<label>中文意思（必填，最多 60 个字）<input id="wd-m" maxlength="60" autocomplete="off"></label>' +
      '<div class="small muted wdmh" id="wd-mh" hidden>改了中文意思：如果是纠正错误的意思，题库里相关题目' + (num(w.nq) ? '（' + num(w.nq) + ' 道）' : '') + '可能也要复核（题干、选项、解析是另外存的，这里改不到；请告诉管理员）。已经出好的卷子照原样判分。</div>' +   // 复查第 1 轮建议
      '<label>小提示（可以空着；注音写成 漢字{かな}）<textarea id="wd-tip" rows="3" maxlength="200"></textarea></label>' +
      '<label>中日同形提醒（可以空着）<textarea id="wd-trap" rows="3" maxlength="200"></textarea></label>' +
      ex.map((e, j) => '<div class="wdex"><div class="lab">例句 ' + (j + 1) + '（日文不在网页上改）</div><div class="jp" lang="ja">' + rb(e[0]) + '</div><label>中文翻译<input id="wd-ex' + j + '" maxlength="100" autocomplete="off"></label></div>').join('') +
      '<div class="row"><span class="small muted" id="wdst" role="status">没有改动</span><button class="btn main" id="wdsave" disabled>保存</button></div></form>' +
      '<div class="lab">停用 · 启用</div><div class="row"><span class="small muted">' + (w.active ? '停用后不再发给学生、不出题、不进每天复习和随身听、快刷；学过的记录保留。' : '这个词现在停用着：不发给学生、不出题；错词本里标「已停用」。') + '</span>' +
      '<button type="button" class="gbtn" id="wdtg">' + (w.active ? '停用这个词' : '重新启用') + '</button></div>' +
      '<div class="lab">这个词的改动记录</div>' + (lg.length ? '<div class="wdlog">' + lg.map(x => logLine(x, false)).join('') + '</div>' : '<div class="small muted">还没有改动。</div>'));
    m.classList.add('wdm');
    const q = s => m.querySelector(s), one = v => String(v || '').replace(/\s*[\r\n]+\s*/g, ' ').trim();   // 换行改成空格（数据库不收换行）
    q('#wd-m').value = ed.m || ''; q('#wd-tip').value = ed.tip || ''; q('#wd-trap').value = ed.trap || '';
    ex.forEach((e, j) => { q('#wd-ex' + j).value = (ed.ex || [])[j] || ''; });
    const vals = () => ({ m: one(q('#wd-m').value), tip: one(q('#wd-tip').value), trap: one(q('#wd-trap').value), ex: ex.map((e, j) => one(q('#wd-ex' + j).value)) });
    const changed = v => ['m', 'tip', 'trap'].filter(k => v[k] !== (ed[k] || '')).length + v.ex.filter((z, j) => z !== ((ed.ex || [])[j] || '')).length;
    const st = q('#wdst'), sv = q('#wdsave');
    let rid = null, sent = '', saving = false, toggling = false, trid = null;
    // 保存的请求还没回来时：输入框、停用按钮都锁住（复查第 1 轮：慢网时接着输入的字，会被成功回复关掉编辑框时丢掉）；没存成再放开
    const lock = on => { m.querySelectorAll('#wde input, #wde textarea').forEach(x => { x.readOnly = on; }); q('#wdtg').disabled = on; };
    q('#wde').addEventListener('input', () => { if (saving || toggling) return; const v = vals(), n = changed(v); st.textContent = n ? '改了 ' + n + ' 处，还没保存' : '没有改动'; sv.disabled = !n; q('#wd-mh').hidden = v.m === (ed.m || ''); });
    q('#wde').addEventListener('submit', async ev => {
      ev.preventDefault(); if (saving || toggling || sv.disabled) return;
      const v = vals(); if (!changed(v)) { toast('没有改动'); return; }
      const body = Object.assign({ id: w.id, base: ed }, v), sig = JSON.stringify(body);
      if (!rid || sig !== sent) rid = uuid4();   // 内容没变的重试用同一个请求编号（上次存上了也不会存两次）
      sent = sig; saving = true; busy(sv, true); lock(true); st.textContent = '正在保存……（这时先别改）';
      let r = null, err = null;
      try { r = await wdCall('save', Object.assign({ rid }, body)); } catch (e) { err = e; }
      saving = false;
      if (!m.isConnected) return;
      if (err || r.state === 'same') lock(false);
      if (err) {
        busy(sv, false);
        if (unsure(err)) st.textContent = '不知道存上没有（' + err.message + '）：再点一次「保存」（不会存两次）';
        else { rid = null; st.textContent = '没有保存：' + err.message; fail(err); }
        return;
      }
      rid = null;
      if (r.state === 'stale') {   // 别人（或另一个窗口）刚改过：换成最新的内容，写明刚才填的，请老师再改一次（不会悄悄盖掉别人的）
        const mine = ['m', 'tip', 'trap'].filter(k => v[k] !== (ed[k] || '')).map(k => FLDN[k] + '「' + (v[k] || '（空着）') + '」').concat(v.ex.map((z, j) => z !== ((ed.ex || [])[j] || '') ? '例句' + (j + 1) + '的中文「' + z + '」' : '').filter(Boolean));
        m.close(); wordModal(w.id, (r.msg || '这个词刚被别人改过') + '。你刚才填的是：' + mine.join('、'), true); wdAfter(); return;
      }
      if (r.state === 'same') { busy(sv, false); st.textContent = '没有改动'; return; }
      toast('已保存（学生刷新页面后看到）'); m.close(); wordModal(w.id, '已保存。学生刷新页面后看到。'); wdAfter();
    });
    q('#wdtg').addEventListener('click', async e => {
      const b = e.currentTarget; if (b.disabled || toggling) return;
      const off = w.active, act = off ? '停用' : '重新启用';
      // 复查第 2 轮：有没保存的改动时先问（启停以后会重新读这个词，改动会丢）：先去保存，或者明确放弃
      const n0 = changed(vals());
      if (n0) {
        const d = await ask('还有没保存的改动', '这个词改了 ' + n0 + ' 处还没保存。' + act + '以后会重新读一次这个词，这些改动会丢掉。', [['keep', '先去保存', true], ['drop', '放弃这些改动，接着' + act], ['no', '取消']]);
        if (d === 'keep' && m.isConnected) { try { sv.focus(); } catch (er) {} st.textContent = '改了 ' + n0 + ' 处，还没保存：先点「保存」'; }
        if (d !== 'drop' || !m.isConnected || toggling || saving) return;
      }
      const v = await ask(off ? '停用「' + esc(c.w) + '」？' : '重新启用「' + esc(c.w) + '」？',
        off ? '停用后：不再发给学生（新的周词单、换词都不抽）、不出题、不进每天复习和随身听、快刷' + (num(u.week) ? '；这周词单里有它的 ' + num(u.week) + ' 个学生，词单里会少掉这个词' : '') + '。已经学过的记录保留，错词本里照常显示（标「已停用」）。随时可以重新启用。'
            : '启用后照常发给学生、出题、复习。', [[off ? 'off' : 'on', off ? '停用' : '启用', true], ['no', '先不']]);
      if (v !== (off ? 'off' : 'on') || !m.isConnected || toggling) return;
      if (!trid) trid = uuid4();
      toggling = true; busy(b, true); lock(true); sv.disabled = true; st.textContent = '正在' + act + '……（这时先别改）';   // 启停的请求发出去以后：输入框、保存都锁住（成功以后会重新读这个词）
      let r = null, err = null;
      try { r = await wdCall(off ? 'off' : 'on', { id: w.id, rid: trid }); } catch (er) { err = er; }
      toggling = false;
      if (err && m.isConnected) { lock(false); const n1 = changed(vals()); sv.disabled = !n1; st.textContent = n1 ? '改了 ' + n1 + ' 处，还没保存' : '没有改动'; }
      if (err) { if (!unsure(err)) trid = null; busy(b, false); toast(unsure(err) ? '不知道' + (off ? '停用' : '启用') + '了没有（' + err.message + '）：再点一次（不会做两次）' : wdErr(err)); return; }
      trid = null;
      const done = off ? '已停用：不再发给学生、不出题；学过的记录保留' : '已重新启用';
      toast(done); if (m.isConnected) { m.close(); wordModal(w.id, done + '。'); } wdAfter();
    });
  }
  // ── 表格导入：粘贴或选文件 → 预览（新增、更新、出错的行和原因）→ 确认后整批写入 ──
  // 解析表格（在网页上做）：第一行有 Tab 就按 Tab 分（从 Excel 复制粘贴就是 Tab），不然按逗号（CSV）；双引号里的逗号、换行、两个双引号都认；空行跳过。
  // n＝这一行在表格里是第几行（老师对着表格找）。复查第 1 轮后：
  //   · 第一行只有按列位置正好是模板的表头（编号、档、写法……小提示）才当表头跳过（不再看「有写法、读音两个字」，不会把第一条词当表头删掉）；
  //   · 文件结束时还在双引号里（少了右引号）、右引号后面紧跟着别的字：报出是哪一行开始的，不让预览（不会把残缺的内容当成正常的交上去）；
  //   · 复查第 2 轮：引号里换了行的格出错时，同时写这一格从第几行开始、错在第几行；只有 CR（老的 Mac 格式）的换行也算一行
  function parseTable(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    const first = text.split(/\r\n|\n|\r/).find(l => l.trim() !== '') || '', sep = first.includes('\t') ? '\t' : ',';
    const out = []; let row = [], cell = '', inq = false, line = 1, start = 1, qline = 0;
    const end = () => { row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) out.push({ n: start, c: row }); row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inq) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else {
            inq = false;
            const nx = text[i + 1];
            if (nx !== undefined && nx !== sep && nx !== '\r' && nx !== '\n') return { rows: [], sep, bad: (qline < line ? '从第 ' + qline + ' 行开始的那一格（引号里换了行），在第 ' + line + ' 行' : '第 ' + line + ' 行') + '：右引号后面还有别的字（' + JSON.stringify(text.slice(i + 1, i + 6)) + '…）。一格里有引号要写成两个引号（""），或者整格不用引号' };
          }
        }
        else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') { cell += '\r\n'; i++; } else cell += ch; line++; }   // 引号里换行：CRLF、只有 LF、只有 CR 都算一行
        else cell += ch;
      } else if (ch === '"' && cell === '') { inq = true; qline = line; }
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') i++; end(); line++; start = line; }
      else cell += ch;
    }
    if (inq) return { rows: [], sep, bad: '第 ' + qline + ' 行开始的那一格少了右引号（双引号没配对' + (line > qline ? '，一直到最后第 ' + line + ' 行都没配上' : '') + '），后面的内容都读不准' };
    if (cell !== '' || row.length) end();
    if (out.length && IMP_HEAD.every((h, j) => (out[0].c[j] || '').trim() === h) && out[0].c.slice(IMP_HEAD.length).every(x => x.trim() === '')) out.shift();   // 和模板的表头一模一样才跳过
    return { rows: out, sep };
  }
  const IMP_HEAD = ['编号', '档', '写法', '读音', '词性', '中文', '例句1', '例句1中文', '例句2', '例句2中文', '小提示'];
  function impResHTML(pl, top) {
    const ct = pl.counts || {}, rows = Array.isArray(pl.rows) ? pl.rows : [], nErr = num(ct.err), nGo = num(ct.new) + num(ct.upd);
    let h = (top ? '<div class="warnbox">' + esc(top) + '</div>' : '') +
      '<div class="impsum">一共 <b>' + num(ct.rows) + '</b> 行：新增 <b>' + num(ct.new) + '</b> 个、更新 <b>' + num(ct.upd) + '</b> 个、和词库一样 ' + num(ct.same) + ' 个' + (nErr ? '、<b class="bad">出错 ' + nErr + ' 行</b>' : '') + (num(ct.flag) ? '；有 ' + num(ct.flag) + ' 行要看一眼（标「！」的没有改）' : '') + '</div>';
    if (nErr) h += '<div class="warnbox">有 ' + nErr + ' 行出错，这一批一行都不会导入：在表格里改好，再点「预览」。</div>';
    const ord = { err: 0, new: 1, upd: 2, same: 3 };
    const all = rows.slice().sort((a, b) => (ord[a.k] - ord[b.k]) || ((b.flag ? 1 : 0) - (a.flag ? 1 : 0)) || num(a.n) - num(b.n)), list = all.filter(x => x.k !== 'same' || x.flag);   // 出错的、要看一眼的全部列出（复查第 1 轮：不只前 200 行）
    h += '<div class="impl">' + list.map(x => '<div><b>第 ' + num(x.n) + ' 行</b> ' + (IMPK[x.k] || '') + ' <span lang="ja">' + esc(x.w || '') + (x.r && x.r !== x.w ? '（' + esc(x.r) + '）' : '') + '</span>' + (x.id ? ' <span class="muted">编号 ' + esc(x.id) + '</span>' : '') +
      (x.k === 'new' ? ' <span class="muted">' + esc(x.lvl || '') + ' · ' + esc(x.m || '') + '</span>' : '') +
      (Array.isArray(x.err) ? x.err.map(t => '<div class="e">✗ ' + esc(t) + '</div>').join('') : '') + (Array.isArray(x.flag) ? x.flag.map(t => '<div class="f">！' + esc(t) + '</div>').join('') : '') +
      (x.ch && typeof x.ch === 'object' ? Object.entries(x.ch).map(([k, v]) => '<div class="small">' + esc(FLDN[k] || k) + '：' + esc((v && v[0]) || '（没有）') + ' → ' + esc(v && v[1]) + '</div>').join('') : '') + '</div>').join('') + '</div>';
    if (all.length > list.length) h += '<div class="small muted">另外 ' + (all.length - list.length) + ' 行和词库一样，没有列出。</div>';
    const can = !nErr && nGo > 0;
    return h + '<div class="row"><span class="small muted">' + (can ? '新增的词编号自动编成 W 开头，排在那一档的最后；没有读音、没有 JLPT 题，先列在「待补」里。' : !nErr ? '没有要导入的：表格里的词和词库里的都一样。' : '') + '</span>' +
      '<button type="button" class="btn main" data-ia="go"' + (can ? '' : ' disabled') + '>确认导入（新增 ' + num(ct.new) + ' 个、更新 ' + num(ct.upd) + ' 个）</button></div>';
  }
  function impModal() {
    quiet();
    document.querySelectorAll('.modal.impm').forEach(x => x.close ? x.close() : x.remove());
    const m = modal('<div class="row"><h2>表格导入</h2><button type="button" class="gbtn" data-close>关闭</button></div>' +
      '<div class="small muted">一行一个词，11 列（顺序固定，第一行可以是表头）：' + IMP_HEAD.join('、') + '。编号空着＝按写法＋读音找；找不到＝新增。档写 N5～N1；读音只用假名；例句里用 «» 标出这个词，注音写成 漢字{かな}。没有的内容留空格子。一次最多 500 行。</div>' +
      '<div class="small muted">更新已有的词：只改中文、例句中文、小提示（空着的格子不改）；档、写法、读音、词性、日文例句和词库不一样的行会标出来、不改（要改请联系管理员）。</div>' +
      '<div><button type="button" class="link" data-ia="tpl">下载空白模板（CSV，可以用 Excel 打开）</button></div>' +
      '<div class="form"><label>粘贴表格（从 Excel 选中复制、粘贴到这里就行）<textarea id="imptx" class="impt" rows="6" spellcheck="false"></textarea></label>' +
      '<label>或者选文件（.csv、.tsv、.txt，要 UTF-8 编码）<input type="file" id="impf" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"></label></div>' +
      '<div class="row"><span class="small muted" id="impst" role="status"></span><button type="button" class="btn" data-ia="pv">预览</button></div>' +
      '<div id="impres" class="impr"></div>');
    m.classList.add('impm');
    const ta = m.querySelector('#imptx'), out = m.querySelector('#impres'), st = m.querySelector('#impst');
    let P = null, irid = null, going = false, viewing = false, pvSeq = 0;
    const stale = () => { pvSeq++; if (P || irid) { P = null; irid = null; out.innerHTML = '<div class="small muted">表格改过了：请重新点「预览」。</div>'; } };
    const fin = m.querySelector('#impf'), lock = on => { ta.readOnly = on; fin.disabled = on; };   // 预览、导入的请求还没回来时锁住表格框和选文件（不会把这时粘贴的下一批清掉）
    ta.addEventListener('input', stale);
    m.querySelector('#impf').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast('文件太大了（最多 2MB）'); e.target.value = ''; return; }
      let t = ''; try { const buf = await f.arrayBuffer(); t = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (er) { toast('这个文件不是 UTF-8 编码：请在 Excel 里「另存为」选「CSV UTF-8」，或者直接复制粘贴'); e.target.value = ''; return; }
      if (!m.isConnected) return;
      ta.value = t; stale(); st.textContent = '已读入「' + f.name + '」，点「预览」';
    });
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-ia]'); if (!b || b.disabled) return;
      const ia = b.dataset.ia;
      if (ia === 'tpl') {
        const csv = '\uFEFF' + IMP_HEAD.join(',') + '\r\n';   // 只有表头（复查第 1 轮：以前带一行「会う」的示例，原样导入会把示例的翻译配到词库的例句上）
        try { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = '词库导入模板.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
        catch (er) { toast('这个浏览器下载不了：可以照上面写的 11 列自己做表'); }
        return;
      }
      if (ia === 'pv') {
        if (viewing || going) return;
        const t = parseTable(ta.value);
        if (t.bad) { out.innerHTML = '<div class="warnbox">表格读不准：' + esc(t.bad) + '。改好再点「预览」（这次没有发出去）。</div>'; return; }
        if (!t.rows.length) { out.innerHTML = '<div class="warnbox">表格里没有内容（第一行是表头的话，下面要有词）。</div>'; return; }
        if (t.rows.length > 500) { out.innerHTML = '<div class="warnbox">表格有 ' + t.rows.length + ' 行，一次最多导入 500 行：请分几次导入（这次没有发出去）。</div>'; return; }
        const my = ++pvSeq; viewing = true; busy(b, true); lock(true); st.textContent = '正在预览 ' + t.rows.length + ' 行……';
        let r = null, err = null; try { r = await wdCall('preview', { rows: t.rows }, 60000); } catch (er) { err = er; }
        viewing = false; busy(b, false); lock(false);
        if (!m.isConnected || my !== pvSeq) return;
        if (err) { st.textContent = ''; out.innerHTML = '<div class="warnbox">没有预览成功：' + esc(wdErr(err)) + '</div>'; return; }
        P = { rows: t.rows, plan: r.plan }; irid = null;
        st.textContent = '按' + (t.sep === '\t' ? ' Tab ' : '逗号') + '分列，读到 ' + t.rows.length + ' 行';
        out.innerHTML = impResHTML(r.plan); return;
      }
      if (ia === 'go') {
        if (!P || going || viewing) return;
        const ct = P.plan.counts || {};
        const v = await ask('确认导入？', '新增 ' + num(ct.new) + ' 个词、更新 ' + num(ct.upd) + ' 个词（只改中文、例句中文、小提示）。整批一起写进词库，学生刷新页面后看到。', [['go', '导入', true], ['no', '先不']]);
        if (v !== 'go' || !P || !m.isConnected || going) return;
        if (!irid) irid = uuid4();   // 回复丢了再点一次用同一个编号：不会导两次
        const my = pvSeq, P0 = P, sentText = ta.value; going = true; m.querySelectorAll('[data-ia]').forEach(x => x.disabled = true); lock(true); st.textContent = '正在导入……（这时先别改表格）';
        let r = null, err = null; try { r = await wdCall('import', { rows: P0.rows, sig: P0.plan.sig, rid: irid }, 60000); } catch (er) { err = er; }
        going = false; m.querySelectorAll('[data-ia]').forEach(x => x.disabled = false); lock(false);
        if (!m.isConnected) { if (r && r.state === 'ok') { toast('已导入：新增 ' + num(r.new) + ' 个、更新 ' + num(r.upd) + ' 个'); wdAfter(); } return; }
        if (err) {
          if (unsure(err)) { st.textContent = '不知道导入了没有（' + err.message + '）：再点一次「确认导入」（不会导两次）'; const g = m.querySelector('[data-ia="go"]'); if (g && my === pvSeq) g.disabled = false; }
          else { irid = null; st.textContent = ''; out.insertAdjacentHTML('afterbegin', '<div class="warnbox">没有导入：' + esc(wdErr(err)) + '</div>'); const g = m.querySelector('[data-ia="go"]'); if (g) g.disabled = true; }
          return;
        }
        irid = null;
        if (r.state === 'stale') { P = { rows: P0.rows, plan: r.plan }; st.textContent = ''; out.innerHTML = impResHTML(r.plan, r.msg); return; }
        if (r.state === 'none') { P = null; st.textContent = ''; out.innerHTML = '<div class="note">' + esc(r.msg || '没有要导入的') + '</div>'; return; }
        P = null; st.textContent = ''; if (ta.value === sentText) ta.value = '';   // 只清掉刚导入的这一份
        const ids = Array.isArray(r.ids) ? r.ids : [];
        out.innerHTML = '<div class="note pok" role="status">已导入：新增 <b>' + num(r.new) + '</b> 个、更新 <b>' + num(r.upd) + '</b> 个' + (r.dup ? '（刚才其实已经导入了，这次没有重复导入）' : '') + '。学生刷新页面后看到。</div>' +
          (ids.length ? '<div class="small muted">新增的词编号：' + esc(ids.join('、')) + '（没有读音、没有 JLPT 题，已经列在「待补」里）</div><div><button type="button" class="gbtn" data-ia="cp">复制新词的编号</button></div>' : '');
        m.dataset.ids = ids.join('\n');
        wdAfter(); return;
      }
      if (ia === 'cp') { copyText(m.dataset.ids || ''); return; }
    });
    setTimeout(() => ta.focus(), 50);
  }

  // ── 设置面板 ──
  const stepHTML = k => '<div class="step"><button type="button" data-k="' + k + '" data-dd="-1" aria-label="减少">−</button><input id="f-' + k + '" type="number" inputmode="' + (NUM[k][3] % 1 ? 'decimal' : 'numeric') + '" step="' + (NUM[k][3] % 1 ? '0.1' : '1') + '" min="' + NUM[k][1] + '" max="' + NUM[k][2] + '"><span class="u">' + NUM[k][0] + '</span><button type="button" data-k="' + k + '" data-dd="1" aria-label="增加">+</button></div>';
  const fld = (k, label, ctrl, extra = '') => '<div class="field" data-key="' + k + '" id="fd-' + k + '"><div class="fl"><span>' + label + '</span><span class="inh" id="i-' + k + '"></span>' + extra + '</div>' + ctrl + '</div>';
  const sw = (k, label) => '<button type="button" class="sw" role="switch" id="f-' + k + '" aria-label="' + label + '"></button>';
  const seg = (id, label, opts) => '<div class="seg" role="group" aria-label="' + label + '" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" aria-pressed="false">' + n + '</button>').join('') + '</div>';
  const hint = t => '<span class="inh">' + t + '</span>';
  // 11-27：设置页每一块的标题就是折叠开关。默认只开「学习量」「各档怎么学」「拓展例句」（拓展例句管花钱，进来就看得到）；
  // 标题下面一行写现在的设置、单独设了几项、改了几处没保存（refresh 里更新，见 secStat）
  const SEC_OPEN = ['bxAmt', 'bxLv', 'bxEx'];
  const secA = (id, h2, attrs) => '<section class="box" id="' + id + '"' + (attrs || '') + '><details class="fold sec"' + foldAttr('cfg.' + id, SEC_OPEN.includes(id)) + '><summary>' + h2 + '<span class="fst" id="fs-' + id + '"></span></summary>';
  const secZ = '</details></section>';
  const onOff = v => v ? '开' : '关';
  const SECST = {
    bxAmt: e => '每周 ' + num(e.weekly) + ' 个新词，学 ' + num(e.days) + ' 天' + (e.addOn ? '；学完可以再来一组 ' + num(e.addN) + ' 个' : ''),
    bxLv: e => lvText(e, { short: true }),
    bxSrs: e => e.srsOn ? '开着，每天最多复习 ' + num(e.srsN) + ' 个' : '关着',
    bxChk: e => e.chkOn ? '开着，每天最多抽查 ' + num(e.chkN) + ' 个' : '关着',
    bxCyc: e => '先学 ' + num(e.learnW) + ' 周新词' + (num(e.revW) ? '，再回顾 ' + num(e.revW) + ' 周' : '，不要回顾周'),
    bxWk: e => '及格线 ' + num(e.pass) + '%；' + (e.instant ? '答题时当场判对错' : '交卷后再看对错'),
    bxRev: e => num(e.revW) === 0 ? '现在没有回顾周' : '抽 ' + num(e.revN) + ' 个词来考，及格线 ' + num(e.revPass) + '%',
    bxRg: e => num(e.rvDays) ? '分 ' + num(e.rvDays) + ' 天复习完' : '不分天',
    bxQ: e => e.qOn ? '开着，每 ' + num(e.qEvery) + ' 周考一次' : '关着',
    bxY: e => e.yOn ? '开着，每 ' + num(e.yEvery) + ' 周考一次' : '关着',
    bxMrg: e => fmt('merge', e.merge),
    bxPz: e => '答错时格子变暗：' + onOff(e.dim),
    bxDrill: e => e.drillOn ? '开放，每次最多 ' + num(e.drillMax) + ' 题' : '关着',
    bxRetest: e => num(e.retestN) ? '最近交卷的 ' + num(e.retestN) + ' 场可以再做' : '不开放',
    bxShow: e => e.starShow ? '显示' : '不显示',
    bxWl: e => '全部词表：' + (e.wlOn ? '开放' : '关着'),
    bxLq: e => '听音选意思：' + onOff(e.acOn) + '；随身听：' + onOff(e.lsOn) + '；快刷：' + onOff(e.qfOn),
    bxStar: e => '按真实答对率自动修正：' + onOff(e.starAuto),
    bxEx: e => (e.exOn ? '开着' : '关着') + '；知识例句：' + (WHO[e.exWhoK] || '—') + '；时事例句：' + (WHO[e.exWhoN] || '—'),
  };
  // 每一块标题下面那一行：现在的设置＋（单个学生、方案）单独设了几项＋改了几处还没保存
  function secStat(e, ch) {
    const chg = new Set(ch.map(x => x[0])), o = scope === 'global' ? null : ov();
    document.querySelectorAll('main section.box > details.fold.sec').forEach(d => {
      const sec = d.parentElement, el = $('fs-' + sec.id); if (!el) return;
      const ks = [...sec.querySelectorAll('.field[data-key]')].map(f => f.dataset.key); if (sec.id === 'bxLv') ks.push('ratio');
      const nCh = ks.filter(k => chg.has(k)).length, nOv = o ? ks.filter(k => k in o).length : 0;
      el.innerHTML = esc(SECST[sec.id] ? SECST[sec.id](e) : '') + (nOv ? ' <span class="chip">' + (scope === 'tpl' ? '方案自己设了 ' : '单独设了 ') + nOv + ' 项</span>' : '') + (nCh ? ' <span class="chip d">改了 ' + nCh + ' 处，还没保存</span>' : '');
    });
  }

  function scopeBar() {
    const t = TPL();
    if (!stuKey && D.students.length) stuKey = D.students[0].id;
    const b = (sc, label, key) => '<button type="button" data-scope="' + sc + '"' + (key ? ' data-tpl="' + esc(key) + '" title="' + label + '"' : '') + ' aria-pressed="' + (scope === sc && (sc !== 'tpl' || key === tplKey)) + '">' + label + '</button>';
    return '<div class="row"><div class="seg scopes" role="group" aria-label="改哪一层">' + b('global', '所有学生的默认') + D.plans.map(p => b('tpl', esc(p.name), p.key)).join('') + b('stu', '单个学生') + '</div>' +
      (scope === 'stu' ? (D.students.length ? '<select id="pickStu" aria-label="选学生">' + D.students.map(s => '<option value="' + s.id + '"' + (s.id === stuKey ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>' : '<span class="muted">还没有学生</span>') : '') +
      '</div><div class="muted" id="who"></div>';
  }
  const CFG_CATS = [['all', '全部设置'], ['learn', '学习与分档'], ['srs', '复习与回顾'], ['test', '测验与星级'], ['tool', '刷题与工具'], ['ai', '拓展AI']];
  function catOfBox(sec) {
    const id = sec.id || '', h2 = ((sec.querySelector('h2') || {}).textContent || '').trim();
    if (/^按现在的设置/.test(h2)) return 'summary';
    if (id === 'bxLv' || /^这个学生用哪个方案|^学习量|^学习循环/.test(h2)) return 'learn';
    if (id === 'bxSrs' || id === 'bxChk' || id === 'bxRev' || id === 'bxRg') return 'srs';
    if (id === 'bxQ' || id === 'bxY' || id === 'bxShow' || id === 'bxStar' || /^周测|^几场测验|^拼图/.test(h2)) return 'test';
    if (id === 'bxDrill' || id === 'bxRetest' || id === 'bxWl' || id === 'bxLq') return 'tool';
    if (id === 'bxEx') return 'ai';
    return 'learn';
  }
  function applyCfgCat() {
    document.querySelectorAll('.cfg-cats [data-cat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === cfgCat)));
    document.querySelectorAll('main section.box').forEach(sec => {
      const c = catOfBox(sec);
      sec.classList.toggle('cat-hide', cfgCat !== 'all' && c !== 'summary' && c !== cfgCat);
    });
  }
  function cfgHTML() {
    if (scope === 'stu' && !D.students.length) return '<div class="box"><h2>还没有学生</h2><div class="muted">先在「学生」里加学生。</div></div>';
    if (scope === 'tpl' && !tplKey) return '<div class="box"><h2>还没有方案</h2><div class="muted">数据库里没有读到方案，请刷新页面；还是没有的话请联系管理员。</div></div>';
    const t = TPL(), CN = CNT(), rq = scope === 'stu' ? reqOf(stuKey) : null;
    const cats = scope === 'tpl' ? '' : '<div class="cfg-cats" role="group" aria-label="设置分组">' + CFG_CATS.filter(([k]) => k !== 'ai' || scope === 'global').map(([k, nm]) => '<button type="button" data-cat="' + k + '" aria-pressed="' + (cfgCat === k) + '">' + nm + '</button>').join('') + '</div>';
    let h = cats + '<section class="box"><h2>按现在的设置 <small id="sumWho"></small></h2><div class="stats">' +
      '<div class="stat"><b id="sDay"></b><span id="sDayLab">每天新词</span></div><div class="stat"><b id="sWords"></b><span>所选档位的词</span></div><div class="stat"><b id="sWeeks"></b><span id="sYears"></span></div></div>' +
      '<div class="weeks" id="weeks"></div><div class="legend"><span><i style="background:var(--ai-soft)"></i>学新词</span><span><i style="background:var(--warn-bg)"></i>回顾周</span><span>前 16 周；按不追加、不缺学、错词不占名额估算</span></div>' +
      '<div class="note">改好点下面「保存」。<b>学生已经开始的这一周照旧</b>，从各自的下一周起用新设置（延长中的那一周也照旧）。</div></section>' +
      (scope === 'stu' ? '<section class="box"><h2>这个学生用哪个方案</h2><div class="field" style="border-top:0"><div class="fl"><span>方案</span><span class="inh">换方案后，没单独改过的项会跟着新方案走；学过的词和成绩都保留</span></div>' + seg('c-tplOf', '方案', D.plans.map(p => [p.key, esc(p.name)])) + '</div>' +
        (rq ? '<div class="note rqbar"><span>学生申请换成「<b>' + esc(rq.tname) + '</b>」' + (rq.reason ? '，理由：' + esc(rq.reason) : '（没写理由）') + ' · ' + stamp(rq.at) + '</span><span class="rqb"><button type="button" class="gbtn" data-rq="' + esc(rq.id) + '" data-ok="1">同意</button><button type="button" class="gbtn" data-rq="' + esc(rq.id) + '" data-ok="0">不同意</button></span></div>' : '') + '</section>' : '') +
      secA('bxAmt', '<h2>学习量</h2>') + fld('weekly', '每周新词数', stepHTML('weekly')) + fld('days', '每周学几天', stepHTML('days')) +
      fld('addOn', '学完可以「再来一组」', sw('addOn', '学完可以再来一组'), hint('追加的词算进本周，一起考')) + fld('addN', '一组几个', stepHTML('addN')) +
      fld('order', '本周词单顺序', seg('c-order', '本周词单顺序', [['mix', '打乱'], ['lv', '按档从易到难']]), hint('打乱：各档的词、上周错词混在一起，同一周里顺序固定。按档：上周错词在前，新词从 N5 到 N1、常用的在前')) + secZ +
      secA('bxLv', '<h2>' + (scope === 'tpl' ? '方案「' + esc(t[tplKey] || '') + '」：各档怎么学' : '各档怎么学') + ' <small>' + LV.map((l, i) => l + ' ' + CN[i]).join(' · ') + '</small></h2>') +
      (scope === 'tpl' ? '<div class="muted">方案还可以单独设下面的「刷题」「整卷再做一遍」「题目上方的档和难度星级」' + (has37() ? '「全部词表和题型表现」' : '') + (has38() ? '「听力、随身听、快刷」' : '') + (has39() ? '「一个月后抽查」「回顾周每天的目标」' : '') + '；其他设置都跟「所有学生的默认」，要单独调某个学生请到「单个学生」。</div><div class="copyrow"><button type="button" class="gbtn" id="copyTpl">复制成新方案</button><button type="button" class="gbtn" id="renTpl">改名</button></div>' : '') +
      fld('mode', '学法', seg('c-mode', '学法', [['mix', '按比例混合'], ['step', '逐级'], ['only', '只学某几档']])) +
      '<div class="small muted" id="lvNote" hidden></div>' +
      '<div class="sub2" id="pMix"><span class="inh" id="i-ratio"></span><div class="ratio-stack" aria-hidden="true"><i id="rs0" style="background:#22C55E"></i><i id="rs1" style="background:#0EA5E9"></i><i id="rs2" style="background:#F59E0B"></i><i id="rs3" style="background:#6366F1"></i><i id="rs4" style="background:#EC4899"></i></div><div id="lvRows" style="display:flex;flex-direction:column;gap:8px">' +
      LV.map((l, i) => '<div class="lv"><b>' + l + '</b><div class="barr"><i id="bar' + i + '"></i></div><div class="step"><button type="button" data-r="' + i + '" data-dd="-1" aria-label="' + l + ' 减少">−</button><input id="r' + i + '" type="number" min="0" max="100" aria-label="' + l + ' 百分比"><span class="u">%</span><button type="button" data-r="' + i + '" data-dd="1" aria-label="' + l + ' 增加">+</button></div><span class="n" id="rn' + i + '"></span></div>').join('') +
      '</div><div class="sumline" id="ratioSum"><span id="ratioTxt"></span><button type="button" class="gbtn" id="ratioReset">恢复系统初始比例（' + DEF_RATIO.join('/') + '）</button></div></div>' +
      '<div class="sub2" id="pStep">' + fld('start', '从哪一档开始', seg('c-start', '从哪一档开始', LV.map(l => [l, l]))) + '<div class="note" id="stepTxt"></div></div>' +
      '<div class="sub2" id="pOnly">' + fld('only', '学哪几档', '<div class="checks" id="c-only">' + LV.map((l, i) => '<button type="button" class="ck" data-v="' + l + '" aria-pressed="false">' + l + ' · ' + CN[i] + '</button>').join('') + '</div>') + '<div class="note" id="onlyTxt"></div></div>' + secZ +
      secA('bxSrs', '<h2>每天复习 <small>按遗忘曲线：学过的词隔 1、2、4、7、15 天回来一次</small></h2>') + fld('srsOn', '要每天复习', sw('srsOn', '要每天复习')) + fld('srsN', '每天最多复习几个', stepHTML('srsN'), hint('到期的词比这个多时，按到期早的先复习，剩下的明天接着来' + (has39() ? '。开了「一个月后抽查」时，抽查的词也算在这里面' : ''))) + secZ +
      (has39() ? secA('bxChk', '<h2>一个月后抽查（试点） <small id="chkOff"></small></h2>') +
        '<div class="muted small">每天复习里 5 次都「会了」的词就「毕业」了，以后不再出现。打开这一项：毕业满一段时间的词，每天抽几个放进「今天复习」，卡上标「抽查」。保存后马上生效；建议先在「单个学生」或方案里给几个学生试用。</div>' +
        fld('chkOn', '一个月后抽查', sw('chkOn', '一个月后抽查'), hint('默认关。抽查不算新学、不占每周新词数；算在「今天复习」里，也算打卡')) +
        fld('chkDays', '复习毕业满几天开始抽查', stepHTML('chkDays'), hint('默认 30 天')) +
        fld('chkN', '每天最多抽查几个', stepHTML('chkN'), hint('占「每天最多复习几个」里的名额：每天先留给抽查，剩下的给平常的复习。试用的学生建议把「每天最多复习几个」调高（加上每天抽查的个数），不然平常复习会变少')) +
        fld('chkMax', '抽查间隔最长几天', stepHTML('chkMax'), hint('抽查点「会了」：下次隔的天数翻倍（按默认是 30 → 60 → 90），达到这个数以后保持。改了这几项：已经排好的抽查日期保留，下次评分时才按新的间隔安排；还没抽查过的词按新的天数算第一次')) +
        fld('chkErr', '抽查忘了的进错词本', sw('chkErr', '抽查忘了的进错词本'), hint('点「不会」「不太确定」的词都回到每天复习、从第 1 次重新来。默认关＝不进错词本；开＝错的次数加 1、进错词本（错词本里写「一个月后抽查」）')) +
        '<div class="note">学生详情里能看到抽查了几个、忘了几个。</div>' + secZ : '') +
      secA('bxCyc', '<h2>学习循环</h2>') + fld('learnW', '先学几周新词', stepHTML('learnW')) + fld('revW', '接着回顾几周', stepHTML('revW'), hint('填 0 就是不要回顾周')) + secZ +
      secA('bxWk', '<h2>周测</h2>') + '<div class="field"><div class="fl"><span>考哪些词</span></div><span class="lock">本周词单里的全部词，不抽查（含追加的、带过来的错词）</span></div>' +
      fld('untaught', '到周测时还没学的词', seg('c-untaught', '还没学的词', [['test', '照考'], ['next', '不考，挪到下周']])) +
      fld('pass', '及格线', stepHTML('pass')) +
      fld('types', '题型', '<div class="checks" id="c-types">' + TYPES.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('每个词只考一题，从勾选的题型里随机出。前 5 种是 JLPT 考试题型（题库里出好的题）；这个词题库里没有的题型就换别的，都没有时出「看日语选中文」' + (has38() ? '。正式测验不出「听音选意思」（只在刷题、练习里出）' : ''))) +
      fld('instant', '答题时当场判对错', sw('instant', '答题时当场判对错'), hint('开：每题选了马上显示对错，选了就不能改；关：可以改答案，交卷后再看错题。周测、回顾测、季度测、年测都按这一项')) +
      fld('whyT', '当场显示解析的题型', '<div class="checks" id="c-whyT">' + WHY.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('勾上的题型，答完马上在选项下面显示解析。看日语选中文等 3 种简单题本来就没有解析。交卷后的错题解析照旧都有')) +
      (has36() ? fld('testFresh', '测验优先抽没练过的题', sw('testFresh', '测验优先抽没练过的题'), hint('防背题：同一个词有好几种题型时，正式测验先出这个学生在练习、刷题里没做过的那种；都做过就照常随机')) : '') +
      fld('carryFail', '没及格时，错词带到下周', sw('carryFail', '没及格时错词带到下周')) + fld('carryPass', '及格了但有错词，也带到下周', sw('carryPass', '及格了但有错词也带到下周')) +
      fld('total', '带过去以后，下周学多少', seg('c-total', '下周学多少', [['A', '新词照旧＋错词'], ['B', '总数不变']])) + '<div class="note" id="totalTxt"></div>' + secZ +
      secA('bxRev', '<h2>回顾周 <small id="revOff"></small></h2>') + fld('revN', '抽多少个词来考', stepHTML('revN'), hint('学过的词不够时，有多少考多少')) +
      fld('revMust', '前几周错过的词一定抽到', sw('revMust', '错过的词一定抽到'), hint('错词比上面的数还多时，全部考')) + fld('revPass', '及格线', stepHTML('revPass')) + secZ +
      (has39() ? secA('bxRg', '<h2>回顾周每天的目标 <small id="rgOff"></small></h2>') +
        fld('rvDays', '回顾周「复习本轮」分几天复习完', stepHTML('rvDays'), hint('把这一轮要复习的词平均分到每天：学生页「本周任务」显示「今天的目标 N 个、已完成 M 个」。只是目标提示，不强制、不锁，做完可以接着往后做；回顾测照原规则。0＝不分天。保存后马上生效')) + secZ : '') +
      secA('bxQ', '<h2>季度测 <small>按设置出卷</small></h2>') + fld('qOn', '要季度测', sw('qOn', '要季度测')) + fld('qEvery', '每几周考一次', stepHTML('qEvery')) + fld('qN', '抽多少个词', stepHTML('qN')) + fld('qPass', '及格线', stepHTML('qPass')) + secZ +
      secA('bxY', '<h2>年测 <small>按设置出卷</small></h2>') + fld('yOn', '要年测', sw('yOn', '要年测')) + fld('yEvery', '每几周考一次', stepHTML('yEvery')) + fld('yN', '抽多少个词', stepHTML('yN')) + fld('yPass', '及格线', stepHTML('yPass')) + secZ +
      secA('bxMrg', '<h2>几场测验撞在同一周</h2>') + fld('merge', '怎么考', seg('c-merge', '同一周几场测验', [['merge', '合成一场'], ['both', '分开考']])) + secZ +
      secA('bxPz', '<h2>拼图</h2>') + fld('dim', '回顾测答错时，格子变暗', sw('dim', '答错时格子变暗'), hint('关着＝不变暗，只记进错词本')) + secZ +
      (has36() ? secA('bxDrill', '<h2>刷题 <small>学生自己选词刷 JLPT 题；不算成绩、不进错词本、不算打卡。这一块保存后马上生效</small></h2>') +
        fld('drillOn', '开放刷题', sw('drillOn', '开放刷题'), hint('关着＝学生页不显示「刷题」页签，已经开着的刷题也不再判')) +
        fld('drillScopes', '学生可以选刷哪些词', '<div class="checks" id="c-drillScopes">' + DSC.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('至少留一项。「我刷题时错过的」＝刷题时这个词最近一次做错；「全部」含学习范围里还没学的词')) +
        fld('drillMax', '每次最多几题', stepHTML('drillMax'), hint('学生可以选 10／20／50／100（不超过这个数），也可以自己填')) +
        fld('drillPer', '同一次同一个词最多几题', stepHTML('drillPer'), hint('先每个词出一题，词不够时才给同一个词出别的题型')) +
        fld('drillOrder', '默认出题方式', seg('c-drillOrder', '默认出题方式', DORD), hint('优先没做过的：先出学生没见过的题；只出做过的题：只从学生在刷题、练习、测验里答过的题里出（复习用）；全部随机：不管做没做过')) +
        fld('drillOrders', '学生可以选的出题方式', '<div class="checks" id="c-drillOrders">' + DORD.map(([v, nm]) => '<button type="button" class="ck" data-v="' + v + '" aria-pressed="false">' + nm + '</button>').join('') + '</div>', hint('至少留一种；默认的那种关掉了，学生页先选开着的第一种')) + secZ : '') +
      (has36() ? secA('bxRetest', '<h2>整卷再做一遍 <small>正式测验交卷以后，整张卷子原题当练习再做一遍；不算成绩、不进错词本。保存后马上生效</small></h2>') +
        fld('retestN', '最近交卷的几场可以整卷再做', stepHTML('retestN'), hint('0＝不开放；按交卷时间往前数')) + secZ : '') +
      (has36() ? secA('bxShow', '<h2>题目上方的档和难度星级 <small>测验、练习、刷题三处都按这一项；保存后马上生效</small></h2>') +
        fld('starShow', '题目上方显示档和难度星级', sw('starShow', '题目上方显示档和难度星级'), hint('例如「N3 ★★★★」：星级是同一档里比，1 星最容易。关掉＝三处都不显示，刷题页也不再有「按难度」筛选（不管开不开刷题都能改）')) + secZ : '') +
      (has37() ? secA('bxWl', '<h2>全部词表和题型表现 <small>学生「进度」页里的词表、各题型正确率；保存后马上生效</small></h2>') +
        fld('wlOn', '开放全部词表', sw('wlOn', '开放全部词表'), hint('学生在「进度」页点「全部词表」：能筛选、搜索、遮住读音或中文自测，点一个词看这张卡（不算学习记录）。关着＝没有这个入口。正式测验开了考还没交卷时，词表自动暂停')) +
        fld('wlSee', '没学过的词能不能看', seg('c-wlSee', '没学过的词能不能看', WLSEE), hint('能看：学习范围里还没学的词也列出来（可以提前看）；只看学过的和本周的：没学过的词不列、也点不开')) +
        fld('tyDays', '各题型正确率的「最近几天」', stepHTML('tyDays'), hint('学生「进度」页、学生详情里的各题型正确率，可以在「最近这几天」和「全部」之间切换')) +
        fld('tyMin', '一种题型少于几题标「题少，仅供参考」', stepHTML('tyMin')) + secZ : '') +
      (has38() ? secA('bxLq', '<h2>听力、随身听、快刷 <small>学生页的听音选意思、「进度」页的随身听和快刷；保存后马上生效</small></h2>') +
        fld('acOn', '刷题、练习里出「听音选意思」', sw('acOn', '刷题、练习里出听音选意思'), hint('播单词读音、四个中文意思选一个（没有读音的词不出）。开：刷题可以选这个题型、组后小练也会出；关：刷题不能选，练习里不出，已经打开的还没答的听音题也不再判。正式测验（周测、回顾测、季度测、年测）一律不出听音题')) +
        fld('lsOn', '开放随身听', sw('lsOn', '开放随身听'), hint('连着播本周的词、错词本或词表筛出来的词：单词 → 例句 1 → 例句 2。不算学习记录、不算打卡。学生页得知这周开了考还没交卷就暂停（进随身听、快刷时和从别的应用切回来时会再核对一次）')) +
        fld('lsRep', '随身听每个词连着播几遍', stepHTML('lsRep'), hint('单词＋例句算一遍')) +
        fld('lsGap', '随身听词与词之间停几秒', stepHTML('lsGap'), hint('0～10 秒，可以填 1.5 这样的小数；一个词里两条之间固定停 0.6 秒')) +
        fld('lsEx', '随身听播例句', sw('lsEx', '随身听播例句'), hint('关着＝只播单词')) +
        fld('lsOrder', '随身听顺序', seg('c-lsOrder', '随身听顺序', ORDS)) +
        fld('qfOn', '开放快刷', sw('qfOn', '开放快刷'), hint('一词一屏，点一下翻面，左右滑换词；「会／不会」只是学生给自己看的小标。不算学习记录、不进错词本、不算打卡')) +
        fld('qfFront', '快刷先看哪一面', seg('c-qfFront', '快刷先看哪一面', [['w', '写法'], ['m', '中文']])) +
        fld('qfOrder', '快刷顺序', seg('c-qfOrder', '快刷顺序', ORDS)) +
        '<div class="note">随身听、快刷的几项是默认值：学生可以在自己的手机上改（只存在那个浏览器里），没改过的跟这里走。</div>' + secZ : '') +
      (has36() ? secA('bxStar', '<h2>题目难度星级 <small>题目本身的规则，只在这里改</small></h2>', scope === 'global' ? '' : ' hidden') +
        fld('starAuto', '按真实答对率自动修正星级', sw('starAuto', '按真实答对率自动修正星级'), hint('关着＝一直用初始星级（Codex 逐题打的星）')) +
        fld('starN', '一道题有效作答多少次以后开始修正', stepHTML('starN'), hint('每个学生只算第一次作答（测验、练习、刷题都算）。这个数也是初始星级的分量：现在的星＝（初始星×这个数＋按答对率排的星×作答数）÷（这个数＋作答数），答的人越多越靠真实答对率')) +
        fld('starMinQ', '同一档至少几道够数的题才排位', stepHTML('starMinQ'), hint('够数的题在同一档里按答对率排：答对率最高的 10%＝1 星、接着 25%＝2 星、30%＝3 星、25%＝4 星、最难的 10%＝5 星（答对率一样的取中间名次；全都一样就不排）')) +
        '<div class="note">这几项保存后马上重算一次；平时每天第一次打开管理端时也重算一次。哪些题的星级变了，在顶上的「题目难度」页看（那里也能马上重算）。</div>' + secZ : '') +
      secA('bxEx', '<h2>拓展例句 <small>卡片背面的知识例句、时事例句，学生点了才生成</small></h2>', scope === 'global' ? '' : ' hidden') +
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
      '<div class="note">每月预算、价格、用量、学生报错、试生成在顶上的「拓展例句」页。</div>' + secZ;
    // 方案只管「各档怎么学」和刷题：别的块都不显示（元素留着，页面的其他计算照常）
    if (scope === 'tpl') h = h.replace(/<section class="box"(?! id="bx(?:Lv|Drill|Show|Retest|Wl|Lq|Chk|Rg)")/g, '<section class="box" hidden');   // 第 36 步起方案也管刷题、题目上方显示档和星级、整卷再做；第 37 步起也管词表和题型表现；第 38 步起也管听力、随身听、快刷
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
    if (k === 'drillScopes') return DSC.filter(([t]) => scOn(v, t)).map(([, nm]) => nm).join('、') || '（无）';
    if (k === 'drillOrders') return DORD.filter(([t]) => scOn(v, t)).map(([, nm]) => nm).join('、') || '（无）';
    if (k === 'drillOrder') return (DORD.find(([t]) => t === v) || [, String(v)])[1];
    if (k === 'wlSee') return v === 'learned' ? '只看学过的和本周的' : '能看';
    if (k === 'lsOrder' || k === 'qfOrder') return v === 'rand' ? '打乱' : '按顺序';   // 第 38 步
    if (k === 'qfFront') return v === 'm' ? '先看中文' : '先看写法';
    if (k === 'rvDays' && v === 0) return '不分天';   // 第 39 步
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
    const pw = has39() ? '、刷题、词表和题型表现、听力和随身听快刷、一个月后抽查和回顾周目标' : has38() ? '、刷题、词表和题型表现、听力和随身听快刷' : has37() ? '、刷题、词表和题型表现' : has36() ? '和刷题' : '';   // 方案能单独设哪些（第 36 步起刷题，第 37 步起词表和题型表现，第 38 步起听力、随身听、快刷）
    $('who').innerHTML = '正在改：<b>' + esc(nm) + '</b>' + (scope === 'global' ? '（每个学生的起点；方案只管各档怎么学' + pw + '）' : scope === 'tpl' ? '（用这个方案的学生，共 ' + D.students.filter(x => x.plan === tplKey).length + ' 人；方案只管各档怎么学' + pw + '）' : '（只影响这一个学生）');
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
    $('c-types').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', typeOn(e.types, x.dataset.v) ? 'true' : 'false'));   // 听音选意思没写过＝不勾
    $('c-whyT').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', whyOn(e.whyT, x.dataset.v) ? 'true' : 'false'));
    if (scope === 'stu') $('c-tplOf').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === draft.tpl ? 'true' : 'false'));
    SW.forEach(k => { const el = $('f-' + k); if (el) el.setAttribute('aria-checked', e[k] ? 'true' : 'false'); });   // 旧数据库没有刷题的开关：那几个不画
    const cds = $('c-drillScopes'); if (cds) cds.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', scOn(e.drillScopes, x.dataset.v) ? 'true' : 'false'));
    const cdo = $('c-drillOrders'); if (cdo) cdo.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', scOn(e.drillOrders, x.dataset.v) ? 'true' : 'false'));
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
    LV.forEach((l, i) => { $('bar' + i).style.width = Math.min(100, num(e.ratio[i])) + '%'; const rsEl = $('rs' + i); if (rsEl) rsEl.style.width = Math.min(100, num(e.ratio[i])) + '%'; $('rn' + i).textContent = '约 ' + per[i] + ' 个/周'; });
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
    lockBox('bxDrill', !e.drillOn, 'drillOn'); lockBox('bxStar', !e.starAuto, 'starAuto');
    const dimF = (ks, off) => ks.forEach(k => { const f = $('fd-' + k); if (f) { f.classList.toggle('dim', off); f.querySelectorAll('input,button:not([data-reset])').forEach(x => x.disabled = off); } });   // 第 38 步
    dimF(['lsRep', 'lsGap', 'lsEx', 'lsOrder'], e.lsOn === false); dimF(['qfFront', 'qfOrder'], e.qfOn === false);
    dimF(['chkDays', 'chkN', 'chkMax', 'chkErr'], e.chkOn !== true);   // 第 39 步：抽查关着时下面几项先不用改
    const co = $('chkOff'); if (co) co.textContent = e.chkOn === true && e.srsOn === false ? '现在「每天复习」关着，抽查也不出' : '';
    const ro = $('rgOff'); if (ro) ro.textContent = e.revW === 0 ? '现在没有回顾周，这一项不起作用' : '';
    const fws = $('fd-wlSee'); if (fws) { fws.classList.toggle('dim', e.wlOn === false); fws.querySelectorAll('button:not([data-reset])').forEach(x => x.disabled = e.wlOn === false); }   // 第 37 步：关了词表，「没学过的词能不能看」先不用改（题型表现两项不受影响）
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
    secStat(e, ch);   // 11-27：每一块标题下面那一行（收起来也看得到现在的设置、改了几处）
  }
  const dirtyCount = () => (tab === 'cfg' && draft && $('dirty')) ? changes().length : 0;
  function guard() { const n = dirtyCount(); if (n) { toast('先保存或放弃这 ' + n + ' 处改动，再切换'); return true; } return false; }
  async function saveCfg(btn) {
    const ch = changes(); if (!ch.length || savingCfg) return;
    savingCfg = true; busy(btn, true);
    const items = ch.map(([k, a, b]) => LAB[k] + '：' + a + ' → ' + b);
    const ver = draftVer;
    // 保存前后这一层（单个学生：这个学生实际用的设置，换方案带来的变化也算）哪些项变了：提示里写生效时间用
    const L0 = layer(), effOld = scope === 'global' ? clone(D.global) : Object.assign(base(scope === 'stu' ? L0.tpl : undefined), clone(scope === 'stu' ? L0.ov : L0)), effNew = clone(eff());
    try {
      if (scope === 'global') await rpc('adm_save_cfg', { scope, target: '', d: draft, pl: null, items, ver });
      else if (scope === 'tpl') await rpc('adm_save_cfg', { scope, target: tplKey, d: draft, pl: null, items, ver });
      else await rpc('adm_save_cfg', { scope, target: stuKey, d: draft.ov, pl: draft.tpl, items, ver });
      // 先把刚保存的设置写进本页，再重新读取；读取失败也不会拿旧设置盖回去
      if (scope === 'global') { D.global = Object.assign({}, D.global, clone(draft)); D.gver = ver + 1; }
      else if (scope === 'tpl') { const p = D.plans.find(x => x.key === tplKey); if (p) { p.ov = clone(draft); p.ver = ver + 1; } }
      else { const s = stuOf(stuKey); if (s) { s.ov = clone(draft.ov); s.plan = draft.tpl; s.ver = ver + 1; } }
      draft = null; savingCfg = false;
      // 按这次实际改的项写生效时间：刷题、星级、拓展例句的设置马上生效（星级规则改了马上重算）；其他从各学生的下一周起
      const NOW = ['drillOn', 'drillScopes', 'drillMax', 'drillPer', 'drillOrder', 'drillOrders', 'starShow', 'retestN', 'starAuto', 'starN', 'starMinQ', 'wlOn', 'wlSee', 'tyDays', 'tyMin',
        'acOn', 'lsOn', 'lsRep', 'lsGap', 'lsEx', 'lsOrder', 'qfOn', 'qfFront', 'qfOrder',
        'chkOn', 'chkDays', 'chkN', 'chkMax', 'chkErr', 'rvDays'], isNow = k => NOW.includes(k) || /^ex/.test(k);   // 第 39 步：抽查、回顾周目标也马上生效
      const keys = [...new Set([...Object.keys(effOld || {}), ...Object.keys(effNew || {})])].filter(k => !same((effOld || {})[k], (effNew || {})[k]));
      const nNow = keys.filter(isNow).length, nAll = keys.length, star = keys.some(k => ['starAuto', 'starN', 'starMinQ'].includes(k));
      // 混着改时把马上生效的项全部点名（按设置页上的先后；4 项以上分行写，提示多停一会儿）
      const LK = Object.keys(LAB), nowNames = keys.filter(isNow).sort((a, b) => (LK.indexOf(a) + 1 || 999) - (LK.indexOf(b) + 1 || 999)).map(k => LAB[k] || k), many = nowNames.length > 3, REST = '其他的已经开始的这一周照旧，各学生从下一周起用新设置';
      toast('已保存：' + (nAll && nNow === nAll ? '马上生效' + (star ? '，题目星级已经按新规则重算' : '')
        : !nNow ? '已经开始的这一周照旧，各学生从下一周起用新设置'
        : many ? '下面 ' + nNow + ' 项马上生效' + (star ? '（星级已重算）' : '') + '：\n' + nowNames.join('、') + '\n' + REST
        : nowNames.join('、') + ' 马上生效' + (star ? '（星级已重算）' : '') + '；' + REST), many ? 8000 : undefined);
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
    const at = t.closest('[data-atab]'); if (at) { if (at.dataset.atab === tab || guard()) return; if (tab === 'wd') wdLeave(); tab = at.dataset.atab; cfgCat = 'all'; draft = null; if (tab === 'ex') EXA = null; if (tab === 'qs') QS = null; render(); if (tab === 'wd') wdEnter(); return; }
    if (tab === 'stu') {
      const sf = t.closest('[data-sf]'); if (sf) { stuFilter = sf.dataset.sf; document.querySelectorAll('[data-sf]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sf === stuFilter))); const el = $('stuList'); if (el) el.innerHTML = stuListHTML(); return; }
    }
    if (tab === 'wd') {   // 第 40 步：词库
      const wi = t.closest('[data-wdid]'); if (wi) { wordModal(wi.dataset.wdid); return; }
      const wl = t.closest('[data-wdlv],[data-wdst]'); if (wl) {
        wdInit(); const qi = $('wdqi'); if (qi) WD.q = qi.value.trim().slice(0, 30);
        if (wl.dataset.wdlv !== undefined) WD.lv = wl.dataset.wdlv; else WD.st = wl.dataset.wdst;
        document.querySelectorAll('[data-wdlv]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.wdlv === WD.lv)));
        document.querySelectorAll('[data-wdst]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.wdst === WD.st)));
        wdFind(0); return;
      }
      const wp = t.closest('[data-wdpg]'); if (wp) { if (!wp.disabled && WD && !WD.busy) { wdFind(num(wp.dataset.wdpg)); const el = $('wdres'); if (el) el.scrollIntoView({ block: 'start' }); } return; }
      const wa = t.closest('[data-wa]'); if (wa) {
        if (wa.dataset.wa === 'imp') impModal();
        else if (wa.dataset.wa === 'refind') wdFind();
        else if (wa.dataset.wa === 'todocopy') copyText(((WD && WD.todo && WD.todo.rows) || []).map(x => x.id).join('\n'));
        return;
      }
    }
    if (tab === 'qs') { const qa = t.closest('[data-qa]'); if (qa) { qsAct(qa); return; } }
    if (tab === 'ex') {
      const xa = t.closest('[data-xa]'); if (xa) { exaAct(xa); return; }
      const xs = t.closest('#xtk button[data-v], #xtp button[data-v]'); if (xs) { if (xs.parentElement.id === 'xtk') exT.kind = xs.dataset.v; else exT.prov = xs.dataset.v; exT.res = null; render(); return; }
    }
    if (t.closest('[data-a="add"]')) { addModal(); return; }
    if (t.closest('[data-a="reqs"]')) { reqsModal(); return; }
    if (t.closest('[data-a="fails"]')) { failsModal(); return; }
    const st = t.closest('[data-stu]'); if (st) { detailModal(st.dataset.stu); return; }
    if (tab !== 'cfg') return;
    if (savingCfg) { toast('正在保存，等一下'); return; }
    const sc = t.closest('[data-scope]'); if (sc) { const ns = sc.dataset.scope, nk = sc.dataset.tpl || tplKey; if ((ns === scope && (ns !== 'tpl' || nk === tplKey)) || guard()) return; scope = ns; cfgCat = 'all'; if (ns === 'tpl') tplKey = nk; draft = null; render(); window.scrollTo({ top: 0 }); return; }
    const ct = t.closest('[data-cat]'); if (ct) { cfgCat = ct.dataset.cat; applyCfgCat(); return; }
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
    const jp = t.closest('[data-jump]'); if (jp) {
      if (cfgCat !== 'all') { cfgCat = 'all'; applyCfgCat(); }
      const el = $(jp.dataset.jump); if (!el) return;
      foldReveal(el);   // 11-27：那一块收着就先打开（只这一次，不改记下的开合）
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const f = jp.dataset.jump === 'pMix' ? $('r0') : el.querySelector('#c-only .ck:not(:disabled)') || el.querySelector('input:not(:disabled), button:not(:disabled)');   // 焦点放到要改的第一个比例框／选档按钮（键盘、读屏接着就在这里）
      if (f) try { f.focus({ preventScroll: true }); } catch (er) {}
      return;
    }
    if (!draft) return;
    const sb = t.closest('button[data-k]'); if (sb) { const k = sb.dataset.k, [, mn, mx, sp] = NUM[k], v = Math.min(mx, Math.max(mn, Math.round((num(eff()[k], mn) + sp * (+sb.dataset.dd)) * 10) / 10)); $('f-' + k).value = v; setVal(k, v); return; }
    const rr = t.closest('button[data-r]'); if (rr) { const i = +rr.dataset.r, r = eff().ratio.slice(); r[i] = Math.min(100, Math.max(0, r[i] + (+rr.dataset.dd))); $('r' + i).value = r[i]; setVal('ratio', r); return; }
    const swb = t.closest('.sw'); if (swb) { const k = swb.id.slice(2); setVal(k, !eff()[k]); return; }
    const sg = t.closest('.seg button[data-v]'); if (sg && sg.parentElement.id) { const id = sg.parentElement.id; if (id === 'c-tplOf') { draft.tpl = sg.dataset.v; syncInputs(); refresh(); return; } setVal(id.slice(2), sg.dataset.v); return; }
    const ck = t.closest('.ck'); if (ck) {
      const id = ck.parentElement.id, v = ck.dataset.v, cur = eff();
      if (id === 'c-only') { let a = (cur.only || []).slice(); a = a.includes(v) ? a.filter(x => x !== v) : LV.filter(l => a.includes(l) || l === v); if (!a.length) { toast('至少要学一档'); return; } setVal('only', a); }
      else if (id === 'c-whyT') { const o = {}; WHY.forEach(([t]) => o[t] = whyOn(cur.whyT, t)); o[v] = !o[v]; setVal('whyT', o); }
      else if (id === 'c-drillOrders') { const o = {}; DORD.forEach(([t]) => o[t] = scOn(cur.drillOrders, t)); o[v] = !o[v]; if (!DORD.some(([t]) => o[t])) { toast('出题方式至少留一种'); return; } setVal('drillOrders', o); }
      else if (id === 'c-drillScopes') { const o = {}; DSC.forEach(([t]) => o[t] = scOn(cur.drillScopes, t)); o[v] = !o[v]; if (!DSC.some(([t]) => o[t])) { toast('至少留一项；不想让学生刷题，请关掉「开放刷题」'); return; } setVal('drillScopes', o); }
      else { const o = {}; TYPES.forEach(([t]) => o[t] = typeOn(cur.types, t)); o[v] = !o[v]; if (!TYPES.some(([t]) => o[t])) { toast('至少要留一种题型'); return; } setVal('types', o); }
      return;
    }
    const rs = t.closest('[data-reset]'); if (rs) { delete ov()[rs.dataset.reset]; syncInputs(); refresh(); return; }
    if (t.closest('#ratioReset')) { LV.forEach((l, i) => $('r' + i).value = DEF_RATIO[i]); setVal('ratio', DEF_RATIO.slice()); return; }
    if (t.closest('#discard')) { loadDraft(); typing = false; toast('已放弃本次编辑'); return; }
    if (t.closest('#save')) { saveCfg(t.closest('#save')); return; }
  });
  document.addEventListener('input', e => {
    if ($('app').dataset.role !== 'adm') return;
    if (tab === 'stu' && e.target && e.target.id === 'stuQ') { stuQ = e.target.value; const el = $('stuList'); if (el) el.innerHTML = stuListHTML(); return; }
    if (tab === 'cfg' && e.target.closest && e.target.closest('main')) typing = true;
  });
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
      if (raw === '' || !Number.isFinite(v)) { t.value = cur; toast('要填 ' + mn + '～' + mx + ' 之间的' + (NUM[k][3] % 1 ? '数' : '整数') + '，没有改'); return; }
      const dec = NUM[k][3] % 1 !== 0, c = Math.min(mx, Math.max(mn, dec ? Math.round(v * 10) / 10 : Math.round(v)));   // 第 38 步：随身听停几秒可以有一位小数
      if (c !== v) toast('只能填 ' + mn + '～' + mx + ' 之间的' + (dec ? '数（最多一位小数）' : '整数') + '，已改成 ' + c);
      t.value = c; setVal(k, c); return;
    }
    if (/^r\d$/.test(t.id)) { const i = +t.id[1], r = eff().ratio.slice(), raw = t.value.trim(), v = Number(raw); if (raw === '' || !Number.isFinite(v)) { t.value = r[i]; return; } r[i] = Math.min(100, Math.max(0, Math.round(v))); t.value = r[i]; setVal('ratio', r); }
  });
  document.addEventListener('keydown', e => {
    if (!D || $('app').dataset.role !== 'adm' || document.querySelector('.modal')) return;
    const st = e.target.closest && e.target.closest('[data-stu]');
    if (st && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); detailModal(st.dataset.stu); }
    const wi = e.target.closest && e.target.closest('.it[data-wdid]');   // 第 40 步：词库的一行
    if (wi && tab === 'wd' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); wordModal(wi.dataset.wdid); }
  });
  window.addEventListener('beforeunload', e => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
  return { start };
})();
