// 单词学习系统 · 公用部分：连数据库、小工具、打开时判断是学生还是管理
const SB_URL = 'https://mycqrrkkltfmyfkbsupp.supabase.co';
const SB_KEY = 'sb_publishable_Dhy_8XpoAWMkXwt5aOuwlQ_CfezzLjs';   // 公开用的大门钥匙，本来就放在网页里；数据靠钥匙链接＋门卫函数保护
const KEY = new URLSearchParams(location.search).get('k') || '';
const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CV = 20;   // 网页版本：打开、开考、出练习时告诉数据库，太旧的网页会被提示刷新。第 38 步起是 20（能播「听音选意思」的题）；学生页打开（stu_load）仍然 18 以上都收，
                 // 旧学生页不用强制刷新——只有卷子里有听音题时旧页开考才提示刷新，组后小练也只给 20 以上的页面出听音题。
                 // 第 39 步没有升：旧页照样能评「一个月后抽查」的词（只是不标「抽查」）、照样复习本轮和打卡（只是没有每天的目标）
                 // 第 40 步也没有升：打印都在网页上做、不写学习记录；旧页只是没有打印按钮，服务器不用挡旧页

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

function toast(t, ms) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, ms || 3200); }   // ms：长的提示多停一会儿
function fail(e) { toast(e && e.message ? e.message : '没成功，请再试一次'); }
function busy(btn, on) { if (btn) { btn.disabled = on; } }

// 四套界面配色（晴空蓝、竹林青、书卷暖、静夜深）与页签图标（纯图形，不影响按钮文字）
const THEMES = [['sky', '晴空蓝'], ['bamboo', '竹林青'], ['paper', '书卷暖'], ['night', '静夜深']];
const curTheme = () => { const t = document.documentElement.getAttribute('data-theme'); return THEMES.some(([k]) => k === t) ? t : ''; };
function themeBarHTML() {
  const cur = curTheme();
  return '<div class="th-picker" role="group" aria-label="界面配色">' + THEMES.map(([k, nm]) => '<button type="button" class="thdot" data-th="' + k + '" title="配色：' + nm + '" aria-label="配色：' + nm + '" aria-pressed="' + (cur ? cur === k : k === 'sky') + '"></button>').join('') + '</div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-th]'); if (!b) return;
  const th = b.dataset.th; if (!THEMES.some(([k]) => k === th)) return;
  document.documentElement.setAttribute('data-theme', th);
  try { localStorage.setItem('vocab_theme', th); } catch (er) {}
  document.querySelectorAll('[data-th]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.th === th)));
});
const NAV_PATHS = {
  study: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  test: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  drill: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  err: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  map: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  stu: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  ex: '<path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18.4l-2.2-5.8L4 10.7l6.1-1.9z"/>',
  qs: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  wd: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  log: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
};
const navIcon = k => NAV_PATHS[k] ? '<svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + NAV_PATHS[k] + '</svg>' : '';

