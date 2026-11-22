// 单词学习系统 · 公用部分：连数据库、小工具、打开时判断是学生还是管理
const SB_URL = 'https://mycqrrkkltfmyfkbsupp.supabase.co';
const SB_KEY = 'sb_publishable_Dhy_8XpoAWMkXwt5aOuwlQ_CfezzLjs';   // 公开用的大门钥匙，本来就放在网页里；数据靠钥匙链接＋门卫函数保护
const KEY = new URLSearchParams(location.search).get('k') || '';
const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CV = 19;   // 网页版本：打开、开考时告诉数据库，太旧的网页会被提示刷新。新版网页是 19（第 32 步起：方案和申请）；数据库（第 28 步起）只要 18 以上就收，第 32、33 步仍收 18，旧学生页不用强制刷新

// 调数据库门卫函数。opt.obj：必须返回一个对象；opt.str：必须返回文字（空的、格式不对都当失败，不拿旧数据凑合）
// opt.timeout：等这么多毫秒还没收到回复就不等了（当作网络断了：服务器可能做了，也可能没做）
async function rpc(fn, args = {}, opt = {}) {
  let r, text = '';
  const ac = opt.timeout && typeof AbortController === 'function' ? new AbortController() : null;
  let late = false;
  const tm = ac ? setTimeout(() => { late = true; ac.abort(); }, opt.timeout) : null;
  const slow = () => { const er = new Error('网络太慢，等了 ' + Math.round(opt.timeout / 1000) + ' 秒没收到回复'); er.net = true; er.timeout = true; return er; };
  try {
    try {
      r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: KEY, ...args }),
        signal: ac ? ac.signal : undefined,
      });
    } catch (e) { if (late) throw slow(); const er = new Error('网络不太稳定，没连上，请稍后再试'); er.net = true; throw er; }
    try { text = await r.text(); } catch (e) { if (late) throw slow(); const er = new Error('网络中断了，没收到回复，请稍后再试'); er.net = true; throw er; }
  } finally { if (tm) clearTimeout(tm); }
  let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) {
    let m = (j && j.message) || '网络出错了，请稍后再试';
    if (/^[\x00-\x7F]+$/.test(m)) m = '操作没成功，请刷新页面后再试（' + m + '）';
    const er = new Error(m); er.status = r.status; throw er;   // status：4xx＝服务器明确拒绝（没做）；5xx、网络断了＝不确定做没做
  }
  if (opt.obj && (!j || typeof j !== 'object' || Array.isArray(j))) throw new Error('没有读到内容，请刷新页面再试');
  if (opt.str && (typeof j !== 'string' || !j)) throw new Error('没有读到内容，请刷新页面再试');
  return j;
}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const KANJI = /\[([^\]]+)\]\{([^}]+)\}|([㐀-鿿豈-﫿々〆ヶ]+)\{([^}]+)\}/g;
const rb = s => esc(s).replace(KANJI, (m, a, b, c, d) => '<ruby>' + (a || c) + '<rt>' + (b || d) + '</rt></ruby>').replace(/«/g, '<mark>').replace(/»/g, '</mark>');
const plain = s => String(s ?? '').replace(KANJI, (m, a, b, c, d) => a || c).replace(/[«»]/g, '');
const md = d => { if (!d) return ''; const x = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d); return (x.getMonth() + 1) + '月' + x.getDate() + '日'; };
const stamp = d => { const x = new Date(d), p = n => String(n).padStart(2, '0'); return p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()); };
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); const p = v => String(v).padStart(2, '0'); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); };
// 东京今天的日期（服务器按东京时间换日、换周）
const tokyoToday = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return ''; } };

