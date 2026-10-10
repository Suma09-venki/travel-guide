import base64
import os

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai

# The frontend lives in ./static and is served by Flask, so one deploy runs everything.
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

MURF_API_KEY = os.environ.get("MURF_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

LANGUAGES = {"English", "Hindi", "Tamil", "Telugu"}

_client = None


def get_client():
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set on the server")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


PROMPTS = {
    "Summary": """
You are a professional tourist guide.
Provide a high-level overview of "{place}" in {language}.

Focus on:
- The historical significance
- Why the place is famous
- Key architectural or cultural highlights

Keep the explanation concise, engaging, and easy to follow.
Avoid excessive details and dates.
Limit the response to around 200 words.
Plain text only, no markdown symbols.

Respond ONLY in {language}.
""",

    "Detailed": """
You are a professional tourist guide.
Provide a detailed and immersive explanation of "{place}" in {language}.

Cover:
- Historical background and timeline
- Architectural design and unique features
- Cultural importance and notable events
- Interesting facts and visitor insights

Explain concepts clearly and in a storytelling manner.
Include relevant details and examples to create a rich experience.
Limit the response to around 400 words.
Plain text only, no markdown symbols.

Respond ONLY in {language}.
""",

    "Itinerary": """
You are an expert travel planner.
Create a {days}-day trip itinerary for visiting "{place}" and its surroundings, written in {language}.

For each day:
- Start with a heading in the exact form "Day N: short theme"
- List Morning, Afternoon and Evening plans with suggested timings
- Name specific nearby attractions and one local food or dish to try

End with a short "Tips" section covering the best time to visit, how to get around, and a rough budget.

Plain text only. Do not use markdown symbols such as ** or #.
Keep the whole answer under {words} words.

Respond ONLY in {language}.
""",
}


def generate_text(prompt):
    response = get_client().models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text


def generate_speech(text, voice_id, locale):
    if not MURF_API_KEY:
        raise RuntimeError("MURF_API_KEY is not set on the server")

    response = requests.post(
        "https://global.api.murf.ai/v1/speech/stream",
        headers={"api-key": MURF_API_KEY, "Content-Type": "application/json"},
        json={
            "voice_id": voice_id,
            "text": text,
            "locale": locale,
            "model": "FALCON",
            "format": "MP3",
            "sampleRate": 24000,
            "channelType": "MONO",
        },
        timeout=90,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Murf error {response.status_code}: {response.text[:300]}")
    return response.content


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/health")
def health():
    return {"status": "ok"}


@app.route("/generate-audio-guide", methods=["POST"])
def generate_audio_guide():
    data = request.get_json(silent=True) or {}
    place = (data.get("place") or "").strip()
    answer_type = data.get("answerType")
    language = data.get("language")
    voice_id = data.get("voiceId")
    locale = data.get("locale")

    if not place or answer_type not in ("Summary", "Detailed") or language not in LANGUAGES:
        return jsonify(error="Invalid request"), 400
    if not voice_id or not locale:
        return jsonify(error="voiceId and locale are required"), 400

    try:
        description = generate_text(PROMPTS[answer_type].format(place=place, language=language))
    except Exception as e:
        return jsonify(error=f"Text generation failed: {e}"), 502

    # If audio fails we still return the transcript so the user gets something.
    audio_b64, audio_error = "", None
    try:
        audio_b64 = base64.b64encode(generate_speech(description, voice_id, locale)).decode("utf-8")
    except Exception as e:
        audio_error = str(e)
        print("Audio error:", audio_error)

    return jsonify(description=description, audioBase64=audio_b64, audioError=audio_error)


@app.route("/generate-itinerary", methods=["POST"])
def generate_itinerary():
    data = request.get_json(silent=True) or {}
    place = (data.get("place") or "").strip()
    language = data.get("language")
    try:
        days = int(data.get("days", 1))
    except (TypeError, ValueError):
        days = 0

    if not place or language not in LANGUAGES or not 1 <= days <= 7:
        return jsonify(error="Invalid request"), 400

    try:
        itinerary = generate_text(
            PROMPTS["Itinerary"].format(place=place, language=language, days=days, words=150 * days + 120)
        )
    except Exception as e:
        return jsonify(error=f"Itinerary generation failed: {e}"), 502

    return jsonify(itinerary=itinerary)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
