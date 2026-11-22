// 单词学习系统 · 管理端：学生、设置面板（全局 → 方案 → 学生三层）、改动记录
const Adm = (() => {
  let D = null, tab = 'stu', scope = 'global', tplKey = 'weak', stuKey = null, draft = null, savingCfg = false, copying = false;
  let draftBase = null, draftVer = null, rebase = null, detailSeq = 0;   // 草稿开始编辑时的设置和版本号（两个窗口同时改时用来核对、合并）
  const NUM = { srsN: ['个', 0, 200, 5], weekly: ['个', 10, 500, 10], days: ['天', 1, 7, 1], addN: ['个', 5, 100, 5], learnW: ['周', 1, 12, 1], revW: ['周', 0, 4, 1], pass: ['%', 50, 100, 5],
    revN: ['个', 10, 500, 10], revPass: ['%', 50, 100, 5], qEvery: ['周', 4, 52, 1], qN: ['个', 10, 1000, 10], qPass: ['%', 50, 100, 5], yEvery: ['周', 12, 104, 1], yN: ['个', 10, 2000, 10], yPass: ['%', 50, 100, 5] };
  const LAB = { weekly: '每周新词数', days: '每周学几天', addOn: '再来一组', addN: '一组几个', mode: '学法', ratio: '各档比例', start: '从哪一档开始', only: '学哪几档',
    srsOn: '每天复习', srsN: '每天最多复习', learnW: '先学几周', revW: '回顾几周', untaught: '还没学的词', pass: '周测及格线', types: '周测题型', carryFail: '没及格带错词', carryPass: '及格也带错词', total: '下周学多少',
    revN: '回顾周抽多少', revMust: '错词一定抽到', revPass: '回顾周及格线', qOn: '季度测', qEvery: '季度测间隔', qN: '季度测抽多少', qPass: '季度测及格线',
    yOn: '年测', yEvery: '年测间隔', yN: '年测抽多少', yPass: '年测及格线', merge: '同周测验', dim: '答错变暗', tplOf: '方案',
    order: '本周词单顺序', instant: '答题时当场判对错', whyT: '当场显示解析的题型' };
  const SW = ['srsOn', 'addOn', 'carryFail', 'carryPass', 'revMust', 'qOn', 'yOn', 'dim', 'instant'];
  const SEGS = [['mode', 'c-mode'], ['total', 'c-total'], ['start', 'c-start'], ['untaught', 'c-untaught'], ['merge', 'c-merge'], ['order', 'c-order']];
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

  function fix() { D.global = Object.assign({ srsOn: true, srsN: 20, order: 'mix', instant: true, whyT: clone(DEF_WHY) }, D.global || {}); D.plans = D.plans || []; D.students = D.students || []; D.logs = D.logs || []; D.counts = D.counts || {}; if (!D.plans.some(p => p.key === tplKey)) tplKey = D.plans.length ? D.plans[0].key : null; }
  function start(d) { D = d; fix(); $('app').dataset.role = 'adm'; render(); }
  async function reload() { let ok = true; try { D = await rpc('adm_load', {}, { obj: true }); } catch (e) { ok = false; fail(e); } fix(); render(); return ok; }

  function render() {
    const tabs = [['stu', '学生'], ['cfg', '设置'], ['log', '改动记录']];
    let h = '<header class="top"><div class="wrap wide"><div class="row"><div class="brand"><b>单词系统 · 管理</b><span>' + esc(D.me) + '</span></div>' +
      '<div class="seg" role="group" aria-label="切换">' + tabs.map(([k, n]) => '<button type="button" data-atab="' + k + '" aria-pressed="' + (tab === k) + '">' + n + '</button>').join('') + '</div></div>' +
      (tab === 'cfg' ? scopeBar() : '') + '</div></header>';
    if (tab === 'stu') h += '<main class="wrap wide">' + stuHTML() + '</main>';
    else if (tab === 'log') h += '<main class="wrap wide">' + logHTML() + '</main>';
    else h += '<main class="wrap">' + cfgHTML() + '</main>' + saveBar();
    $('app').innerHTML = h;
    if (tab === 'cfg') { buildSteps(); loadDraft(); }
  }

  // ── 学生 ──
  function stuHTML() {
    const t = TPL();
    let h = '<div class="row"><div class="muted">词库：' + LV.map(l => l + ' ' + (D.counts[l] || 0)).join(' · ') + '</div><button class="btn main" data-a="add">＋ 加学生</button></div>';
    if (!D.students.length) return h + '<div class="box"><h2>还没有学生</h2><div class="muted">点右上角「加学生」，加好后把专属链接发给学生，学生用手机打开就能学。</div></div>';
    h += '<div class="box"><div class="list">' + D.students.map(s => {
      const w = s.week, lt = s.last_test;
      const wk = w ? '第 ' + num(w.no) + ' 周' + (w.kind === 'R' ? '（回顾）' : '') + (w.cur ? (w.kind === 'L' ? (num(w.n) ? ' · 本周练过 ' + num(w.done) + '/' + num(w.n) : ' · <span class="chip warn">这周没有词</span>') : '') : '（已到期，学生还没打开新的一周）') : md(s.start) + ' 开始';
      return '<div class="it clickable" data-stu="' + esc(s.id) + '" role="button" tabindex="0"><div class="main"><div class="nm">' + esc(s.name) + (s.grp ? ' <span class="chip">' + esc(s.grp) + '</span>' : '') + (s.streak ? ' <span class="chip ok">连续 ' + num(s.streak) + ' 天</span>' : '') + (s.active ? '' : ' <span class="chip bad">已停用</span>') + '</div>' +
        '<div class="sub">' + esc(t[s.plan] || s.plan) + (Object.keys(s.ov || {}).length ? ' · 单独改了 ' + Object.keys(s.ov).length + ' 项' : '') + (s.next_cut != null ? ' · 下周只学 ' + num(s.next_cut) + ' 个' : '') + '</div></div>' +
        '<div class="sub side"><div>' + wk + ' · 累计学过 ' + num(s.learned) + ' · 全亮 ' + num(s.correct) + '</div>' +
        '<div>' + (lt ? '最近测验 ' + num(lt.score) + '/' + num(lt.total) + (lt.passed ? ' 及格' : lt.manual ? ' 放行' : ' 没及格') : '还没考过') + ' · ' + (s.last_seen ? '最后打开 ' + stamp(s.last_seen) : '还没打开过') + '</div></div></div>';
    }).join('') + '</div></div>';
    return h;
  }
  function addModal() {
    const today = new Date(), p = n => String(n).padStart(2, '0');
    const ds = today.getFullYear() + '-' + p(today.getMonth() + 1) + '-' + p(today.getDate());
    const m = modal('<h2>加学生</h2><form class="form" id="addf"><label>名字（学生和你都看得到）<input id="an" maxlength="30" required></label>' +
      '<label>方案<select id="ap">' + D.plans.map(x => '<option value="' + esc(x.key) + '"' + (x.key === 'std' ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
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
      '<div class="row"><span>设置下周新词数（只改下一周；0 ＝ 暂停新词）</span><span class="copyrow"><input id="cutv" type="number" min="0" max="500" value="' + num(s.next_cut ?? 50, 50) + '" style="width:80px" aria-label="下周新词数"><button class="gbtn" data-d="cut">设好</button></span></div>' +
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
        toast({ extend: '已延长：第 ' + num(cur && cur.no) + ' 周到 ' + md(r && r.end ? r.end : '') + ' 结束', cut: val === 0 ? '已设好：下周暂停新词' : '已设好：下周只学 ' + val + ' 个', pass: '已放行', refill: '已补发 ' + num(r && r.added) + ' 个新词' }[d]);
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

  // ── 设置面板 ──
  const stepHTML = k => '<div class="step"><button type="button" data-k="' + k + '" data-dd="-1" aria-label="减少">−</button><input id="f-' + k + '" type="number" inputmode="numeric" min="' + NUM[k][1] + '" max="' + NUM[k][2] + '"><span class="u">' + NUM[k][0] + '</span><button type="button" data-k="' + k + '" data-dd="1" aria-label="增加">+</button></div>';
  const fld = (k, label, ctrl, extra = '') => '<div class="field" data-key="' + k + '" id="fd-' + k + '"><div class="fl"><span>' + label + '</span><span class="inh" id="i-' + k + '"></span>' + extra + '</div>' + ctrl + '</div>';
  const sw = (k, label) => '<button type="button" class="sw" role="switch" id="f-' + k + '" aria-label="' + label + '"></button>';
  const seg = (id, label, opts) => '<div class="seg" role="group" aria-label="' + label + '" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" aria-pressed="false">' + n + '</button>').join('') + '</div>';
  const hint = t => '<span class="inh">' + t + '</span>';

  function scopeBar() {
    const t = TPL();
    if (!stuKey && D.students.length) stuKey = D.students[0].id;
    return '<div class="row"><div class="seg" role="group" aria-label="改哪一层">' + [['global', '全局默认'], ['tpl', '方案模板'], ['stu', '单个学生']].map(([k, n]) => '<button type="button" data-scope="' + k + '" aria-pressed="' + (scope === k) + '">' + n + '</button>').join('') + '</div>' +
      (scope === 'tpl' ? '<span class="copyrow"><select id="pickTpl" aria-label="选方案">' + D.plans.map(p => '<option value="' + esc(p.key) + '"' + (p.key === tplKey ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select><button class="gbtn" id="copyTpl">复制成新方案</button><button class="gbtn" id="renTpl">改名</button></span>' : '') +
      (scope === 'stu' ? (D.students.length ? '<select id="pickStu" aria-label="选学生">' + D.students.map(s => '<option value="' + s.id + '"' + (s.id === stuKey ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>' : '<span class="muted">还没有学生</span>') : '') +
      '</div><div class="muted" id="who"></div>';
  }
  function cfgHTML() {
    if (scope === 'stu' && !D.students.length) return '<div class="box"><h2>还没有学生</h2><div class="muted">先在「学生」里加学生。</div></div>';
    if (scope === 'tpl' && !tplKey) return '<div class="box"><h2>还没有方案</h2><div class="muted">数据库里没有读到方案，请刷新页面；还是没有的话请联系管理员。</div></div>';
    const t = TPL(), CN = CNT();
    return '<section class="box"><h2>按现在的设置 <small id="sumWho"></small></h2><div class="stats">' +
      '<div class="stat"><b id="sDay"></b><span id="sDayLab">每天新词</span></div><div class="stat"><b id="sWords"></b><span>所选档位的词</span></div><div class="stat"><b id="sWeeks"></b><span id="sYears"></span></div></div>' +
      '<div class="weeks" id="weeks"></div><div class="legend"><span><i style="background:var(--ai-soft)"></i>学新词</span><span><i style="background:var(--warn-bg)"></i>回顾周</span><span>前 16 周；按不追加、不缺学、错词不占名额估算</span></div>' +
      '<div class="note">改好点下面「保存」。<b>学生已经开始的这一周照旧</b>，从各自的下一周起用新设置（延长中的那一周也照旧）。</div></section>' +
      (scope === 'stu' ? '<section class="box"><h2>这个学生用哪个方案</h2><div class="field" style="border-top:0"><div class="fl"><span>方案</span><span class="inh">换方案后，没单独改过的项会跟着新方案走；学过的词和成绩都保留</span></div>' + seg('c-tplOf', '方案', D.plans.map(p => [p.key, esc(p.name)])) + '</div></section>' : '') +
      '<section class="box"><h2>学习量</h2>' + fld('weekly', '每周新词数', stepHTML('weekly')) + fld('days', '每周学几天', stepHTML('days')) +
      fld('addOn', '学完可以「再来一组」', sw('addOn', '学完可以再来一组'), hint('追加的词算进本周，一起考')) + fld('addN', '一组几个', stepHTML('addN')) +
      fld('order', '本周词单顺序', seg('c-order', '本周词单顺序', [['mix', '打乱'], ['lv', '按档从易到难']]), hint('打乱：各档的词、上周错词混在一起，同一周里顺序固定。按档：上周错词在前，新词从 N5 到 N1、常用的在前')) + '</section>' +
      '<section class="box"><h2>各档怎么学 <small>' + LV.map((l, i) => l + ' ' + CN[i]).join(' · ') + '</small></h2>' +
      fld('mode', '学法', seg('c-mode', '学法', [['mix', '按比例混合'], ['step', '逐级'], ['only', '只学某几档']])) +
      '<div class="sub2" id="pMix"><span class="inh" id="i-ratio"></span><div id="lvRows" style="display:flex;flex-direction:column;gap:8px">' +
      LV.map((l, i) => '<div class="lv"><b>' + l + '</b><div class="barr"><i id="bar' + i + '"></i></div><div class="step"><button type="button" data-r="' + i + '" data-dd="-1" aria-label="' + l + ' 减少">−</button><input id="r' + i + '" type="number" min="0" max="100" aria-label="' + l + ' 百分比"><span class="u">%</span><button type="button" data-r="' + i + '" data-dd="1" aria-label="' + l + ' 增加">+</button></div><span class="n" id="rn' + i + '"></span></div>').join('') +
      '</div><div class="sumline" id="ratioSum"><span id="ratioTxt"></span><button type="button" class="gbtn" id="ratioReset">恢复系统初始比例（' + DEF_RATIO.join('/') + '）</button></div><div class="small muted" id="mixWarn" hidden></div></div>' +
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
      '<section class="box"><h2>拼图</h2>' + fld('dim', '回顾测答错时，格子变暗', sw('dim', '答错时格子变暗'), hint('关着＝不变暗，只记进错词本')) + '</section>';
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
  function from(k) { const t = TPL(); if (scope === 'stu' && k in savedTplOv(draft.tpl)) return '方案「' + t[draft.tpl] + '」'; return '全局默认'; }
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
  function syncInputs() { const e = eff(); for (const k in NUM) { const el = $('f-' + k); if (el) el.value = e[k]; } LV.forEach((l, i) => { const el = $('r' + i); if (el) el.value = e.ratio[i]; }); }
  function whoTxt() {
    const t = TPL(), s = stuOf(stuKey);
    const nm = scope === 'global' ? '全局默认' : scope === 'tpl' ? '方案「' + t[tplKey] + '」' : (s ? s.name : '');
    $('who').innerHTML = '正在改：<b>' + esc(nm) + '</b>' + (scope === 'global' ? '（所有学生的起点）' : scope === 'tpl' ? '（用这个方案的学生，共 ' + D.students.filter(x => x.plan === tplKey).length + ' 人）' : '（只影响这一个学生）');
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
    // 全局是按比例混合时：自己设了别的学法的方案不按这里的比例（写一行小字，免得以为所有学生都按这个比例）
    const other = scope === 'global' && e.mode === 'mix' ? D.plans.filter(p => p.ov && MODE[p.ov.mode] && p.ov.mode !== 'mix') : [];
    $('mixWarn').hidden = !other.length;
    $('mixWarn').innerHTML = other.map(p => '方案「' + esc(p.name) + '」用的是' + esc(MODE[p.ov.mode]) + '，不按这里的比例').join('<br>');
    const rs = e.ratio.reduce((a, c) => a + c, 0), per = alloc(e.weekly, e.ratio);
    LV.forEach((l, i) => { $('bar' + i).style.width = Math.min(100, num(e.ratio[i])) + '%'; $('rn' + i).textContent = '约 ' + per[i] + ' 个/周'; });
    $('ratioTxt').textContent = '加起来 ' + rs + '%' + (rs === 100 ? '' : '，要正好 100% 才能保存') + (CNT().slice(1).every(x => !x) ? '。现在只有 N5 有词，其他档的名额先由 N5 补上' : '');
    $('ratioSum').classList.toggle('badsum', rs !== 100);
    const si = Math.max(0, LV.indexOf(e.start));
    $('stepTxt').innerHTML = '<b>' + esc(LV.slice(si).join(' → ')) + '</b>，学完一档自动升下一档；一档最后不够一周时，同一周用下一档补满。' + (si > 0 ? LV.slice(0, si).join('、') + ' 在拼图上直接点亮，标「已掌握」。' : '');
    const skip = LV.filter(l => !(e.only || []).includes(l));
    $('onlyTxt').innerHTML = '只学 <b>' + (esc((e.only || []).join('、')) || '（还没选）') + '</b>' + (skip.length ? '；' + esc(skip.join('、')) + ' 在拼图上直接点亮，标「已掌握」。' : '。');
    // 预览里的数字都先变成数字再显示（设置里万一混进了奇怪的内容，也不会被当成网页代码）
    const wkN = Math.max(1, num(e.weekly, 100)), pa = num(e.pass, 95);
    const err = Math.max(1, Math.round(wkN * .17)), rate = Math.floor((wkN - err) / wkN * 100), passed = rate >= pa, carry = passed ? e.carryPass : e.carryFail;
    let t = '例：' + wkN + ' 个错了 ' + err + ' 个（对了 ' + rate + '%，' + (passed ? '及格' : '没到 ' + pa + '%，不及格') + '），按「' + (passed ? '及格了但有错词' : '没及格时') + '」那一项：';
    if (!carry) t += '错词不带，下周照常学 <b>' + wkN + '</b> 个新词。';
    else if (e.total === 'A') t += '下周学 <b>' + (wkN + err) + '</b> 个（' + err + ' 个错词＋' + wkN + ' 个新词）。';
    else { const k = Math.min(err, wkN); t += '下周还是 <b>' + wkN + '</b> 个（' + k + ' 个错词＋' + (wkN - k) + ' 个新词）。'; }
    $('totalTxt').innerHTML = t;
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
    const at = t.closest('[data-atab]'); if (at) { if (at.dataset.atab === tab || guard()) return; tab = at.dataset.atab; draft = null; render(); return; }
    if (t.closest('[data-a="add"]')) { addModal(); return; }
    const st = t.closest('[data-stu]'); if (st) { detailModal(st.dataset.stu); return; }
    if (tab !== 'cfg') return;
    if (savingCfg) { toast('正在保存，等一下'); return; }
    const sc = t.closest('[data-scope]'); if (sc) { if (sc.dataset.scope === scope || guard()) return; scope = sc.dataset.scope; draft = null; render(); return; }
    if (t.closest('#copyTpl')) { if (guard() || copying) return; copying = true; t.closest('#copyTpl').disabled = true; const nm = (TPL()[tplKey] || '') + ' 副本'; try { tplKey = await rpc('adm_plan_copy', { src: tplKey, nm }); toast('已复制成「' + nm + '」，可以点「改名」'); await reload(); } catch (er) { fail(er); render(); } copying = false; return; }
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
    if (t.closest('#discard')) { loadDraft(); toast('已放弃本次编辑'); return; }
    if (t.closest('#save')) { saveCfg(t.closest('#save')); return; }
  });
  document.addEventListener('change', e => {
    if (!D || $('app').dataset.role !== 'adm' || tab !== 'cfg') return;
    const t = e.target;
    if (savingCfg) { toast('正在保存，等一下'); return; }
    if (t.id === 'pickTpl' || t.id === 'pickStu') { if (guard()) { t.value = t.id === 'pickTpl' ? tplKey : stuKey; return; } if (t.id === 'pickTpl') tplKey = t.value; else stuKey = t.value; draft = null; render(); return; }
    if (!draft) return;
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
