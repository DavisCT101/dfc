// Vercel serverless function (file: api/album-cover.js, in a folder named "api" next to index.html).
//   /api/album-cover?url=LINK            -> JSON { title, image }   (used by the admin)
//   /api/album-cover?url=LINK&img=1      -> the cover picture itself (used by the website cards)
//   /api/album-cover?url=LINK&debug=1    -> what Google answered, to find problems
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
    if (req.query.debug) return res.status(200).json({ status: page.status, finalUrl: page.url, askedForConsent: /consent\.google\.com/.test(page.url), htmlLength: html.length, ogImage: img ? img.slice(0, 90) + '...' : null, ogTitle: meta('og:title') || null });
    if (/consent\.google\.com/.test(page.url)) return res.status(502).json({ error: 'Google asked for cookie consent and blocked the lookup. Try again later.' });
    if (!img) return res.status(404).json({ error: 'No cover found. Check that the album is shared with "Anyone with the link".' });
    const w = Math.min(Number(req.query.w) || 700, 1600), h = Math.round(w * 0.72);
    img = img.replace(/=[wh]\d+.*$/, '') + `=w${w}-h${h}-c-rj`;                 // a cropped JPEG of the size we want
    if (!/^https:\/\/lh\d\.googleusercontent\.com\//.test(img)) return res.status(502).json({ error: 'Unexpected cover address.' });
    const pic = await fetch(img);
    if (!pic.ok) return res.status(502).json({ error: 'Could not download the cover.' });
    const buf = Buffer.from(await pic.arrayBuffer());
    if (req.query.img) {                                                       // website cards: send the picture, cached for a day
      res.setHeader('Content-Type', pic.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(buf);
    }
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ title: meta('og:title').replace(/\s*-\s*Google Photos$/, ''), image: `data:image/jpeg;base64,${buf.toString('base64')}` });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Google Photos.' });
  }
};
