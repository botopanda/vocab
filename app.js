// 单词学习系统 · 公用部分：连数据库、小工具、打开时判断是学生还是管理
const SB_URL = 'https://mycqrrkkltfmyfkbsupp.supabase.co';
const SB_KEY = 'sb_publishable_Dhy_8XpoAWMkXwt5aOuwlQ_CfezzLjs';   // 公开用的大门钥匙，本来就放在网页里；数据靠钥匙链接＋门卫函数保护
const KEY = new URLSearchParams(location.search).get('k') || '';
const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];

async function rpc(fn, args = {}) {
  let r;
  try {
    r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: KEY, ...args }),
    });
  } catch (e) { throw new Error('网络不太稳定，没连上，请稍后再试'); }
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) {
    let m = (j && j.message) || '网络出错了，请稍后再试';
    if (/^[\x00-\x7F]+$/.test(m)) m = '操作没成功，请刷新页面后再试（' + m + '）';
    throw new Error(m);
  }
  return j;
}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KANJI = /\[([^\]]+)\]\{([^}]+)\}|([㐀-鿿豈-﫿々〆ヶ]+)\{([^}]+)\}/g;
const rb = s => esc(s).replace(KANJI, (m, a, b, c, d) => '<ruby>' + (a || c) + '<rt>' + (b || d) + '</rt></ruby>').replace(/«/g, '<mark>').replace(/»/g, '</mark>');
const plain = s => String(s ?? '').replace(KANJI, (m, a, b, c, d) => a || c).replace(/[«»]/g, '');
const md = d => { if (!d) return ''; const x = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d); return (x.getMonth() + 1) + '月' + x.getDate() + '日'; };
const stamp = d => { const x = new Date(d), p = n => String(n).padStart(2, '0'); return p(x.getMonth() + 1) + '-' + p(x.getDate()) + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()); };

function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2800); }
function fail(e) { toast(e && e.message ? e.message : '没成功，请再试一次'); }
function busy(btn, on) { if (btn) { btn.disabled = on; } }

// 读音：audio/ja/<编号>.mp3、_1、_2
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const aud = (id, part) => 'audio/ja/' + encodeURIComponent(id) + (part ? '_' + part : '') + '.mp3';
const sayBtn = (src, label) => '<button class="say" type="button" data-audio="' + esc(src) + '" aria-label="' + esc(label) + '">' + SPK + '</button>';
const player = new Audio(); player.preload = 'auto'; let wantSrc = '';
player.addEventListener('error', () => { if (wantSrc) toast('这段读音没找到，过一会儿再试'); });
function stopAudio() { wantSrc = ''; try { player.pause(); } catch (e) {} }
function play(src) {
  try {
    wantSrc = src; player.pause(); player.src = src; player.currentTime = 0;
    const p = player.play();
    if (p && p.catch) p.catch(err => { const n = err && err.name; if (n === 'AbortError' || n === 'NotSupportedError' || wantSrc !== src) return; toast('没有播出来，再点一次喇叭；也看看手机音量'); });
  } catch (e) { toast('没有播出来，再点一次喇叭'); }
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

function modal(html) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>';
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.body.appendChild(m);
  return m;
}
async function copyText(t, input) {
  try { await navigator.clipboard.writeText(t); toast('已复制'); }
  catch (e) { if (input) { input.select(); toast('请长按选中后复制'); } }
}
const siteBase = () => location.origin + location.pathname;

async function boot() {
  const app = $('app');
  if (!KEY) { app.innerHTML = '<div class="wrap boot">请用老师发给你的专属链接打开。</div>'; return; }
  try {
    const d = await rpc('stu_load');
    document.title = '单词学习';
    Stu.start(d);
  } catch (e) {
    if (/没有权限/.test(e.message)) {
      try { const d = await rpc('adm_load'); document.title = '单词系统 · 管理'; Adm.start(d); }
      catch (e2) { app.innerHTML = '<div class="wrap boot">' + esc(e2.message) + '</div>'; }
    } else {
      app.innerHTML = '<div class="wrap boot">' + esc(e.message) + '</div>';
    }
  }
}
