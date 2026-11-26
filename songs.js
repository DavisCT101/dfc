/* songs.js: the songs section for the DFC website. Load it AFTER script.js. */
/* =====================================================================
   Each song comes from data.json (edited in the admin):
     t = title   a = artist   s = 'Friday' or 'Sunday'
     yt = YouTube link (plays inside the record; the cover is the video thumbnail)
     au = your own audio file (used when there is no YouTube link)
     i = cover picture (optional)   l = lyrics
   ===================================================================== */
DFC.ready.then(() => {

const SONGS = DFC.get('songs', []);
const $ = s => document.querySelector(s), FADE = 1800;
const sec = $('#songs'), stack = $('#sgStack'), bgs = $('#sgBgs'), now = $('#now');
if (!sec) return;

let all = [], list = [], filt = 'all', on = false, unlocked = false, idx = -1, f = 0, vis = false, adv = false, recs = [], bgEls = [], cur = null;
const live = new Set();   // every voice (YouTube or audio) that exists right now
const pad = n => String(n).padStart(2, '0'), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ytId = u => ((String(u || '')).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/) || [])[1] || '';

/* ---------- covers ---------- */
const PAL = [['#7a1f2b', '#f5a30a'], ['#10243d', '#3aa0ff'], ['#2a0f3a', '#ff5fa2'], ['#0e3b2e', '#f5c542'], ['#3b1020', '#ff8a3d'], ['#16213e', '#7fe3e3']];
function makeCover(s, k) {   // a made-up cover, only used when a song has no YouTube thumbnail and no picture
  const c = document.createElement('canvas'); c.width = c.height = 700; const x = c.getContext('2d'), [a, b] = PAL[k % PAL.length];
  const g = x.createLinearGradient(0, 0, 700, 700); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 700, 700);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'italic 64px "Playfair Display",Georgia,serif';
  let lines = [], l = ''; (s.t || '').split(' ').forEach(t => { if ((l + ' ' + t).trim().length > 12 && l) { lines.push(l); l = t } else l = (l + ' ' + t).trim() }); lines.push(l);
  lines.forEach((t, i) => x.fillText(t, 350, 330 - (lines.length - 1) * 34 + i * 74));
  x.font = '500 22px Outfit,sans-serif'; x.globalAlpha = .8; x.fillText('DANCERS FOR CHRIST  ·  ' + (s.s || '').toUpperCase(), 350, 640);
  return c.toDataURL('image/jpeg', .82);
}
function ytCover(id) {       // the video thumbnail (big version if it exists, normal one otherwise)
  const u = n => `https://img.youtube.com/vi/${id}/${n}.jpg`;
  return new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth > 300 ? u('maxresdefault') : u('hqdefault')); im.onerror = () => r(u('hqdefault')); im.src = u('maxresdefault') });
}

/* ---------- YouTube API ---------- */
let ytP = null;
function loadYT() {
  if (ytP) return ytP;
  ytP = new Promise(res => {
    if (window.YT && YT.Player) return res();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res() };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => res(); document.head.appendChild(s);
  });
  return ytP;
}

async function prepare() {
  all = await Promise.all(SONGS.map(async (s, k) => {
    const x = { ...s, t: s.t || '', a: s.a || '' }, id = ytId(x.yt);
    if (!x.i && id) x.i = await ytCover(id);
    return { ...x, i: x.i || makeCover(x, k) };
  }));
  if (all.some(s => ytId(s.yt))) loadYT();   // load early so Play starts instantly
}