// 读音：audio/ja/<编号>.mp3、_1、_2
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const aud = (id, part) => 'audio/ja/' + encodeURIComponent(id) + (part ? '_' + part : '') + '.mp3';
const sayBtn = (src, label) => '<button class="say" type="button" data-audio="' + esc(src) + '" aria-label="' + esc(label) + '">' + SPK + '</button>';
// 第 38 步：慢速（0.75 倍，用浏览器的播放速度）、连播几句、重播
const SLOW = 0.75;
const slowBtn = (src, label) => '<button class="say slow" type="button" data-audio="' + esc(src) + '" data-spd="' + SLOW + '" aria-label="' + esc(label) + '">慢</button>';
// 整个页面只有这一个播放器：同一时间只播一个声音。换播别的、点停、被系统打断时，上一条的等待（连播、随身听）都会收到「停了」。
// audGen：每次「从外面」播或停（点喇叭、翻卡、换页……）加一；连播、随身听每一步都核对，变了就说明被别的声音打断了，不再往下播
const player = new Audio(); player.preload = 'auto';
let wantSrc = '', pDone = null, pQuiet = false, pRate = 1, audGen = 0, lastPlay = null;
function markPlaying(src, rate) {
  document.querySelectorAll('.say.is-playing').forEach(b => b.classList.remove('is-playing'));
  if (!src) return;
  document.querySelectorAll('.say[data-audio]').forEach(b => {
    const br = Number(b.dataset.spd) > 0 ? Number(b.dataset.spd) : 1;
    if (b.dataset.audio === src && Math.abs(br - (rate || 1)) < 0.05) b.classList.add('is-playing');
  });
}
const pSettle = v => { markPlaying(''); const f = pDone; pDone = null; if (f) f(v); };
player.addEventListener('ended', () => pSettle('end'));
player.addEventListener('error', () => { if (!wantSrc) return; if (!pQuiet) toast(navigator.onLine === false ? '暂时没连上网络，连上后再点喇叭' : '这条读音还没有，过一会儿再试'); pSettle('err'); });
// 系统把声音停了（来电、别的应用放声音、拔耳机等）：当成被打断（自己换下一条时 play() 已经把 paused 改回 false，不会误判；正常播完 ended 是真的）
player.addEventListener('pause', () => { if (wantSrc && player.paused && !player.ended) pSettle('stop'); });
player.addEventListener('playing', () => { try { if (player.playbackRate !== pRate) player.playbackRate = pRate; } catch (e) {} });   // 有的浏览器换了读音会把速度改回 1
function stopAudio() { audGen++; wantSrc = ''; pSettle('stop'); try { player.pause(); } catch (e) {} }
// 播一条（内部用，不算「从外面」打断）：返回 Promise——播完 'end'、读音没有或出错 'err'、被打断 'stop'、浏览器不让播（要先点一下）'block'。
// opt.rate 速度（1＝正常，0.75＝慢）；opt.quiet 出错不弹提示（连播、随身听自己处理）
function playStep(src, opt) {
  opt = opt || {};
  pSettle('stop');
  return new Promise(res => {
    pDone = res; pQuiet = !!opt.quiet; pRate = opt.rate > 0 ? opt.rate : 1;
    try {
      wantSrc = src; player.pause(); player.src = src;
      markPlaying(src, pRate);
      try { player.defaultPlaybackRate = pRate; player.playbackRate = pRate; } catch (e) {}
      try { player.currentTime = 0; } catch (e) {}
      const p = player.play();
      if (p && p.catch) p.catch(err => {
        const n = err && err.name;
        if (wantSrc !== src || pDone !== res || n === 'AbortError' || n === 'NotSupportedError') return;   // 已经换成别的了；读音没有的由上面的 error 处理
        if (!pQuiet) toast('点一下喇叭就能播放；也看看手机音量');
        pSettle(n === 'NotAllowedError' ? 'block' : 'err');
      });
    } catch (e) { if (!pQuiet) toast('点一下喇叭就能播放'); pSettle('err'); }
  });
}
// 从外面播一条（点喇叭、翻卡自动读、听音题自动播）：打断正在播的（连播、随身听也停下）
function play(src, opt) { audGen++; lastPlay = { srcs: [src], rate: (opt && opt.rate) || 1 }; return playStep(src, opt); }
// 连着播几条（中间停 0.5 秒）：被别的声音、换页打断就不再往下播
async function playSeq(srcs, opt) {
  opt = opt || {};
  const my = ++audGen;
  lastPlay = { srcs: srcs.slice(), rate: opt.rate || 1 };
  for (let i = 0; i < srcs.length; i++) {
    if (i) { await new Promise(ok => setTimeout(ok, 500)); if (my !== audGen) return 'stop'; }
    const r = await playStep(srcs[i], { rate: opt.rate, quiet: true });
    if (my !== audGen || r === 'stop' || r === 'block') { if (r === 'block' && my === audGen) toast('点一下喇叭就能播放；也看看手机音量'); return r === 'block' ? r : 'stop'; }
    if (r === 'err') toast('第 ' + (i + 1) + ' 句的读音还没有，跳过了');
  }
  return 'end';
}
// 重播：这张卡上次播的（单句、连播都照原来的速度）；这张卡还没播过就播单词
const audId = s => { const m = /audio\/ja\/([^/_]+?)(?:_\d+)?\.mp3$/.exec(String(s || '')); return m ? decodeURIComponent(m[1]) : ''; };
function replay(id) {
  const lp = lastPlay && lastPlay.srcs.length && (!id || audId(lastPlay.srcs[0]) === id) ? lastPlay : null;
  if (!lp) return play(aud(id));
  return lp.srcs.length > 1 ? playSeq(lp.srcs, { rate: lp.rate }) : play(lp.srcs[0], { rate: lp.rate });
}
const audioGen = () => audGen;
// 手机浏览器要用户先点一下才肯出声：在「开始刷题」「随身听」这类按钮的点击里先让播放器空播一下（之后自动播放才不会被拦）。正在播就不用
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let unlocked = false;
function unlockAudio() { if (unlocked || wantSrc) return; unlocked = true; try { player.src = SILENT; const p = player.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-audio],[data-seq],[data-replay]'); if (!b) return;
  e.stopPropagation();
  const rate = Number(b.dataset.spd) > 0 ? Number(b.dataset.spd) : 1;
  if (b.dataset.audio) play(b.dataset.audio, { rate });
  else if (b.dataset.seq) playSeq(b.dataset.seq.split(' ').filter(Boolean), { rate });
  else replay(b.dataset.replay);
});

