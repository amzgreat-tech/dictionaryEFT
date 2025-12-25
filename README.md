# English ↔ Finnish Dictionary Web App

This is a minimal web app that translates between English and Finnish using the LibreTranslate API with a small offline fallback for a few common words.

Files:

- `index.html` — UI
- `styles.css` — styling
- `script.js` — translation logic

Run locally (recommended):

1. Serve static files and run the proxy to avoid CORS and public instance limits.

From `e:\My_thesis\dictionary_webapp` create a virtualenv (optional) and install requirements:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2. Start the proxy server (this forwards requests to LibreTranslate):

```powershell
python proxy.py
# proxy listens on http://127.0.0.1:5000
```

3. Serve the static files (from `e:\My_thesis`) and open the web app in your browser:

```powershell
# from e:\My_thesis
python -m http.server 8000
# then open http://localhost:8000/dictionary_webapp/
```

If you don't want to run the proxy, you can still open `index.html` directly in a browser, but you may see CORS errors or blocked requests depending on the public LibreTranslate instance. Using the proxy avoids that and is recommended for local testing.

Notes:
- The app posts to `https://libretranslate.de/translate` when the proxy is not available. Public instances may have usage limits or CORS restrictions.
- For production, obtain your own translation API key, host a LibreTranslate instance, or use a paid translation API with proper credentials.
 - The app can also use **Google Cloud Translate** if you provide an API key. Google usually gives higher-quality translations for many languages (including Tigrigna when supported by the account/region).

----

## Deploying the proxy on Render (recommended)

This section walks through deploying the Python proxy (`proxy.py`) to Render so your frontend (served on GitHub Pages) can call it securely. Render provides HTTPS and lets you set environment variables (for `GOOGLE_API_KEY`) so keys are never exposed to the browser.

1) Push your code to GitHub

From `e:\My_thesis` (adjust for your repo location):
```powershell
cd e:\My_thesis
git init                    # only if not already a git repo
git add .
git commit -m "Add dictionary webapp"
# add origin if needed, then push
git remote add origin https://github.com/<youruser>/<yourrepo>.git
git branch -M main
git push -u origin main
```

2) Create a Web Service on Render

- Sign in to https://render.com and connect your GitHub account.
- Click **New** → **Web Service**.
- Choose your repo and branch (`main`).
- Set the **Root Directory** to `dictionary_webapp` (so Render sees `proxy.py` and `requirements.txt`).
- Build Command: leave empty or set `pip install -r requirements.txt` (Render will run install automatically when it detects Python, but specifying is safe).
- Start Command:
```
gunicorn proxy:app --bind 0.0.0.0:$PORT
```
- Runtime: Python 3 (use default Render settings).
- Environment: add `GOOGLE_API_KEY` if you plan to use Google Translate.

3) Deploy and get proxy URL

After Render deploys the service, note the service URL Render gives (for example `https://my-proxy.onrender.com`). The translate endpoint will be `https://my-proxy.onrender.com/translate`.

4) Update `script.js` for GitHub Pages

When you host the static site on GitHub Pages, edit `dictionary_webapp/script.js` and set `PROXY_URL` to your Render endpoint:

```js
// set this after Render deploy
const PROXY_URL = 'https://my-proxy.onrender.com/translate';
```

You can edit the file locally, commit and push, then publish the static site (see next section).

5) Quick smoke-test (from your machine)

Test the proxy directly with PowerShell (replace the URL):
```powershell
$body = @{ q='welcome'; source='en'; target='fi'; format='text' }
Invoke-RestMethod -Uri 'https://my-proxy.onrender.com/translate' -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress)
```

If the proxy is working you'll get JSON containing `translatedText`.

----

## Publishing the static site to GitHub Pages

Two quick options; the easiest is `git subtree` to publish the `dictionary_webapp` folder to `gh-pages` branch:

```powershell
# from e:\My_thesis (root of your repo)
# push dictionary_webapp contents to gh-pages branch
git subtree push --prefix dictionary_webapp origin gh-pages
```

Then in your GitHub repo Settings → Pages choose `gh-pages` branch as the source. Your site will be available at `https://<youruser>.github.io/<yourrepo>/`.

If you prefer the `docs/` approach, move the contents of `dictionary_webapp` into a `docs/` folder on `main` and set Pages source to `main / docs`.

----

If you want, I can patch `script.js` here to set the `PROXY_URL` to a placeholder URL for you (e.g. `https://my-proxy.onrender.com/translate`) so it's ready to edit with your actual Render URL after deploy. Tell me if you want me to apply that small change now.

Using Google Cloud Translate (optional):

1. Enable the Cloud Translation API in your Google Cloud project and create an API key. Follow Google's docs: https://cloud.google.com/translate/docs/setup

2a (client-side quick test): open `e:\My_thesis\dictionary_webapp\script.js` and set the `GOOGLE_API_KEY` constant near the top of the file. Note: calling Google directly from the browser may be blocked by CORS in some environments and exposes the key to the client — this is only suitable for local testing.

```js
// in script.js
const GOOGLE_API_KEY = 'YOUR_KEY_HERE';
```

2b (recommended): keep your Google API key on the server. Update `proxy.py` to forward requests to Google's API using your key so the browser never directly holds the key. Example approach:

- Set an environment variable `GOOGLE_API_KEY` on the server.
- Modify `proxy.py` to detect a request parameter indicating Google should be used, then forward the request to `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_API_KEY}` and return the response to the client.

Server-side proxy usage (recommended)

1. Set your Google API key as an environment variable on the machine running the proxy:

```powershell
# Windows (PowerShell)
setx GOOGLE_API_KEY "YOUR_GOOGLE_API_KEY"
# then start a new shell so the env var is available
```

Or set it for the current session:

```powershell
$env:GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'
```

2. Start the proxy (it will use Google when the client requests `provider: 'google'`):

```powershell

3. After setting up the key (client-side or via proxy), you can translate between English, Finnish and Tigrigna by selecting `Tigrigna` in the language selectors in the UI.


3. The client (`script.js`) already includes `provider: 'google'` when posting to the proxy; the proxy will only forward to Google if `GOOGLE_API_KEY` is present. This avoids exposing the key in the browser.
