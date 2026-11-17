// Vercel serverless function: given a Google Photos share link, returns the album title and its cover photo.
// Put this file at  api/album-cover.js  (a folder named "api" next to index.html). Vercel runs it automatically.
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const link = String(req.query.url || '');
  if (!/^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com)\//.test(link))
    return res.status(400).json({ error: 'Please paste a Google Photos share link.' });
  try {
    const page = await fetch(link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DFCBot/1.0)', 'Accept-Language': 'en' } });
    const html = await page.text();
    const meta = p => {
      const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, 'i'));
      return a ? decode(a[1]) : '';
    };
    let img = meta('og:image');
    if (!img) return res.status(404).json({ error: 'No cover found. Check that the album is shared with "Anyone with the link".' });
    img = img.replace(/=[wh]\d+.*$/, '') + '=w1000-h700-c-rj';             // ask Google for a bigger, cropped JPEG
    if (!/^https:\/\/lh\d\.googleusercontent\.com\//.test(img)) return res.status(502).json({ error: 'Unexpected cover address.' });
    const pic = await fetch(img);
    if (!pic.ok) return res.status(502).json({ error: 'Could not download the cover.' });
    const buf = Buffer.from(await pic.arrayBuffer());
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({
      title: meta('og:title').replace(/\s*-\s*Google Photos$/, ''),
      image: `data:image/jpeg;base64,${buf.toString('base64')}`,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Google Photos.' });
  }
};