// 一张卡的背面（学习、错词本、管理端都用）
function cardBack(c, opt = {}) {
  let h = '<div class="head"><span class="w" lang="ja">' + esc(c.w) + '</span>' + (c.r !== c.w ? '<span class="r" lang="ja">' + esc(c.r) + '</span>' : '') + sayBtn(aud(c.id), '听单词发音') + (opt.chip || '') + '</div>';
  h += '<div class="mean"><span class="pos">' + esc(c.p) + '</span>' + esc(c.m) + '</div>';
  if (c.trap) h += '<div class="trap"><div class="lab">中日同形词 · 别按中文理解</div><div>' + rb(c.trap) + '</div></div>';
  if (c.rel && c.rel.length) h += '<div class="rel"><div class="lab">有同一个汉字的词</div><div class="relw">' + c.rel.map(x => '<span class="rw' + (x.me ? ' me' : '') + '" title="' + esc(x.m) + '"><b lang="ja">' + esc(x.w) + '</b><span lang="ja">' + esc(x.r) + '</span><i>' + esc(x.m) + '</i></span>').join('') + '</div><div class="small muted">深色的是你学过的</div></div>';
  // 每个例句旁边：喇叭（点一次播一次＝重播）、「慢」（0.75 倍）；例句下面：连播两句、慢速连播、重播（这张卡上次播的，照原来的速度）
  (c.ex || []).forEach((e, j) => { h += '<div class="ex"><div class="jp" lang="ja">' + rb(e[0]) + '</div><div class="exb">' + sayBtn(aud(c.id, j + 1), '听例句 ' + (j + 1)) + slowBtn(aud(c.id, j + 1), '慢速听例句 ' + (j + 1)) + '</div><div class="zh">' + esc(e[1]) + '</div></div>'; });
  if ((c.ex || []).length) {
    const ss = c.ex.map((e, j) => aud(c.id, j + 1)).join(' '), nn = c.ex.length === 2 ? '两' : c.ex.length;
    h += '<div class="exa">' + (c.ex.length > 1 ? '<button type="button" class="gbtn" data-seq="' + esc(ss) + '">连播' + nn + '句</button><button type="button" class="gbtn" data-seq="' + esc(ss) + '" data-spd="' + SLOW + '">慢速连播</button>' : '') +
      '<button type="button" class="gbtn" data-replay="' + esc(c.id) + '" aria-label="重播这张卡上次播的读音">重播</button></div>';
  }
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

// ── 第 40 步：打印词单（学生端、管理端共用）。用浏览器打印，不生成 PDF 文件；这里不改学习记录 ──
// info＝{title 纸上写的哪一份（本周的词（第 3 周）／错词本…）, who 学生名字, words [{id, w, r, p, m, ex [[日文例句, 中文], …]}], exOk 有没有例句可以印, exWhy 没有的原因,
//        note 对话框里多说一句（停用的没印等）, check 学生端：真的要印之前和服务器核对一次（这周开了考还没交卷等），返回 Promise<{ok, msg}>；管理端没有}
// 版式：默写纸（只印中文、词性，写法、读音两栏空着；后面自动附答案页）／日文表（写法、读音、中文都印）。选项：打乱顺序、每页最多几行、带不带例句（只印第 1 个例句）。
// 复查第 1 轮后：
//   · 真正打印时另开一个空白页（地址是 about:blank，没有学生、老师的钥匙），只把排好版要用的文字传过去，在那一页里重新排版再打印——
//     浏览器在纸上印页眉页脚（网址、标题）时也印不出钥匙。本页上的预览只给人看；本页被浏览器菜单直接打印时只印一句提示。
//   · 「每页几行」是上限：按实际内容排，一行字多就提前换页，纸上不裁字（答案页按同样的题号另外排）。
//   · 纸上留页边距（@page 上下 11mm、左右 12mm），内容 184×270mm：浏览器不认 @page、用自己默认的页边距（一般不超过 12.7mm）也放得下，
//     打开页眉页脚时印在页边距里，一张纸不会被挤成两张。
//   · 学生端开着打印对话框或预览时离开这一页再回来：先遮住，和服务器核对过（没开考）再显示；点「打印预览」「打印」时也各核对一次。
// 复查第 2 轮后：
//   · 学生的打印页只用一次：系统打印结束或取消（afterprint）以后就清掉纸面，再印要回原来的页面点「打印」（会再核对一次）；
//     自动打印没弹出来的浏览器，打印页上的「打印」按钮可以点一次。管理端的打印页不清（老师常要多印几份、存 PDF；管理端打印不受开考限制，没有要核对的）。
//   · 打开打印页以后马上断开它和本页的联系（opener），再把它换成一个新的空白页（直接打开的空白页，document.referrer 是本页带钥匙的地址；
//     本页设了 no-referrer，换过去的新空白页就没有来源网址）；打印页加载字体前也写明不带来源网址（no-referrer）。
//   · 本页（地址带钥匙）被浏览器菜单直接打印：不管开没开预览都只印一句提示，页边距 0（Chrome 默认设置下页眉页脚没有地方印网址），见 style.css。
const PRT_MAX = 500, PRT_KEY = 'vocab_prt', PRT_ROWS = [10, 15, 20, 25, 30], PRT_ROWS_EX = [6, 8, 10, 12];
function prtGet() {
  let o = {}; try { const v = JSON.parse(localStorage.getItem(PRT_KEY) || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) o = v; } catch (e) {}
  return { kind: o.kind === 'tbl' ? 'tbl' : 'dict', shuf: o.shuf === true, ex: o.ex === true, rows: PRT_ROWS.includes(o.rows) ? o.rows : 20, rowsEx: PRT_ROWS_EX.includes(o.rowsEx) ? o.rowsEx : 8 };
}
function prtPut(o) { try { localStorage.setItem(PRT_KEY, JSON.stringify(o)); } catch (e) {} }
const prtCredit = () => { const t = ((document.querySelector('footer.credit') || {}).textContent || '').split('｜')[0].trim(); return t || '词表：以 Jonathan Waller 整理的 JLPT 词表（tanos.co.uk，CC BY）为底本，本站做了删改和补充'; };
const prtEx = x => Array.isArray(x.ex) && Array.isArray(x.ex[0]) && x.ex[0][0] ? x.ex[0] : null;
// 纸面的样式：本页的预览和另开的打印页共用这一份（打印页里没有本站的 style.css）
const PRT_FONT_URL = 'https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@600&family=Noto+Sans+JP:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap';
const PRT_CSS = (() => {
  const SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif', JP = '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif', MIN = '"Zen Old Mincho","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  return '.pg{width:184mm;height:270mm;padding:0;box-sizing:border-box;background:#fff;color:#111;display:flex;flex-direction:column;overflow:hidden;font-family:' + SANS + ';font-size:10.5pt;line-height:1.35;color-scheme:light;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pg *{box-sizing:border-box}' +
    '.pgh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:1.5mm 6mm;padding-bottom:2.5mm;border-bottom:.5mm solid #111;flex:none}.pgh b{font-size:14pt;font-weight:700}' +
    '.pgs{font-size:9pt;color:#444}.pgl{flex-basis:100%;font-size:10pt;color:#222}' +
    '.pgb{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}' +
    '.pr{display:grid;grid-template-columns:9mm minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);border-bottom:.25mm solid #999;flex:none}' +
    '.pg-tbl .pr{grid-template-columns:9mm minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr)}.pr.pr2{grid-template-rows:auto minmax(0,1fr)}' +
    '.pr.ph{font-size:8.5pt;color:#555;border-bottom:.35mm solid #333}.pr.ph .pc{padding-block:1mm}' +
    '.pn{font-size:8.5pt;color:#666;padding:1.4mm 1mm 0 0;text-align:right;font-variant-numeric:tabular-nums}' +
    '.pc{padding:1.2mm 2mm;min-width:0;border-left:.2mm solid #ccc;overflow-wrap:anywhere}' +
    '.pm{font-size:10.5pt}.pp{font-size:7.5pt;color:#666;margin-left:2mm;white-space:nowrap}' +
    '.pj{font-family:' + MIN + ';font-size:14pt;font-weight:600;line-height:1.25}.pk{font-family:' + JP + ';font-size:10.5pt}.pna{font-size:8pt;color:#999}' +
    '.pex{font-family:' + JP + ';font-size:8.5pt;line-height:1.9;color:#222}.pg ruby{ruby-align:start}.pg ruby rt{font-size:.55em;color:#555;font-weight:400}' +
    '.pg mark{background:none;color:inherit;font-weight:700;text-decoration:underline;padding:0;border-radius:0}' +
    '.pz{font-size:8pt;color:#555}.px{grid-column:2 / -1;padding:0 2mm .8mm;display:flex;flex-wrap:wrap;gap:0 3mm;align-items:baseline;min-width:0;border-left:.2mm solid #ccc;overflow-wrap:anywhere}' +
    '.pblank{letter-spacing:.1em;color:#111}' +
    '.pgf{display:flex;justify-content:space-between;gap:6mm;font-size:7pt;color:#666;padding-top:2mm;border-top:.25mm solid #999;flex:none}.pgf span:last-child{white-space:nowrap}';
})();
try { const st = document.createElement('style'); st.id = 'prtcss'; st.textContent = PRT_CSS; document.head.appendChild(st); } catch (e) {}
// 排版：按 M 一行一行放进 A4 页里——一页最多 M.per 行；放进一行以后这一页装不下了（字多的行比较高），这一行就挪到下一页（每页第一行总能放下）。
// 每一行至少有「一页的高度÷per」高（行少的页也是同样的行高，好写字）。答案页按同样的顺序、同样的题号另外排。只用参数，不用外面的东西：打印页里也原样用它。
// M＝{kinds [[k, 名字]], rows {k: [一行的 html]}, per, total, title, who, when, credit, ex}；返回页数
function prtPaginate(doc, root, M) {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HD = { dict: ['', '中文', '写法', '读音'], ans: ['', '中文', '写法', '读音'], tbl: ['', '写法', '读音', '中文'] };
  root.innerHTML = '';
  const made = [];
  for (const [k, nm] of M.kinds) {
    const list = (M.rows && M.rows[k]) || [];
    let i = 0;
    while (i < list.length) {
      const pg = doc.createElement('section');
      pg.className = 'pg pg-' + k + (M.ex ? ' pg-ex' : '');
      pg.innerHTML = '<header class="pgh"><div><b>' + E(nm) + '</b>　' + E(M.title) + '</div><div class="pgs">' + (M.who ? E(M.who) + '　' : '') + E(M.when) + '</div>' +
        (k === 'dict' ? '<div class="pgl">姓名＿＿＿＿＿＿　日期＿＿＿＿＿　对了＿＿＿／' + E(M.total) + '</div>' : k === 'ans' ? '<div class="pgl">答案（第 <span class="pga"></span> 个）</div>' : '') +
        '</header><div class="pgb"><div class="pr ph">' + HD[k].map(t => '<div class="pc">' + t + '</div>').join('') + '</div></div><footer class="pgf"><span>' + E(M.credit) + '</span><span class="pgn"></span></footer>';
      root.appendChild(pg);
      const body = pg.querySelector('.pgb'), mh = Math.max(0, Math.floor((body.clientHeight - body.firstElementChild.offsetHeight) / M.per) - 1);
      const a = i;
      while (i < list.length && i - a < M.per) {
        body.insertAdjacentHTML('beforeend', list[i]);
        const r = body.lastElementChild; r.style.minHeight = mh + 'px';
        if (i > a && body.scrollHeight > body.clientHeight + 1) { r.remove(); break; }   // 这一页装不下了：这一行挪到下一页
        i++;
      }
      const ga = pg.querySelector('.pga'); if (ga) ga.textContent = (a + 1) + '～' + i;
      made.push(pg);
    }
  }
  made.forEach((pg, j) => { pg.querySelector('.pgn').textContent = '第 ' + (j + 1) + ' / ' + made.length + ' 页'; });
  return made.length;
}
// 页码范围：一共 n 页，前 nd 页是题纸（默写纸）。日文表 nd＝0。打印页里也原样用它
function prtRange(n, nd) {
  const r = (a, b) => a === b ? '第 ' + a + ' 页' : '第 ' + a + '～' + b + ' 页';
  return nd > 0 && nd < n ? '共 ' + n + ' 页：题纸' + r(1, nd) + '，答案' + r(nd + 1, n) : '共 ' + n + ' 页';
}
// 等字体（最多等 ms 毫秒）：先放一点要用到的字（让浏览器开始下载字体），等好了再排版（字体换了，每行的高度会变）
async function prtFonts(doc, root, ms) {
  try {
    const s = doc.createElement('div'); s.className = 'pg'; s.style.cssText = 'position:absolute;left:-9999px;top:0;height:auto;visibility:hidden';
    s.innerHTML = '<span class="pj">漢字かな</span><span class="pk">かな</span><span class="pex">例文</span>中文'; (root || doc.body).appendChild(s);
    void s.offsetHeight;
    if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, new Promise(ok => setTimeout(ok, ms))]);
    s.remove();
  } catch (e) {}
}
// 默写纸上的例句：这个词（«» 标的那一段）挖空
const prtBlank = s => rb(String(s || '').replace(/«[^«»]*»/g, '\u0001')).replace(/\u0001/g, '<span class="pblank">（　　　）</span>');
// 排版要用的东西（打印页只拿到这些文字，没有钥匙）：打乱只在这里做一次，默写纸和答案页同一个顺序
function prtModel(info, words, o) {
  const list = words.slice();
  if (o.shuf) for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const day = tokyoToday(), rows = {};
  const kinds = o.kind === 'dict' ? [['dict', '默写纸'], ['ans', '答案']] : [['tbl', '日文表']];
  const row = (k, x, n) => {
    const e = o.ex ? prtEx(x) : null, kana = x.w === x.r, mean = '<div class="pm">' + esc(x.m) + (x.p ? '<span class="pp">' + esc(x.p) + '</span>' : '') + '</div>';
    if (k === 'dict') return '<div class="pr"><div class="pn">' + n + '</div><div class="pc">' + mean + (e ? '<div class="pex" lang="ja">' + prtBlank(e[0]) + '</div><div class="pz">' + esc(e[1]) + '</div>' : '') + '</div>' +
      '<div class="pc pw">' + (kana ? '<span class="pna">（只写读音）</span>' : '') + '</div><div class="pc pw"></div></div>';
    const exl = e ? '<div class="px"><span class="pex" lang="ja">' + rb(e[0]) + '</span><span class="pz">' + esc(e[1]) + '</span></div>' : '';
    const pr = '<div class="pr' + (e ? ' pr2' : '') + '"><div class="pn">' + n + '</div>';   // pr2：下面还有一行例句
    if (k === 'ans') return pr + '<div class="pc">' + mean + '</div><div class="pc pj" lang="ja">' + esc(x.w) + '</div><div class="pc pk" lang="ja">' + esc(x.r) + '</div>' + exl + '</div>';
    return pr + '<div class="pc pj" lang="ja">' + esc(x.w) + '</div><div class="pc pk" lang="ja">' + (kana ? '—' : esc(x.r)) + '</div><div class="pc">' + mean + '</div>' + exl + '</div>';
  };
  for (const [k] of kinds) rows[k] = list.map((x, i) => row(k, x, i + 1));
  return { kinds, rows, per: o.ex ? o.rowsEx : o.rows, total: list.length, title: info.title, who: info.who || '', when: day ? md(day) + '打印' : '', credit: prtCredit(), ex: !!o.ex };
}
// 打印前和服务器核对一次（学生端才有）：核对不了（断网等）也当不能印
async function prtCheck(info) {
  if (!info.check) return { ok: true };
  try { const r = await info.check(); return r && r.ok ? { ok: true } : { ok: false, msg: (r && r.msg) || '现在不能打印' }; }
  catch (e) { return { ok: false, msg: '没和服务器核对上（' + e.message + '），过一会儿再点' }; }
}
// 开着对话框、预览时离开这一页又回来：先遮住（hold），核对过再显示；核对不过就关掉（fail）。返回「不再管」的函数
function prtGuard(info, hold, show, fail) {
  if (!info.check) return () => {};
  let away = false, seq = 0;
  const back = async () => {
    const my = ++seq; hold();
    const r = await prtCheck(info);
    if (my !== seq) return;
    if (r.ok) show(); else fail(r.msg);
  };
  const vis = () => { if (document.visibilityState === 'hidden') away = true; else if (away) { away = false; back(); } };
  const ps = e => { if (e.persisted) back(); };
  document.addEventListener('visibilitychange', vis); window.addEventListener('pageshow', ps);
  return () => { seq++; document.removeEventListener('visibilitychange', vis); window.removeEventListener('pageshow', ps); };
}
// 打印选项对话框：选好以后点「打印预览」
function printDialog(info) {
  if (document.getElementById('prt')) return;   // 预览已经开着
  document.querySelectorAll('.modal.prtd').forEach(x => x.close ? x.close() : x.remove());
  const all = (info.words || []).filter(x => x && x.w), words = all.slice(0, PRT_MAX);
  if (!words.length) { toast('这里没有可以打印的词'); return; }
  const exOk = !!info.exOk && words.some(prtEx), o = prtGet();
  const segRows = () => (o.ex && exOk ? PRT_ROWS_EX : PRT_ROWS).map(n => '<button type="button" data-prow="' + n + '" aria-pressed="' + ((o.ex && exOk ? o.rowsEx : o.rows) === n) + '">' + n + '</button>').join('');
  let unguard = () => {};
  const m = modal('<h2>打印：' + esc(info.title) + '</h2>' +
    '<div class="muted">' + (info.who ? esc(info.who) + ' · ' : '') + '一共 ' + words.length + ' 个词' + (all.length > words.length ? '（一次最多 ' + PRT_MAX + ' 个，只印前 ' + PRT_MAX + ' 个）' : '') + (info.note ? '。' + esc(info.note) : '') + '。只是打印，不算学习记录。</div>' +
    '<div class="prf"><span class="lab">版式</span><div class="seg" role="group" aria-label="版式"><button type="button" data-pkind="dict" aria-pressed="' + (o.kind === 'dict') + '">默写纸＋答案页</button><button type="button" data-pkind="tbl" aria-pressed="' + (o.kind === 'tbl') + '">日文表</button></div></div>' +
    '<div class="small muted" id="prkd"></div>' +
    '<div class="prf"><span class="lab">每页最多</span><div class="seg" role="group" aria-label="每页最多几行" id="prows">' + segRows() + '</div><span class="small muted">行</span></div>' +
    '<div class="checks"><button type="button" class="ck" data-pshuf aria-pressed="' + o.shuf + '">打乱顺序</button>' +
    '<button type="button" class="ck" data-pex aria-pressed="' + (o.ex && exOk) + '"' + (exOk ? '' : ' disabled') + '>带例句</button></div>' +
    '<div class="small muted">' + (exOk ? '带例句：每个词印第 1 个例句（默写纸上把这个词挖空）。字多的行比较高，那一页就少放几行。' : esc(info.exWhy || '这一份没有例句可以印。')) + '</div>' +
    '<div class="small muted">点「打印预览」看一下，再点「打印」（会另开一页来打印，纸上不会印出你的专属链接；手机上也可以选「存成 PDF」）。' + (info.check ? '另开的打印页只能印一次（印完或取消就清掉），要再印回这里再点「打印」。' : '') + '在微信里打不开打印的话，先点右上角用浏览器打开。</div>' +
    '<div class="row"><button type="button" class="btn" data-close>取消</button><button type="button" class="btn main" data-pgo>打印预览</button></div>', { onClose: () => unguard() });
  m.classList.add('prtd');
  const kd = () => { const el = m.querySelector('#prkd'); if (el) el.textContent = o.kind === 'dict' ? '默写纸：只印中文（和词性），写法、读音两栏空着；后面自动附答案页（答案单独成页，可以不打那几页）。' : '日文表：写法、读音、中文都印出来，可以当词单看。'; };
  kd();
  const go = m.querySelector('[data-pgo]');
  let checking = false;
  // 离开这一页又回来：先把「打印预览」灰掉，核对过再放开；核对不过就关掉对话框
  unguard = prtGuard(info, () => { checking = true; go.disabled = true; }, () => { checking = false; go.disabled = false; }, msg => { m.close(); toast(msg); if (info.onBlock) info.onBlock(); });
  m.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.pkind) { o.kind = b.dataset.pkind; m.querySelectorAll('[data-pkind]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); kd(); return; }
    if (b.dataset.prow) { if (o.ex && exOk) o.rowsEx = +b.dataset.prow; else o.rows = +b.dataset.prow; m.querySelector('#prows').innerHTML = segRows(); return; }
    if (b.hasAttribute('data-pshuf')) { o.shuf = !o.shuf; b.setAttribute('aria-pressed', String(o.shuf)); return; }
    if (b.hasAttribute('data-pex')) { o.ex = !o.ex; b.setAttribute('aria-pressed', String(o.ex)); m.querySelector('#prows').innerHTML = segRows(); return; }
    if (b.hasAttribute('data-pgo')) {
      if (checking) return;
      checking = true; go.disabled = true;
      const r = await prtCheck(info);   // 学生端：真的要看到答案以前和服务器核对一次
      checking = false;
      if (!m.isConnected) return;
      if (!r.ok) { m.close(); toast(r.msg); if (info.onBlock) info.onBlock(); return; }
      prtPut(o); m.close(); printPreview(info, words, Object.assign({}, o, { ex: o.ex && exOk }));
    }
  });
}
// 打印页（另开的空白页，地址一直是 about:blank）：自己的样式、自己排版，好了自动打印一次；上面一条写页码范围、「打印」「关闭」（打印时不印）。
// 不用 document.write／document.open：它们会把新页的地址改成本页的地址（带着钥匙，浏览器印页眉页脚时会印出来）；这里只往空白页里放元素、放一段脚本。
// M.once（学生端）：只印一次——系统打印结束或取消（afterprint）就清掉纸面；页面上的「打印」按钮只能点一次
//   （给自动打印没弹出来的浏览器）；离开这一页再回来也清掉。要再印，回原来的页面点「打印」（会再核对一次）。管理端（不是 once）都不清
const prtJson = v => JSON.stringify(v).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');   // 放进 <script> 里也安全
const PRT_PAGE_CSS = 'html,body{margin:0;background:#5B6270}body{font-family:sans-serif}.bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;padding:8px 12px;background:#fff;border-bottom:1px solid #ccc;font-size:14px;color:#222}' +
  '.bar button{font:inherit;padding:8px 14px;border-radius:10px;border:1px solid #ccc;background:#fff;cursor:pointer}.bar .go{background:#2C4A7A;color:#fff;border-color:transparent}.bar .go:disabled{opacity:.5}.bar span{flex:1}' +
  '#pages{padding:calc(12mm + 8px) 0;display:flex;flex-direction:column;align-items:center;gap:calc(24mm + 12px)}#pages .pg{box-shadow:0 0 0 12mm #fff,0 1px 6px 12mm rgba(0,0,0,.3)}' +
  '.wait{color:#fff;padding:24px;font-size:15px}.gone{background:#fff;padding:24px;font-size:15px;line-height:1.7}' +
  '@media print{@page{size:A4 portrait;margin:11mm 12mm}html,body{background:#fff}.bar,.wait{display:none!important}#pages{padding:0;gap:0;display:block}#pages .pg{box-shadow:none;break-after:page;page-break-after:always}#pages .pg:last-child{break-after:auto;page-break-after:auto}}';