/* ---------- voices: one per song while it plays. Both kinds share the same small set of methods ---------- */
const track = v => { live.add(v); const d = v.dispose; v.dispose = () => { cancelAnimationFrame(v.raf); live.delete(v); d() }; return v };
function audioVoice(s) {
  const a = new Audio(), v = { cv: 0, raf: 0 };
  a.preload = 'auto'; a.src = s.au; a.volume = 0; a.onended = () => ended(v);
  v.setVol = x => { v.cv = x; a.volume = clamp(x, 0, 1) };
  v.start = () => { a.currentTime = 0; a.play().catch(() => { }) };
  v.resume = () => { a.play().catch(() => { }) }; v.pause = () => a.pause();
  v.pos = () => a.currentTime; v.len = () => a.duration || 0;
  v.dispose = () => { a.pause(); a.removeAttribute('src'); a.load() };
  return track(v);
}
function ytVoice(i, s) {
  const rec = recs[i], box = rec.querySelector('.ytbox'), host = document.createElement('div'), v = { cv: 0, raf: 0 };
  box.textContent = ''; box.appendChild(host); rec.classList.add('playing');   // the video shows inside the record (it must stay visible)
  let p, ready = false, want = false;
  const vars = { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 }; if (location.protocol.startsWith('http')) vars.origin = location.origin;
  p = new YT.Player(host, {
    width: '100%', height: '100%', videoId: ytId(s.yt), playerVars: vars,
    events: {
      onReady: () => { ready = true; p.setVolume(Math.round(v.cv * 100)); if (want) p.playVideo() },
      onStateChange: e => { if (e.data === 0) ended(v); else if (e.data === 1) state(v, true); else if (e.data === 2) state(v, false) },
    },
  });
  v.setVol = x => { v.cv = x; if (ready) p.setVolume(Math.round(x * 100)) };
  v.start = () => { want = true; if (ready) p.playVideo() }; v.resume = v.start;
  v.pause = () => { want = false; if (ready) p.pauseVideo() };
  v.pos = () => (ready && p.getCurrentTime ? p.getCurrentTime() : 0); v.len = () => (ready && p.getDuration ? p.getDuration() : 0);
  v.dispose = () => { try { p.destroy() } catch (e) { } box.textContent = ''; rec.classList.remove('playing') };
  return track(v);
}
function makeVoice(i) {
  const s = list[i];
  if (ytId(s.yt) && window.YT && YT.Player) return ytVoice(i, s);
  if (s.au) return audioVoice(s);
  return null;
}
const ended = v => { if (cur && cur.v === v) advance() };
const state = (v, playing) => { if (cur && cur.v === v && playing !== on) { on = playing; pui() } };   // keeps the Play button right if someone uses YouTube's own buttons

/* ---------- the crossfade: old voice fades out while the new one fades in ---------- */
function ramp(v, to, cb) {
  cancelAnimationFrame(v.raf);
  const from = v.cv, t0 = performance.now();
  (function step(t) { const p = Math.min((t - t0) / FADE, 1); v.setVol(from + (to - from) * p); if (p < 1) v.raf = requestAnimationFrame(step); else cb && cb() })(t0);
}
function crossTo(i) {
  const s = list[i]; if (!s) return;
  $('#nowT').textContent = s.t;
  if (cur && cur.i === i) return;
  adv = false;
  const old = cur; cur = null;
  if (old) ramp(old.v, 0, () => old.v.dispose());
  const v = makeVoice(i);
  if (v) { cur = { i, v }; v.start(); ramp(v, 1) }
  else if (ytId(s.yt)) loadYT().then(() => { if (on && idx === i && !cur) crossTo(i) });   // API was still loading
}
function toggle() {
  const s = list[idx]; if (!s) return;
  if (on) { on = false; live.forEach(v => v.pause()) }
  else {
    on = true;
    if (!unlocked) { unlocked = true; setHeight(); const r = sec.getBoundingClientRect(); if (Math.abs(r.top) > 4) scrollTo({ top: r.top + scrollY, behavior: 'smooth' }) }   // Play unlocks scrolling through the songs
    if (cur && cur.i === idx) cur.v.resume(); else crossTo(idx);
  }
  pui();
}
function goTo(i) {
  if (!unlocked || i < 0 || i >= list.length) return false;
  const r = sec.getBoundingClientRect(), range = sec.offsetHeight - innerHeight;
  scrollTo({ top: r.top + scrollY + (list.length > 1 ? i / (list.length - 1) * range : 0), behavior: 'smooth' }); return true;
}
function advance() {   // next song; if the visitor scrolled away we crossfade without yanking the page back
  const n = (cur ? cur.i : idx) + 1;
  if (n >= list.length) { on = false; live.forEach(v => v.pause()); pui(); return false }
  return vis ? goTo(n) : (crossTo(n), true);
}
setInterval(() => {   // progress bar + start the next song just before this one ends
  if (!cur) return;
  const d = cur.v.len(), p = cur.v.pos();
  $('#nowBar').style.width = d ? p / d * 100 + '%' : '0';
  if (on && d && d - p < FADE / 1000 + .3 && !adv) { adv = true; advance() }
}, 400);

