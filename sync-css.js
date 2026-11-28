// Usage (in your project folder):   node sync-css.js
// 1) makes a backup of style.css   2) removes EVERY old songs rule from style.css   3) adds songs-section.css at the end.
// Run it again any time you change songs-section.css: it never duplicates anything.
const fs = require('fs');
const SONGS = /(^|[^\w-])(\.songs|\.sg-[\w-]+|\.rec|\.ytbox|\.mqt?|\.now|\.wf|\.nt|\.lyr|\.sgb)(?![\w-])/;
const DROP_FRAMES = /^@(-webkit-)?keyframes\s+(sgin|mq|wv)\b/;

function blocks(css) {   // splits css into [{head, body}] at the top level; head keeps its comments
  const out = []; let i = 0;
  while (i < css.length) {
    let j = i, inC = false;
    while (j < css.length && (css[j] !== '{' || inC)) { if (css.startsWith('/*', j)) inC = true; if (inC && css.startsWith('*/', j)) { inC = false; j++ } j++ }
    if (j >= css.length) { out.push({ head: css.slice(i), body: null }); break }
    let d = 1, k = j + 1, q = '', c2 = false;
    while (k < css.length && d) {
      const ch = css[k];
      if (c2) { if (css.startsWith('*/', k)) { c2 = false; k++ } }
      else if (q) { if (ch === q && css[k - 1] !== '\\') q = '' }
      else if (css.startsWith('/*', k)) { c2 = true; k++ }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '{') d++; else if (ch === '}') d--;
      k++;
    }
    out.push({ head: css.slice(i, j), body: css.slice(j + 1, k - 1) }); i = k;
  }
  return out;
}
const split = head => { const m = head.match(/^((?:\s*\/\*[\s\S]*?\*\/)*)\s*([\s\S]*)$/); return [m[1] || '', (m[2] || '').trim()] };

function clean(css) {
  let removed = 0, res = '';
  for (const b of blocks(css)) {
    if (b.body === null) { res += b.head; continue }
    const [comments, sel] = split(b.head);
    const dropComments = /songs|youtube|record/i.test(comments) ? '' : comments;
    if (/^@(media|supports)/.test(sel)) {
      const inner = clean(b.body); removed += inner.removed;
      if (!inner.css.trim()) { removed++; res += dropComments; continue }
      res += comments + sel + '{' + inner.css + '}'; continue;
    }
    if (DROP_FRAMES.test(sel)) { removed++; res += dropComments; continue }
    if (sel.startsWith('@')) { res += b.head + '{' + b.body + '}'; continue }
    const keep = sel.split(',').map(s => s.trim()).filter(s => !SONGS.test(s));
    if (!keep.length) { removed++; res += dropComments; continue }
    if (keep.length !== sel.split(',').length) removed++;
    res += comments + keep.join(',') + '{' + b.body + '}';
  }
  return { css: res, removed };
}

module.exports = { clean };
if (require.main === module) {
  if (!fs.existsSync('style.css') || !fs.existsSync('songs-section.css')) { console.error('Run this inside the folder that has style.css and songs-section.css'); process.exit(1) }
  const src = fs.readFileSync('style.css', 'utf8');
  let n = 1; while (fs.existsSync(`style.backup-${n}.css`)) n++;
  fs.writeFileSync(`style.backup-${n}.css`, src);
  const START = '/* >>> SONGS (managed by sync-css.js, edit songs-section.css instead) */', END = '/* <<< SONGS */';
  const a = src.indexOf(START), z = src.indexOf(END);
  const base = a >= 0 && z > a ? src.slice(0, a) + src.slice(z + END.length) : src;   // drop what an earlier run added
  const { css, removed } = clean(base);
  const out = css.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n\n' + START + '\n' + fs.readFileSync('songs-section.css', 'utf8').trim() + '\n' + END + '\n';
  fs.writeFileSync('style.css', out);
  console.log(`Done. Removed ${removed} old songs rule(s), added songs-section.css. Backup: style.backup-${n}.css`);
}
