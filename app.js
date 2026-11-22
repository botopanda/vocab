// 单词学习系统 · 公用部分：连数据库、小工具、打开时判断是学生还是管理
const SB_URL = 'https://mycqrrkkltfmyfkbsupp.supabase.co';
const SB_KEY = 'sb_publishable_Dhy_8XpoAWMkXwt5aOuwlQ_CfezzLjs';   // 公开用的大门钥匙，本来就放在网页里；数据靠钥匙链接＋门卫函数保护
const KEY = new URLSearchParams(location.search).get('k') || '';
const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CV = 19;   // 网页版本：打开、开考时告诉数据库；旧网页会被提示刷新（数据库第 28 步起要 18：当场判对错；第 32 步起要 19：方案和申请）

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
  return h;
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