/* ---------- layout: pinned section, records scrubbed by scroll ---------- */
function setHeight() { sec.style.height = unlocked ? `calc(100svh + ${Math.max(list.length - 1, 0) * 80}svh)` : '100svh'; sec.classList.toggle('live', unlocked) }
function target() { const r = sec.getBoundingClientRect(), range = sec.offsetHeight - innerHeight; if (!unlocked || list.length < 2 || range <= 0) return 0; return clamp(-r.top / range, 0, 1) * (list.length - 1) }
function build() {
  live.forEach(v => v.dispose()); live.clear(); cur = null;
  list = filt === 'all' ? all : all.filter(s => s.s === filt);
  stack.textContent = ''; bgs.textContent = '';
  recs = list.map((s, i) => {
    const d = document.createElement('div'); d.className = 'rec'; d.dataset.i = i; d.setAttribute('aria-label', s.t);
    const c = DFC.safe(s.i); if (c) d.style.backgroundImage = `url("${c}")`;
    const b = document.createElement('div'); b.className = 'ytbox'; d.appendChild(b); stack.appendChild(d); return d;
  });
  bgEls = list.map(s => { const d = document.createElement('div'); d.className = 'sg-bg'; const c = DFC.safe(s.i); if (c) d.style.backgroundImage = `url("${c}")`; bgs.appendChild(d); return d });
  setHeight();
  $('#sgCount').textContent = `This week's songs / ${list.length} ${list.length === 1 ? 'song' : 'songs'}`;
  const art = [...new Set(all.map(s => s.a).filter(Boolean))]; if (!art.length) art.push('DFC Worship Team');
  const mq = $('#sgMq'); mq.textContent = ''; for (let r = 0; r < 2; r++) art.forEach(a => { const s = document.createElement('span'); s.textContent = a; const b = document.createElement('b'); b.textContent = '✶'; mq.append(s, b) });
  idx = -1; f = target(); place();
}
function place() {
  const S = stack.offsetWidth, n = list.length;
  recs.forEach((r, i) => {
    const d = i - f, a = Math.abs(d), y = d < 0 ? d * S * 1.5 : Math.min(d, 2) * S * .95, sc = 1 - Math.min(a, 1) * .6, rot = clamp(d * 5, -10, 10), op = d < 0 ? clamp(1 + d * 1.5, 0, 1) : clamp(1 - d * .55, 0, 1);
    r.style.transform = `translate3d(0,${y}px,0) rotate(${rot}deg) scale(${sc})`; r.style.opacity = op; r.style.zIndex = 50 - Math.round(a * 10); r.style.pointerEvents = unlocked && op > .2 ? 'auto' : 'none';
    bgEls[i].style.opacity = clamp(1 - a, 0, 1) * .95;
  });
  const act = n ? clamp(Math.round(f), 0, n - 1) : -1;
  if (act !== idx) { idx = act; ui(); if (on && idx >= 0) crossTo(idx) }
  $('#sgRing').style.strokeDashoffset = 1 - (n > 1 ? f / (n - 1) : 1);
}
function ui() {
  const s = list[idx], m = $('#sgMeta'); m.classList.remove('in'); void m.offsetWidth; m.classList.add('in');
  if (!s) { $('#sgYear').textContent = ''; $('#sgTitle').textContent = 'No songs yet'; $('#sgKind').textContent = 'Check back soon for this week’s songs.'; $('#sgNo').textContent = '00'; return pui() }
  $('#sgYear').textContent = s.s + ' service'; $('#sgTitle').textContent = s.t;
  $('#sgKind').textContent = (s.a || 'DFC Worship Team') + (ytId(s.yt) || s.au ? '' : ' · audio coming soon'); $('#sgNo').textContent = pad(idx + 1); $('#nowT').textContent = s.t;
  if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: s.t, artist: s.a || 'DFC' });
  pui();
}
function pui() { $('#sgPlay').textContent = on ? 'Pause ❚❚' : 'Play ▶'; $('#nowBtn').textContent = on ? 'Pause' : 'Play'; $('#wf').classList.toggle('playing', on); now.hidden = !(vis || on) }

/* ---------- buttons ---------- */
$('#sgPlay').onclick = toggle; $('#nowBtn').onclick = toggle;
$('#sgLyr').onclick = () => { const s = list[idx]; if (!s) return; $('#lyT').textContent = s.t; $('#lyB').textContent = s.l || 'Lyrics have not been added for this song yet.'; $('#lyOv').classList.add('open') };
$('#lyX').onclick = () => $('#lyOv').classList.remove('open');
$('#lyOv').onclick = e => { if (e.target.id === 'lyOv') e.target.classList.remove('open') };
addEventListener('keydown', e => { if (e.key === 'Escape') $('#lyOv').classList.remove('open') });
stack.onclick = e => { const r = e.target.closest('.rec'); if (r) goTo(+r.dataset.i) };
$('#sgTabs').onclick = e => { const v = e.target.dataset.f; if (!v) return; filt = v; document.querySelectorAll('#sgTabs button').forEach(b => b.classList.toggle('on', b === e.target)); build() };
new IntersectionObserver(es => { vis = es[0].isIntersecting; pui() }, { rootMargin: '120px' }).observe(sec);
addEventListener('resize', place);

function start() { prepare().then(() => { build(); (function tick() { requestAnimationFrame(tick); if (!vis) return; const t = target(); f += (t - f) * .14; if (Math.abs(t - f) < .001) f = t; place() })() }) }
Promise.race([document.fonts ? document.fonts.load('italic 64px "Playfair Display"') : 0, new Promise(r => setTimeout(r, 1500))]).then(start, start);

});