// 一个方案「各档怎么学」的一句话（管理端、学生页都用）。lv = {mode, ratio, start, only}；
// opt.short：只要一句短的（加学生的下拉里用）；opt.weekly：按比例时再写每周大约各几个
function lvSplit(total, ratio) {
  const s = ratio.reduce((a, b) => a + b, 0) || 1, raw = ratio.map(r => total * r / s), out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && ratio[i] > 0) { out[i]++; left--; } });
  return out;
}
function lvText(lv, opt = {}) {
  lv = lv || {};
  const m = lv.mode || 'mix';
  if (m === 'step') { const st = LV.includes(lv.start) ? lv.start : 'N5'; return '新词从 ' + st + ' 起按档发' + (opt.short ? '' : '，本档的新词发完了接着发下一档' + (st !== 'N5' ? '（' + LV.slice(0, LV.indexOf(st)).join('、') + ' 不用学）' : '')); }
  if (m === 'only') { const o = LV.filter(l => (lv.only || []).includes(l)); return '新词只从 ' + (o.length ? o.join('、') : '（还没选）') + ' 选' + (opt.short ? '' : '，以前的错词仍会复习'); }
  const r = Array.isArray(lv.ratio) && lv.ratio.length === 5 ? lv.ratio.map(x => Math.max(0, num(x))) : null;
  const used = r ? LV.filter((l, i) => r[i] > 0) : LV;
  let t = '按比例混合 ' + (used.length === 5 ? 'N5～N1' : used.join('、'));
  if (opt.short || !r) return t;
  t += '（' + LV.map((l, i) => r[i] ? l + ' ' + r[i] + '%' : '').filter(Boolean).join(' · ') + '）';
  if (opt.weekly > 0) { const per = lvSplit(opt.weekly, r); t += '；按常规每周新词数 ' + opt.weekly + ' 个估算，大约 ' + LV.map((l, i) => per[i] ? l + ' ' + per[i] : '').filter(Boolean).join('、') + ' 个'; }
  return t;
}

function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 3200); }
function fail(e) { toast(e && e.message ? e.message : '没成功，请再试一次'); }
function busy(btn, on) { if (btn) { btn.disabled = on; } }

