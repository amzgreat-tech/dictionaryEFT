from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

LIBRE_URL = 'https://libretranslate.de/translate'
GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2'


@app.route('/translate', methods=['POST'])
def translate():
    payload = request.get_json(force=True)
    if not payload or 'q' not in payload or 'source' not in payload or 'target' not in payload:
        return jsonify({'error': 'invalid request'}), 400

    # Allow client to request Google via provider flag; server will only use
    # Google if GOOGLE_API_KEY is configured in environment.
    use_google = payload.get('provider') == 'google' or payload.get('use_google') is True
    google_key = os.environ.get('GOOGLE_API_KEY')

    # If Google requested and key present, forward to Google Translate (server-side)
    if use_google and google_key:
        try:
            gresp = requests.post(f"{GOOGLE_URL}?key={google_key}", json={
                'q': payload['q'],
                'source': payload['source'],
                'target': payload['target'],
                'format': payload.get('format', 'text')
            }, timeout=10)
        except requests.RequestException as e:
            return jsonify({'error': 'google upstream failed', 'detail': str(e)}), 502

        try:
            gdata = gresp.json()
        except ValueError:
            return jsonify({'error': 'invalid google response', 'status': gresp.status_code}), 502

        # Normalize Google response to { translatedText: ... }
        try:
            translated = gdata.get('data', {}).get('translations', [])[0].get('translatedText')
            return jsonify({'translatedText': translated}), gresp.status_code
        except Exception:
            return jsonify({'error': 'unexpected google response', 'raw': gdata}), 502

    # Otherwise, forward to LibreTranslate
    try:
        resp = requests.post(LIBRE_URL, json={
            'q': payload['q'],
            'source': payload['source'],
            'target': payload['target'],
            'format': payload.get('format', 'text')
        }, timeout=10)
    except requests.RequestException as e:
        return jsonify({'error': 'upstream request failed', 'detail': str(e)}), 502

    try:
        data = resp.json()
    except ValueError:
        return jsonify({'error': 'invalid upstream response', 'status': resp.status_code}), 502

    # return upstream body as-is (typically contains translatedText)
    return jsonify(data), resp.status_code


if __name__ == '__main__':
    # For local testing only. In production run with a WSGI server.
    app.run(host='127.0.0.1', port=5000, debug=True)
