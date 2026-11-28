// Vercel serverless function (file: api/yt-search.js).
// Finds the best YouTube video for a song name:   /api/yt-search?q=Hallelujah%20Eeh%20Nathaniel%20Bassey
// Needs ONE secret in Vercel: YOUTUBE_API_KEY (Project > Settings > Environment Variables).
// Optional: ADMIN_GITHUB_USER = your GitHub username. If set, only requests carrying your GitHub token are answered (protects your daily search quota).
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY is not set. Add it in Vercel: Project > Settings > Environment Variables, then redeploy.' });

  const owner = process.env.ADMIN_GITHUB_USER;
  if (owner) {
    const tk = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let who = ''; try { const u = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'dfc' } }); if (u.ok) who = (await u.json()).login || '' } catch (e) { }
    if (who.toLowerCase() !== owner.toLowerCase()) return res.status(401).json({ error: 'Not signed in as the admin. Save your GitHub token in My profile first.' });
  }

  const q = String(req.query.q || '').trim().slice(0, 150);
  if (!q) return res.status(400).json({ error: 'Type a song name.' });
  try {
    const url = 'https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
      part: 'snippet', type: 'video', q, key, maxResults: '5',
      videoEmbeddable: 'true', videoSyndicated: 'true', videoCategoryId: '10', safeSearch: 'moderate',   // only music videos that are allowed to play on other sites
    });
    const r = await fetch(url), j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'YouTube search failed (' + r.status + ')' });
    const items = (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({ id: x.id.videoId, title: decode(x.snippet.title), channel: decode(x.snippet.channelTitle) }));
    if (!items.length) return res.status(404).json({ error: 'No playable video found for "' + q + '". Try adding the artist name.' });
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).json({ best: items[0], items });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach YouTube.' });
  }
};