// 读音：audio/ja/<编号>.mp3、_1、_2
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const aud = (id, part) => 'audio/ja/' + encodeURIComponent(id) + (part ? '_' + part : '') + '.mp3';
const sayBtn = (src, label) => '<button class="say" type="button" data-audio="' + esc(src) + '" aria-label="' + esc(label) + '">' + SPK + '</button>';
const player = new Audio(); player.preload = 'auto'; let wantSrc = '';
player.addEventListener('error', () => { if (wantSrc) toast(navigator.onLine === false ? '暂时没连上网络，连上后再点喇叭' : '这条读音还没有，过一会儿再试'); });
function stopAudio() { wantSrc = ''; try { player.pause(); } catch (e) {} }
function play(src) {
  try {
    wantSrc = src; player.pause(); player.src = src; player.currentTime = 0;
    const p = player.play();
    if (p && p.catch) p.catch(err => { const n = err && err.name; if (n === 'AbortError' || n === 'NotSupportedError' || wantSrc !== src) return; toast('点一下喇叭就能播放；也看看手机音量'); });
  } catch (e) { toast('点一下喇叭就能播放'); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-audio]'); if (b) { e.stopPropagation(); play(b.dataset.audio); } });

// 一张卡的背面（学习、错词本、管理端都用）
function cardBack(c, opt = {}) {
  let h = '<div class="head"><span class="w" lang="ja">' + esc(c.w) + '</span>' + (c.r !== c.w ? '<span class="r" lang="ja">' + esc(c.r) + '</span>' : '') + sayBtn(aud(c.id), '听单词发音') + (opt.chip || '') + '</div>';
  h += '<div class="mean"><span class="pos">' + esc(c.p) + '</span>' + esc(c.m) + '</div>';
  if (c.trap) h += '<div class="trap"><div class="lab">中日同形词 · 别按中文理解</div><div>' + rb(c.trap) + '</div></div>';
  if (c.rel && c.rel.length) h += '<div class="rel"><div class="lab">有同一个汉字的词</div><div class="relw">' + c.rel.map(x => '<span class="rw' + (x.me ? ' me' : '') + '" title="' + esc(x.m) + '"><b lang="ja">' + esc(x.w) + '</b><span lang="ja">' + esc(x.r) + '</span><i>' + esc(x.m) + '</i></span>').join('') + '</div><div class="small muted">深色的是你学过的</div></div>';
  (c.ex || []).forEach((e, j) => { h += '<div class="ex"><div class="jp" lang="ja">' + rb(e[0]) + '</div>' + sayBtn(aud(c.id, j + 1), '听例句 ' + (j + 1)) + '<div class="zh">' + esc(e[1]) + '</div></div>'; });
  if (c.tip) h += '<div class="tip"><div class="lab">小提示</div><div>' + rb(c.tip) + '</div></div>';
  if (!opt.noEx) h += exBlock(c.id);   // 拓展例句（点了才生成）
  return h;
}

// ── 拓展例句（卡片背面：知识例句、时事例句）──
// 学生点了才取：先给缓存里没看过的，没有就现场生成（走云函数 ex-gen，最多等约 60 秒）。只显示，不评分、不打卡、不写学习记录。
// EX.st：卡号 → {view 现在看哪一类, know/news: {sent, msg} 两类各存各的（迟到的结果不会盖掉另一类）}；EX.seq：卡号 → 最后一次点的序号（决定显示哪一类）
// EX.seen：「卡号|类别」→ 看过的句子编号（刚显示的放最后）；EX.rid：结果不明（超时、断网、服务器出错、还在生成）时留着的请求编号，再点时接着取原结果
// EX.kinds：学生页读取时服务器给的「哪几类开着」（{on, know, news}；旧服务器没有就是 null＝两类都显示）；EX.hide：这次读取以后服务器说「关掉了」的类别；
// EX.kg：类别 → 作废代数（这一类关掉时加一：所有卡片上这一类之前发出、晚回来的结果都不写）；EX.offMsg：类别 → 关掉时的提示
const EX = { st: new Map(), seen: new Map(), busy: new Set(), rid: new Map(), seq: new Map(), kinds: null, hide: new Set(), kg: { know: 0, news: 0 }, offMsg: {} };
const exKinds = () => ['know', 'news'].filter(k => (!EX.kinds || EX.kinds[k]) && !EX.hide.has(k));
// 开关状态变了（学生页读取、同一天的局部重读、服务器说关掉了）：对所有卡片同步——关掉的那一类作废迟到的结果、不再显示旧句和「换一句」；开着的那一类照常
function exSync(before) {
  const now = exKinds();
  for (const k of ['know', 'news']) if (before.includes(k) && !now.includes(k)) {
    EX.kg[k]++;
    for (const key of [...EX.rid.keys()]) if (key.endsWith('|' + k)) EX.rid.delete(key);
  }
  document.querySelectorAll('.xex[id^="ex-"]').forEach(el => exPaint(el.id.slice(3)));
}
function exSetKinds(kinds) { const before = exKinds(); EX.kinds = kinds || null; EX.hide.clear(); EX.offMsg = {}; exSync(before); }
function exOff(kinds, msg) { const before = exKinds(); kinds.forEach(k => { EX.hide.add(k); EX.offMsg[k] = msg; }); exSync(before); }
const uuid4 = () => { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20); };
async function exCall(body, timeout = 60000) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  let late = false; const tm = ac ? setTimeout(() => { late = true; ac.abort(); }, timeout) : null;
  try {
    const r = await fetch(SB_URL + '/functions/v1/ex-gen', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(body), signal: ac ? ac.signal : undefined });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || !j || typeof j !== 'object') { const er = new Error((j && j.msg) || '没成功，请再试一次'); er.status = r.status; throw er; }
    return j;
  } catch (e) {
    if (late) { const er = new Error('等了太久'); er.timeout = true; throw er; }
    if (e && e.status) throw e;
    const er = new Error('网络不太稳定，请再试一次'); er.net = true; throw er;
  } finally { if (tm) clearTimeout(tm); }
}
const EX_MSG = { failed: '这次没生成好，请再点一次', running: '还在生成，过一会儿再点一次', wait: '这个词正在生成，过一会儿再点一次', unknown: '没找到这次的结果，请再点一次', off: '老师暂时关掉了拓展例句', gone: '这句已经不能看了，请再点一次' };
// 这几种结果说明这次请求编号还没有确定的结局（可能还在生成、可能已经花了钱）：留着编号，再点时取原结果，不重新生成
const EX_UNSURE = new Set(['running', 'unknown']);
function exSent(x, wid) {
  const src = x.kind === 'news' && x.url && /^https:\/\//.test(x.url)
    ? ' · <a href="' + esc(x.url) + '" target="_blank" rel="noreferrer noopener">' + esc(x.site || '来源') + (x.date ? ' · ' + esc(md(x.date)) : '') + '</a>' : '';
  return '<div class="xs"><div class="jp" lang="ja">' + rb(x.jp) + '</div><div class="zh">' + esc(x.zh) + '</div>' +
    (x.kind === 'news' && x.title ? '<div class="xt">' + esc(x.title) + '</div>' : '') +
    '<div class="xact"><span class="xtag">' + (x.kind === 'news' ? '时事' : '知识' + (x.sub ? ' · ' + esc(x.sub) : '')) + src + '</span>' +
    '<span class="xbtn2"><button type="button" class="gbtn" data-exk="' + esc(x.kind) + '" data-wid="' + esc(wid) + '">换一句</button>' +
    (x.test ? '' : '<button type="button" class="link" data-exrep="' + esc(x.id) + '">报错</button>') + '</span></div></div>';
}
function exInner(wid) {
  const ks = exKinds(), s = EX.st.get(wid) || {}, busy = k => EX.busy.has(wid + '|' + k), v = s.view, on = !!v && ks.includes(v), cur = on ? (s[v] || {}) : {};
  const btn = (k, n) => '<button type="button" class="gbtn' + (v === k ? ' on' : '') + '" data-exk="' + k + '" data-wid="' + esc(wid) + '"' + (busy(k) ? ' disabled' : '') + '>' + n + '</button>';
  let h = '<div class="lab">拓展例句 <small>点了才生成，不算学习记录</small></div><div class="xbtns">' + ks.map(k => btn(k, k === 'know' ? '知识例句' : '时事例句')).join('') + '</div>';
  if (on && busy(v)) h += '<div class="xwait">正在生成…（最多等一分钟）</div>';
  else if (on && cur.sent) h += exSent(cur.sent, wid);   // 关掉的那一类：不显示旧句、也没有「换一句」
  const msg = !v ? '' : on ? (busy(v) ? '' : cur.msg) : (EX.offMsg[v] || '');
  if (msg) h += '<div class="xmsg">' + esc(msg) + '</div>';
  return h;
}
// 两类都关着（总开关关了、或两类都设成关闭）时不显示拓展例句这一块（这张卡正在看的那一类刚收到「关掉了」提示的除外）
const exBlock = wid => { const s = EX.st.get(wid); return exKinds().length || (s && s.view && EX.offMsg[s.view]) ? '<div class="xex" id="ex-' + esc(wid) + '">' + exInner(wid) + '</div>' : ''; };
function exPaint(wid) { const el = document.getElementById('ex-' + wid); if (el) el.innerHTML = exInner(wid); }
// 点「知识例句」「时事例句」（这一类还没有句子时）或「换一句」（again）：先给没看过的缓存，没有就生成；够数以后从「刚显示的那句」往下循环（A→B→A→B）。
// 两类结果各存各的；迟到的结果只在它还是最后一次点的那一类时才切过去显示
async function exGen(wid, kind, k = KEY, again = false) {
  if (!exKinds().includes(kind)) { exPaint(wid); return; }   // 这一类已经关掉了（页面上残留的按钮）：不请求、不读本机缓存
  const key = wid + '|' + kind;
  const my = (EX.seq.get(wid) || 0) + 1; EX.seq.set(wid, my);
  const st0 = EX.st.get(wid) || {}; st0.view = kind; EX.st.set(wid, st0);
  if (EX.busy.has(key) || (!again && st0[kind] && st0[kind].sent)) { exPaint(wid); return; }   // 正在取，或这一类已经有一句：只切过去看
  EX.busy.add(key); exPaint(wid);
  const kg = EX.kg[kind];
  const seen = EX.seen.get(key) || [], rid = EX.rid.get(key) || uuid4(), old = st0[kind] || {}, cur = old.sent ? old.sent.id : null;
  const body = () => Object.assign({ act: 'gen', k, wid, kind, rid, seen }, cur ? { cur } : {});
  let r = null, msg = '', unsure = false;
  try {
    r = await exCall(body());
    for (let i = 0; i < 10 && r && (r.state === 'wait' || r.state === 'running'); i++) {
      await new Promise(ok => setTimeout(ok, 3000));
      r = await exCall(r.state === 'wait' ? body() : { act: 'poll', k, rid });
    }
    unsure = !!r && EX_UNSURE.has(r.state);
  } catch (e) {
    unsure = !!(e.timeout || e.net || !e.status || e.status >= 500);   // 结果不明：留着编号
    msg = e.timeout ? '等了太久，可能还在生成，过一会儿再点一次' : e.message;
  }
  EX.busy.delete(key);
  if (EX.kg[kind] !== kg) { exPaint(wid); return r; }   // 等待期间这一类被关掉了：这个晚回来的结果作废（不写句子、不写看过）
  if (r && r.state === 'off') {   // 服务器说关掉了（带 kind＝只关这一类；不带＝总开关关了）：这张卡记下提示，所有卡片同步
    EX.rid.delete(key); EX.seen.delete(key);
    const s3 = EX.st.get(wid) || {}; s3[kind] = { sent: null, msg: r.msg || EX_MSG.off }; if (EX.seq.get(wid) === my) s3.view = kind; EX.st.set(wid, s3);
    exOff(r.kind ? [r.kind] : ['know', 'news'], r.msg || EX_MSG.off);
    return r;
  }
  if (unsure) EX.rid.set(key, rid); else EX.rid.delete(key);
  const st = EX.st.get(wid) || {}, res = { sent: old.sent, msg: '' };
  if (r && r.sent) { res.sent = r.sent; res.msg = r.msg || ''; EX.seen.set(key, seen.filter(x => x !== r.sent.id).concat(r.sent.id).slice(-30)); }
  else { res.msg = r ? (r.msg || EX_MSG[r.state] || '没成功，请再点一次') : msg; if (r && r.state === 'gone') res.sent = null; }   // 这句已经不能看了：清掉
  st[kind] = res;
  if (EX.seq.get(wid) === my) st.view = kind;
  EX.st.set(wid, st); exPaint(wid);
  return r;
}
function exReport(sid) {
  const m = modal('<h2>这句例句有问题</h2><form class="form" id="xrf"><label>哪里不对？（可以不写，最多 100 字）<textarea id="xrr" maxlength="100" rows="3"></textarea></label>' +
    '<div class="row"><button type="button" class="btn" data-close>取消</button><button class="btn main" id="xrs">报给老师</button></div></form>');
  m.querySelector('#xrf').addEventListener('submit', async ev => {
    ev.preventDefault(); const b = m.querySelector('#xrs'); if (b.disabled) return; b.disabled = true;
    try { await rpc('stu_ex_report', { sid, reason: m.querySelector('#xrr').value }, { obj: true }); m.close(); toast('已经报给老师了，谢谢'); }
    catch (e) { b.disabled = false; fail(e); }
  });
}

