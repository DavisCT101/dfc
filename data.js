/* =====================================================================
   Shared data layer for index.html (public) and admin.html.
   Public content (updates, albums, hero photos, songs) lives in data.json
   inside your GitHub repo. The admin "Publish" button commits changes to
   it through the GitHub API, and Vercel redeploys the site automatically.
   ===================================================================== */
const GH = { owner: 'YOUR_GITHUB_USERNAME', repo: 'YOUR_REPO_NAME', branch: 'main', path: 'data.json' }; // NOT secret. The token is never written in this file.
/* If you open the admin on your own computer (Live Preview), put your live address here, e.g. 'https://dfc.vercel.app'. On the live site leave it ''. */
const API_BASE = '';
const SYNC = ['u', 'a', 'hero', 'songs'];   // these are published to GitHub. members/messages stay in the browser.
const API = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/`;
const b64e = s => btoa(unescape(encodeURIComponent(s)));
const b64d = s => decodeURIComponent(escape(atob(String(s).replace(/\s/g, ''))));
const why = r => r.status === 401 ? 'The token is wrong or expired.' : r.status === 403 ? 'The token is not allowed to write to this repo (it needs Contents: Read and write).' : r.status === 404 ? 'Repo, branch or file not found. Check the GH settings at the top of data.js.' : (r.status === 409 || r.status === 422) ? 'The file changed at the same time. Press Publish again.' : 'GitHub error ' + r.status;

/* Folder this script lives in, so data.json is found even when the page is inside a subfolder like /admin/ */
const HERE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || (typeof location !== 'undefined' ? location.href : 'http://localhost/');
const tf = (url, opt = {}, ms = 6000) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, { ...opt, signal: c.signal }).finally(() => clearTimeout(t)) };

const DFC = {
  data: {}, dirty: new Set(),
  token: () => { try { return localStorage.getItem('dfc_gh_token') || '' } catch (e) { return '' } },
  setToken: t => { try { t ? localStorage.setItem('dfc_gh_token', t) : localStorage.removeItem('dfc_gh_token') } catch (e) { } },
  hdr: () => ({ Authorization: 'Bearer ' + DFC.token(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }),

  /* Loads data.json once. Visitors read the deployed copy; the signed-in admin reads the newest copy straight from GitHub. */
  async load() {
    let d = null;
    if (DFC.token()) {
      try { const g = await tf(API + GH.path + '?ref=' + GH.branch + '&t=' + Date.now(), { headers: DFC.hdr() }); if (g.ok) d = JSON.parse(b64d((await g.json()).content)) } catch (e) { }
    }
    if (!d) { try { const r = await tf(new URL('data.json', HERE).href + '?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) d = await r.json() } catch (e) { } }
    DFC.data = d || {};
    if (DFC.token()) { try { const dr = JSON.parse(localStorage.getItem('dfc_draft') || 'null'); if (dr) { Object.assign(DFC.data, dr); Object.keys(dr).forEach(k => DFC.dirty.add(k)) } } catch (e) { } }
  },
  get(k, d) {
    if (SYNC.includes(k)) { const v = DFC.data[k]; return v == null ? d : v }
    try { const v = JSON.parse(localStorage.getItem('dfc_' + k)); return v == null ? d : v } catch (e) { return d }
  },
  set(k, v) {
    try {
      if (SYNC.includes(k)) { DFC.data[k] = v; DFC.dirty.add(k); localStorage.setItem('dfc_draft', JSON.stringify(Object.fromEntries([...DFC.dirty].map(x => [x, DFC.data[x]])))) }
      else localStorage.setItem('dfc_' + k, JSON.stringify(v));
    } catch (e) { alert('Browser storage is full. Use image links or smaller pictures.') }
  },

  /* One click = ONE commit: uploads new photos, then updates data.json. */
  async publish() {
    if (!DFC.token()) throw new Error('Add your GitHub token first (My profile > GitHub publishing).');
    if (!DFC.dirty.size) throw new Error('Nothing to publish.');
    let n = 0;
    const lift = async x => {              // new uploaded photos become real files in assets/uploads/
      if (typeof x === 'string' && x.startsWith('data:image/')) {
        const name = `assets/uploads/${Date.now()}-${n++}.jpg`;
        const r = await fetch(API + name, { method: 'PUT', headers: DFC.hdr(), body: JSON.stringify({ message: 'Admin: upload photo', content: x.split(',')[1], branch: GH.branch }) });
        if (!r.ok) throw new Error('Photo upload failed. ' + why(r));
        return name;
      }
      if (Array.isArray(x)) { const o = []; for (const y of x) o.push(await lift(y)); return o }
      if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = await lift(x[k]); return o }
      return x;
    };
    const g = await fetch(API + GH.path + '?ref=' + GH.branch + '&t=' + Date.now(), { headers: DFC.hdr() });
    let remote = {}, sha;
    if (g.ok) { const j = await g.json(); sha = j.sha; remote = JSON.parse(b64d(j.content)) } else if (g.status !== 404) throw new Error(why(g));
    const keys = [...DFC.dirty];
    for (const k of keys) { const v = await lift(DFC.data[k]); DFC.data[k] = v; remote[k] = v }
    const body = { message: 'Admin update: ' + keys.join(', '), content: b64e(JSON.stringify(remote, null, 2)), branch: GH.branch };
    if (sha) body.sha = sha;
    const p = await fetch(API + GH.path, { method: 'PUT', headers: DFC.hdr(), body: JSON.stringify(body) });
    if (!p.ok) throw new Error(why(p));
    DFC.dirty.clear(); try { localStorage.removeItem('dfc_draft') } catch (e) { }
  },
  /* Album cover + title from a Google Photos share link (uses api/album-cover.js on Vercel) */
  async albumInfo(link) {
    let r; try { r = await fetch(`${API_BASE}/api/album-cover?url=${encodeURIComponent(link)}`) } catch (e) { throw new Error('Cover lookup could not run. It works on the live Vercel site (see API_BASE in data.js for local testing).') }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Cover lookup failed (' + r.status + ')');
    return j;
  },
  async test() {
    if (!DFC.token()) return 'No token saved yet.';
    try { const r = await fetch(API + GH.path + '?ref=' + GH.branch, { headers: DFC.hdr() }); return r.ok ? 'Connected to GitHub. Publishing will work.' : why(r) } catch (e) { return 'Could not reach GitHub. Check your internet.' }
  },

  esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  safe: u => { u = String(u || '').trim().replace(/\\/g, '/'); if (/^data:image\/(jpeg|png|webp|gif);base64,[\w+\/=]+$/.test(u)) return u; return /^(https?:\/\/[^\s'"]+|[\w\-. ()%\/]+)$/.test(u) ? (/%/.test(u) ? u : encodeURI(u)) : '' },
  admin() { return DFC.get('admin', { user: 'admin', pass: 'dfc2026', name: 'DFC Admin', email: '', phone: '', role: 'Administrator' }) },
  resize(file, max = 900) { return new Promise(res => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)) }; i.src = r.result }; r.readAsDataURL(file) }) },
  defaults: {
    u: [{ t: 'Worship rehearsal', d: 'Monday, 6pm, Assembly Hall' }],
    a: [], songs: [],
    hero: Array.from({ length: 18 }, (_, i) => `assets/images/img (${i + 1}).jpg`)
  }
};
DFC.ready = DFC.load().catch(() => { });   // every other script waits for this: DFC.ready.then(() => { ... })
