// Vercel Serverless function to proxy translation requests.
// It prefers Google Cloud Translate if GOOGLE_API_KEY is set in Vercel environment
// variables, otherwise it falls back to LibreTranslate.

const LIBRE_URL = 'https://libretranslate.de/translate';
const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { q, source, target, format = 'text' } = req.body || {};
  if (!q || !source || !target) return res.status(400).json({ error: 'missing parameters' });

  const googleKey = process.env.GOOGLE_API_KEY;

  // If Google key provided, use Google Translate server-side (keeps key secret)
  if (googleKey) {
    try {
      const gresp = await fetch(`${GOOGLE_URL}?key=${encodeURIComponent(googleKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, source, target, format }),
      });
      const gdata = await gresp.json();
      if (gresp.ok && gdata && gdata.data && gdata.data.translations && gdata.data.translations[0]) {
        return res.status(200).json({ translatedText: gdata.data.translations[0].translatedText });
      }
      // forward unexpected google response
      return res.status(gresp.status || 502).json({ error: 'google error', raw: gdata });
    } catch (e) {
      // fall through to LibreTranslate
      console.warn('google proxy failed', e && e.message);
    }
  }

  // Fallback to LibreTranslate
  try {
    const lresp = await fetch(LIBRE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, source, target, format }),
    });
    const ldata = await lresp.json();
    if (lresp.ok) return res.status(200).json(ldata);
    return res.status(lresp.status || 502).json({ error: 'libre error', raw: ldata });
  } catch (e) {
    return res.status(502).json({ error: 'upstream request failed', detail: e && e.message });
  }
}