// 弹窗：Esc 或点外面关闭（sticky 时不能点外面关），关了以后焦点回到原来的按钮
function modal(html, opt = {}) {
  const back = document.activeElement;
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>';
  const box = m.firstChild, h2 = box.querySelector('h2');
  if (h2) { h2.id = 'dlg' + Date.now(); box.setAttribute('aria-labelledby', h2.id); }
  const close = () => { if (!m.isConnected) return; m.remove(); if (opt.onClose) opt.onClose(); if (back && back.isConnected && back.focus) try { back.focus(); } catch (e) {} };
  m.close = close;
  m.addEventListener('click', e => { if ((e.target === m && !opt.sticky) || e.target.closest('[data-close]')) close(); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape' && !opt.sticky) { e.stopPropagation(); close(); } });
  document.body.appendChild(m);
  setTimeout(() => { const f = box.querySelector('[data-focus]') || box.querySelector('input,select,textarea,button'); if (f && m.isConnected) try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
  return m;
}
// 确认框：buttons = [[值, 文字, 是否主按钮]]，点了哪个就返回哪个值；关掉返回 null
function ask(title, body, buttons) {
  return new Promise(res => {
    let done = false;
    const m = modal('<h2>' + title + '</h2>' + (body ? '<div class="muted">' + body + '</div>' : '') + '<div class="dlgb">' +
      buttons.map(([v, t, main], i) => '<button type="button" class="btn' + (main ? ' main' : '') + '" data-v="' + esc(v) + '"' + (main ? ' data-focus' : '') + '>' + t + '</button>').join('') + '</div>',
      { sticky: true, onClose: () => { if (!done) { done = true; res(null); } } });
    m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { done = true; res(b.dataset.v); m.close(); } });
  });
}
async function copyText(t, input) {
  try { await navigator.clipboard.writeText(t); toast('已复制'); }
  catch (e) { if (input) { input.select(); toast('请长按选中后复制'); } }
}
const siteBase = () => location.origin + location.pathname;

async function boot() {
  const app = $('app');
  if (!KEY) { app.innerHTML = '<div class="wrap boot">请用老师发给你的专属链接打开。</div>'; return; }
  const retry = '<p><button class="btn" onclick="location.reload()">重新打开</button></p>';
  try {
    const d = await rpc('stu_load', { cv: CV }, { obj: true });
    document.title = '单词学习';
    Stu.start(d);
  } catch (e) {
    if (/没有权限/.test(e.message)) {
      try { const d = await rpc('adm_load', {}, { obj: true }); document.title = '单词系统 · 管理'; Adm.start(d); }
      catch (e2) { app.innerHTML = '<div class="wrap boot">' + esc(e2.message) + retry + '</div>'; }
    } else if (/链接无效|停用/.test(e.message)) {
      app.innerHTML = '<div class="wrap boot">' + esc(e.message) + '<p class="muted">请联系老师重新发一条链接。</p></div>';
    } else {
      app.innerHTML = '<div class="wrap boot">' + esc(e.message) + retry + '</div>';
    }
  }
}
