# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved.

"""Voice-over for the Instagram promo video, with the voice of the owner (ElevenLabs), same link and voice as make_video.py.
    cd backend && python manage.py shell -c "exec(open('../manuals/tools/video/promo_voice.py').read())"
English: PROMO_LANG=en before the command. Writes manuals/promo/easy2edit-promo-<lang>.mp3. Change TEXTS below and run again for a new take."""
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings

from apps.integrations.models import Integration

TEXTS = {"nl": (
    "Je website aanpassen... en daarvoor iemand moeten bellen? "
    "Dat kan anders. "
    "Met easy2edit pas je je site zelf aan. Je ziet direct wat je verandert, live, terwijl je typt. "
    "Geen losse plugins van derden die je site traag of onveilig maken. "
    "Alles is gebouwd door de easy2edit-ontwikkelaars: snel, en altijd in jouw stijl. "
    "Wij regelen de hosting en het onderhoud. Jij betaalt een vast bedrag per maand. "
    "easy2edit. Jouw website, in jouw handen."
), "en": (
    "Want to change your website... and you have to call someone first? "
    "There's a better way. "
    "With easy2edit, you edit your site yourself. You see every change instantly, live, as you type. "
    "No third-party plugins slowing your site down or making it unsafe. "
    "Everything is built by the easy2edit developers: fast, and always in your style. "
    "We take care of hosting and maintenance. You pay one fixed monthly fee. "
    "easy2edit. Your website, in your hands."
)}
LANG = os.environ.get("PROMO_LANG", "nl")
TEXT = TEXTS[LANG]
STABILITY = 0.45  # lower = livelier, higher = calmer

ROOT = Path(settings.BASE_DIR).parent
i = Integration.objects.filter(provider="elevenlabs", enabled=True).order_by("-superadmin_only", "id").first()
key = ((i.config or {}).get("api_key") or "").strip() if i else ""
if not key:
    raise RuntimeError("No ElevenLabs link: Admin > API keys.")
model = (i.config or {}).get("model") or "eleven_multilingual_v2"
voice = json.loads((ROOT / "manuals/tools/video/voice.json").read_text())["voice_id"]

body = json.dumps({"text": TEXT, "model_id": model, "voice_settings": {"stability": STABILITY, "similarity_boost": 0.8}}).encode()
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128", data=body,
                             headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
out = ROOT / "manuals" / "promo" / f"easy2edit-promo-{LANG}.mp3"
out.parent.mkdir(parents=True, exist_ok=True)
try:
    out.write_bytes(urllib.request.urlopen(req, timeout=120).read())
except urllib.error.HTTPError as e:
    raise RuntimeError(f"ElevenLabs: HTTP {e.code} {e.read()[:200]}")
print("Klaar:", out)
