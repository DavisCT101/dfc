/* api/song-lookup.js  (Vercel serverless function)
   GET /api/song-lookup?q=Song name Artist
   -> { id, url, title, artist }

   Works two ways:
   1. BEST: set an environment variable YOUTUBE_API_KEY in Vercel (free, see steps).
      Uses the official YouTube Data API and only returns videos that are allowed to be embedded.
   2. FALLBACK: with no key it reads YouTube's public search page. It needs no setup,
      but YouTube can occasionally block it, so the key is recommended.
*/
const decode = s => String(s || '')
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function viaApi(q, key) {
  const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1'
    + '&q=' + encodeURIComponent(q) + '&key=' + encodeURIComponent(key);
  const r = await fetch(u);
  if (!r.ok) throw new Error('YouTube API ' + r.status);
  const j = await r.json();
  const it = j.items && j.items[0];
  if (!it || !it.id || !it.id.videoId) return null;
  return { id: it.id.videoId, title: decode(it.snippet.title), artist: decode(it.snippet.channelTitle) };
}

function findVideo(node) {            // walks YouTube's page data and returns the first real (non-live) video
  if (!node || typeof node !== 'object') return null;
  if (node.videoRenderer && node.videoRenderer.videoId && node.videoRenderer.lengthText) {
    const v = node.videoRenderer;
    return {
      id: v.videoId,
      title: (v.title && v.title.runs && v.title.runs[0] && v.title.runs[0].text) || '',
      artist: (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].text) || '',
    };
  }
  for (const k in node) { const f = findVideo(node[k]); if (f) return f }
  return null;
}

async function viaScrape(q) {
  const r = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgIQAQ%3D%3D', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
  });
  if (!r.ok) throw new Error('YouTube page ' + r.status);
  const html = await r.text();
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) return null;
  return findVideo(JSON.parse(m[1]));
}

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 150);
  if (!q) return res.status(400).json({ error: 'Missing ?q=song name' });
  try {
    const key = process.env.YOUTUBE_API_KEY;
    let hit = null;
    if (key) { try { hit = await viaApi(q, key) } catch (e) { hit = null } }
    if (!hit) hit = await viaScrape(q);
    if (!hit) return res.status(404).json({ error: 'No video found for "' + q + '"' });
    // the same song name always gives the same answer, so let Vercel remember it for a week
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).json({ id: hit.id, url: 'https://youtu.be/' + hit.id, title: hit.title, artist: hit.artist });
  } catch (e) {
    return res.status(502).json({ error: 'Song lookup failed: ' + e.message });
  }
};