// 往空白页里放东西：head（不带来源网址、标题、手机宽度、字体、样式）、body（上面一条、排版的地方），最后放一段脚本（在那一页里排版、打印）。M 为空时只放一句「正在准备打印」
function prtWrite(w, M) {
  const d = w.document, root = d.documentElement || d.appendChild(d.createElement('html'));
  const head = d.head || root.insertBefore(d.createElement('head'), root.firstChild), body = d.body || root.appendChild(d.createElement('body'));
  root.lang = 'zh-CN'; root.setAttribute('data-prt', '1'); head.innerHTML = ''; d.title = M ? M.title : '正在准备打印';
  const add = (tag, at) => { const e = d.createElement(tag); Object.keys(at).forEach(k => e.setAttribute(k, at[k])); head.appendChild(e); return e; };
  add('meta', { name: 'referrer', content: 'no-referrer' });   // 在加载字体以前：请求字体时不带来源网址
  add('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
  if (!M) { body.innerHTML = '<p style="font:16px sans-serif;padding:24px">正在准备打印……</p>'; return; }
  add('link', { rel: 'stylesheet', href: PRT_FONT_URL, referrerpolicy: 'no-referrer' });
  add('style', {}).textContent = PRT_CSS + PRT_PAGE_CSS;
  body.innerHTML = '<div class="bar"><span id="rng">打印用的页面（打印完可以关掉）</span><button type="button" class="go" id="go" disabled>打印</button><button type="button" id="cl">关闭</button></div><div class="wait" id="wait">正在排版……</div><div id="pages"></div>';
  const sc = d.createElement('script');
  sc.textContent = '(function () {' +
    'var M = ' + prtJson(M) + ';var paginate = ' + prtPaginate.toString() + ';var fonts = ' + prtFonts.toString() + ';var range = ' + prtRange.toString() + ';' +
    'var go = document.getElementById("go"), away = false, done = false, inPrint = false, clicked = false;' +
    // 清掉纸面（学生端：印过一次、离开又回来）：以后这一页印不出词了
    'function wipe() { if (done) return; done = true; window.__prtDone = true; document.body.innerHTML = "<div class=\\"gone\\">这一页已经印过（或者离开过），纸面已经清掉。要再打印，请回原来的页面再点一次「打印」。<br><button type=\\"button\\" onclick=\\"window.close()\\">关闭这一页</button></div>"; }' +
    'function ended() { if (inPrint) { inPrint = false; if (M.once) wipe(); } }' +
    'window.addEventListener("beforeprint", function () { inPrint = true; });' +
    'window.addEventListener("afterprint", ended);' +
    'document.getElementById("cl").onclick = function () { window.close(); };' +
    'go.onclick = function () { if (done || (M.once && clicked)) return; if (M.once) { clicked = true; go.disabled = true; go.textContent = "已经点过打印"; } try { window.print(); } catch (e) {} };' +
    'document.addEventListener("visibilitychange", function () { if (!M.once) return; if (document.visibilityState === "hidden") away = true; else if (away) wipe(); });' +
    'function lay() { var pg = document.getElementById("pages"); if (!pg || done) return; var n = paginate(document, pg, M); window.prtPages = n; var rg = document.getElementById("rng"); if (rg) rg.textContent = range(n, pg.querySelectorAll(".pg-dict").length) + (M.once ? "（学生打印页只能印一次）" : ""); }' +
    'fonts(document, document.getElementById("pages"), 3000).then(function () { if (done) return; lay(); var wt = document.getElementById("wait"); if (wt) wt.remove(); go.disabled = false; window.prtReady = true; setTimeout(function () { if (!done) try { window.print(); } catch (e) {} }, 60);' +
    ' if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(lay); });' +   // 字体后来才到：重新排一次
    '})();';
  body.appendChild(sc);
}
// 等打印页换成新的空白页（最多等 ms 毫秒；没换成也接着用原来那一页，见下面 0.5 秒的补放）
async function prtFresh(w, d0, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (w.closed) return; const d = w.document; if (d && d !== d0 && d.readyState === 'complete') return; } catch (e) {}
    await new Promise(ok => setTimeout(ok, 30));
  }
}
// 本页上的打印预览：盖住整个页面（手机上按宽度缩小显示），上面一条「返回」「打印」
async function printPreview(info, words, o) {
  if (document.getElementById('prt')) return;
  const back = document.activeElement, M = Object.assign(prtModel(info, words, o), { once: !!info.check });   // 学生端（要核对的）打印页只印一次
  const ov = document.createElement('div');
  ov.id = 'prt'; ov.className = 'modal prtv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '打印预览');
  ov.innerHTML = '<div class="prtbar"><button type="button" class="btn" data-pclose>返回</button><div class="prtinfo"><b>打印预览</b> <span id="prtn">正在排版……</span><small>A4 竖着打；点「打印」会另开一页来打印，纸上不会印出你的专属链接</small></div><button type="button" class="btn main" data-pprint disabled>打印</button></div>' +
    '<div class="prthold" hidden>正在核对……</div><div class="prtwrap"><div class="prtsz"><div class="prtpages"></div></div></div>';
  document.body.appendChild(ov);
  document.documentElement.classList.add('prt-on');
  const pp = ov.querySelector('.prtpages'), pb = ov.querySelector('[data-pprint]');
  const fit = () => {
    const wrap = ov.querySelector('.prtwrap'), sz = ov.querySelector('.prtsz'); if (!wrap || !pp.firstElementChild) return;
    const pw = pp.offsetWidth, ph = pp.offsetHeight, s = Math.min(1, Math.max(0.2, (wrap.clientWidth - 16) / (pw || 1)));
    pp.style.transform = 'scale(' + s + ')'; sz.style.width = Math.floor(pw * s) + 'px'; sz.style.height = Math.ceil(ph * s) + 'px';
  };
  let holding = false, printing = false;
  const close = () => { if (!ov.isConnected) return; unguard(); window.removeEventListener('resize', fit); ov.remove(); document.documentElement.classList.remove('prt-on'); if (back && back.isConnected && back.focus) try { back.focus(); } catch (e) {} };
  const hold = on => { holding = on; ov.classList.toggle('hold', on); ov.querySelector('.prthold').hidden = !on; pb.disabled = on || !pp.firstElementChild; };
  const unguard = prtGuard(info, () => hold(true), () => hold(false), msg => { close(); toast(msg); if (info.onBlock) info.onBlock(); });
  ov.addEventListener('click', async e => {
    if (e.target.closest('[data-pclose]')) { close(); return; }
    if (!e.target.closest('[data-pprint]') || pb.disabled || holding || printing) return;
    // 先在这一下点击里开好新的一页（不然会被当成弹窗挡掉），再核对、再把纸面写进去
    let w = null; try { w = window.open('', '_blank'); } catch (er) { w = null; }
    if (!w) { toast('浏览器没让打开打印用的新页面：请允许这个网站弹出窗口，或者换 Safari、Chrome 打开链接再打印', 6000); return; }
    try { w.opener = null; } catch (er) {}   // 马上断开：打印页碰不到本页（本页的地址里有钥匙）
    let d0 = null; try { d0 = w.document; prtWrite(w, null); } catch (er) {}
    try { w.location.replace('about:blank'); } catch (er) {}   // 换成一个新的空白页：没有来源网址（document.referrer 是空的）
    printing = true; pb.disabled = true;
    const [r] = await Promise.all([prtCheck(info), prtFresh(w, d0, 2000)]);
    printing = false; pb.disabled = holding;
    if (!r.ok) { try { w.close(); } catch (er) {} close(); toast(r.msg); if (info.onBlock) info.onBlock(); return; }
    try {
      prtWrite(w, M); try { w.focus(); } catch (er) {}
      // 个别浏览器开好新页以后会把空白页整个换成一个新的空白文档：只在确实换掉了（不是刚才放过东西的那个文档、上面没有记号）、而且还没印过、没清过时补放一次
      const d0 = w.document;
      setTimeout(() => { try { if (w.closed || w.__prtDone) return; const d = w.document; if (d === d0 || (d.documentElement && d.documentElement.hasAttribute('data-prt'))) return; prtWrite(w, M); } catch (er) {} }, 500);
    } catch (er) { try { w.close(); } catch (e2) {} toast('打印用的页面没打开成功，请再点一次「打印」'); }
  });
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  window.addEventListener('resize', fit);
  setTimeout(() => { if (ov.isConnected) try { pb.focus({ preventScroll: true }); } catch (e) {} }, 30);
  await prtFonts(document, ov, 2500);
  if (!ov.isConnected) return;
  const lay = () => { const n = prtPaginate(document, pp, M); ov.querySelector('#prtn').textContent = prtRange(n, pp.querySelectorAll('.pg-dict').length); fit(); };   // 题纸第几页到第几页、答案第几页到第几页（字体重排以后也跟着改）
  lay(); pb.disabled = holding; setTimeout(fit, 120);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (ov.isConnected) lay(); });   // 字体后来才到：每行高度会变，重新排一次
}

async function boot() {
  const app = $('app');
  app.classList.remove('has-shell');
  if (!KEY) { app.innerHTML = '<div class="wrap boot">请用老师发给你的专属链接打开。</div>'; return; }
  const retry = '<p><button class="btn" onclick="location.reload()">重新打开</button></p>';
  try {
    const d = await rpc('stu_load', { cv: CV }, { obj: true });
    document.title = '单词学习';
    app.classList.add('has-shell');
    Stu.start(d);
  } catch (e) {
    if (/没有权限/.test(e.message)) {
      try { const d = await rpc('adm_load', {}, { obj: true }); document.title = '单词系统 · 管理'; app.classList.add('has-shell'); Adm.start(d); }
      catch (e2) { app.classList.remove('has-shell'); app.innerHTML = '<div class="wrap boot">' + esc(e2.message) + retry + '</div>'; }
    } else if (/链接无效|停用/.test(e.message)) {
      app.innerHTML = '<div class="wrap boot">' + esc(e.message) + '<p class="muted">请联系老师重新发一条链接。</p></div>';
    } else {
      app.innerHTML = '<div class="wrap boot">' + esc(e.message) + retry + '</div>';
    }
  }
}
