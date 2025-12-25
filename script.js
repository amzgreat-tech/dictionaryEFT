// Public endpoints
const API_URL = 'https://libretranslate.de/translate';
// When deployed to Vercel (or other serverless host) the proxy is available
// at the relative path `/api/translate`. During local development you can
// run the Python proxy (proxy.py) and set PROXY_URL to the local address.
const PROXY_URL = '/api/translate';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Optional: Google Cloud Translate V2 API key. Leave empty if you don't have one.
// To use Google without CORS issues, prefer setting the key in the proxy and
// forwarding requests server-side (see README). If you set a key here, the
// client will try Google directly (may be blocked by CORS in some browsers).
const GOOGLE_API_KEY = '';
const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';

const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const metaEl = document.getElementById('meta');
const translateBtn = document.getElementById('translate');
const copyBtn = document.getElementById('copy');
const clearBtn = document.getElementById('clear');
const sourceSel = document.getElementById('source');
const targetSel = document.getElementById('target');
const swapBtn = document.getElementById('swap');

async function translateAPI(text, source, target){
  const body = { q: text, source, target, format: 'text', provider: 'google' };

  // First try local proxy (recommended). If it fails, fall back to public API.
  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 8000);
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if(res.ok){
      const data = await res.json();
      return data.translatedText || '';
    }
    // If proxy returns non-ok, fall through to public API attempt
  }catch(e){
    // proxy failed (not running/CORS/network). We'll attempt public API next.
    console.warn('Proxy request failed, falling back to public API:', e && e.message);
  }

  // Fallback to public LibreTranslate endpoint directly. If it fails, try MyMemory.
  // If a Google API key is provided, try Google Translate (client-side).
  if(GOOGLE_API_KEY){
    try{
      const g = await translateGoogle(text, source, target);
      if(g) return g;
    }catch(ge){
      console.warn('Google Translate failed (client-side):', ge && ge.message);
    }
  }

  try{
    const res2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if(!res2.ok) throw new Error(`API error ${res2.status}`);
    const data2 = await res2.json();
    return data2.translatedText || '';
  }catch(e){
    console.warn('LibreTranslate failed, trying MyMemory fallback:', e && e.message);
    try{
      const mm = await translateMyMemory(text, source, target);
      if(mm) return mm;
    }catch(err){
      console.warn('MyMemory also failed:', err && err.message);
    }
    throw e;
  }
}

// Client-side Google Translate v2 call (requires API key set in GOOGLE_API_KEY).
async function translateGoogle(text, source, target){
  if(!GOOGLE_API_KEY) throw new Error('No Google API key configured');
  const url = `${GOOGLE_URL}?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const payload = { q: text, source, target, format: 'text' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if(!res.ok) throw new Error(`Google API error ${res.status}`);
  const data = await res.json();
  if(data && data.data && data.data.translations && data.data.translations[0]){
    return data.data.translations[0].translatedText || '';
  }
  return '';
}

// Secondary fallback: MyMemory public API (no API key required, limited quota)
async function translateMyMemory(text, source, target){
  const q = encodeURIComponent(text);
  const langpair = encodeURIComponent(`${source}|${target}`);
  const url = `${MYMEMORY_URL}?q=${q}&langpair=${langpair}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`MyMemory error ${res.status}`);
  const data = await res.json();
  // responseData.translatedText is the translated string
  if(data && data.responseData && data.responseData.translatedText) return data.responseData.translatedText;
  return '';
}

// Small offline fallback for a handful of common words/phrases
function fallbackTranslate(text, source, target){
  const dict = {
    hello: { fi: 'hei' },
    welcome: { fi: 'tervetuloa' },
    world: { fi: 'maailma' },
    good: { fi: 'hyvä' },
    morning: { fi: 'aamu' },
    thanks: { fi: 'kiitos' },
    bye: { fi: 'hei' },
    yes: { fi: 'kyllä' },
    no: { fi: 'ei' }
  };

  const normalized = text.trim().toLowerCase();
  if(source === 'en' && target === 'fi'){
    const parts = normalized.split(/\s+/);
    const translated = parts.map(p => dict[p] ? dict[p].fi : p).join(' ');
    return translated;
  }
  if(source === 'fi' && target === 'en'){
    // reverse map
    const rev = Object.fromEntries(Object.entries(dict).map(([k,v])=>[v.fi,k]));
    const parts = normalized.split(/\s+/);
    const translated = parts.map(p => rev[p] ? rev[p] : p).join(' ');
    return translated;
  }
  return text;
}

async function doTranslate(){
  const text = inputEl.value.trim();
  if(!text){ outputEl.textContent = ''; metaEl.textContent = ''; return; }
  const source = sourceSel.value;
  const target = targetSel.value;

  outputEl.textContent = 'Translating...';
  metaEl.textContent = '';

  try{
    const result = await translateAPI(text, source, target);
    outputEl.textContent = result;
    metaEl.textContent = 'Translated via LibreTranslate';
  }catch(err){
    // fallback
    const fallback = fallbackTranslate(text, source, target);
    outputEl.textContent = fallback || 'No translation available.';
    metaEl.textContent = 'Used offline fallback (API unavailable or blocked).';
  }
}

translateBtn.addEventListener('click', doTranslate);
copyBtn.addEventListener('click', async () => {
  try{ await navigator.clipboard.writeText(outputEl.textContent || ''); }
  catch(e){ /* ignore */ }
});
clearBtn.addEventListener('click', ()=>{ inputEl.value = ''; outputEl.textContent = ''; metaEl.textContent = ''; inputEl.focus(); });

swapBtn.addEventListener('click', ()=>{
  const s = sourceSel.value;
  sourceSel.value = targetSel.value;
  targetSel.value = s;
});

// keyboard: Ctrl+Enter or Cmd+Enter to translate
inputEl.addEventListener('keydown', (ev) => {
  if((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') doTranslate();
});

// initial
outputEl.textContent = '';
