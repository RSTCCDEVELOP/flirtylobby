# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes the instruction videos (MP4, English and Dutch) of manuals/tools/video/videos.json into manuals/video/<lang>/<id>.mp4, with the voice of the owner (ElevenLabs).
    cd backend && VIDEO_ARGS="--lang en,nl --only welcome --refresh" python manage.py shell -c "exec(open('../manuals/tools/video/make_video.py').read())"
Arguments (VIDEO_ARGS): --lang en,nl   --only id,id   --refresh (make again, also the ones that exist)   --preview (the voice of the Mac, `say`, instead of ElevenLabs: free, for testing)
The voice: the API link ElevenLabs (Admin > API keys); the voice itself by ELEVEN_VOICE_ID, or ELEVEN_VOICE_NAME, or manuals/tools/video/voice.json {"voice_id": "...", "name": "..."}.
Needs ffmpeg and Chrome. A temporary superadmin makes the recordings (all modules are switched on for a moment and put back, like the screenshots)."""
import hashlib
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings
from rest_framework.authtoken.models import Token

from apps.accounts.models import User
from apps.core import modules
from apps.core.models import Language, ModuleState
from apps.integrations.models import Integration
from apps.plugins import runtime
from apps.plugins.models import Plugin

ROOT = Path(settings.BASE_DIR).parent
TOOLS = ROOT / "manuals" / "tools" / "video"
OUT = ROOT / "manuals" / "video"  # the videos are shared by the manuals of both languages
CACHE = TOOLS / ".cache"
TMP = Path("/tmp/e2e-video")
args = os.environ.get("VIDEO_ARGS", "").split()
opt = lambda n, d="": args[args.index(n) + 1] if n in args else d  # noqa: E731
LANGS = [x for x in opt("--lang", "en,nl").split(",") if x in ("en", "nl")]
ONLY = [x for x in opt("--only").split(",") if x]
REFRESH, PREVIEW = "--refresh" in args, "--preview" in args
W, H = 1280, 800
videos = [v for v in json.loads((TOOLS / "videos.json").read_text()) if not ONLY or v["id"] in ONLY]
SAY_VOICE = {"en": "Samantha", "nl": "Xander"}


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise RuntimeError(f"{cmd[0]} failed: {(r.stderr or r.stdout)[-600:]}")
    return r


def seconds(f):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(f)]).stdout.strip())


# ── the voice ──────────────────────────────────────────────────────────────
def eleven():
    i = Integration.objects.filter(provider="elevenlabs", enabled=True).order_by("-superadmin_only", "id").first()
    key = ((i.config or {}).get("api_key") or "").strip() if i else ""
    if not key:
        return None
    model = (i.config or {}).get("model") or "eleven_multilingual_v2"
    voice = os.environ.get("ELEVEN_VOICE_ID", "")
    vf = TOOLS / "voice.json"
    if not voice and vf.is_file():
        voice = json.loads(vf.read_text()).get("voice_id", "")
    if not voice:  # look for the voice by its name, or the only cloned voice
        req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": key})
        voices = json.loads(urllib.request.urlopen(req, timeout=30).read()).get("voices", [])
        want = os.environ.get("ELEVEN_VOICE_NAME", "").lower()
        hit = [v for v in voices if want and want in v["name"].lower()] or [v for v in voices if v.get("category") in ("cloned", "professional")]
        if len(hit) != 1:
            raise RuntimeError("Which voice? Set ELEVEN_VOICE_NAME or ELEVEN_VOICE_ID. Voices: " + ", ".join(f"{v['name']} ({v.get('category')})" for v in voices))
        voice = hit[0]["voice_id"]
        vf.write_text(json.dumps({"voice_id": voice, "name": hit[0]["name"]}, indent=1))
    return {"key": key, "model": model, "voice": voice}


def speak(text, lang, el):
    """The narration as an audio file (cached: the same text with the same voice is paid for once)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    tag = "say" if el is None else f"{el['voice']}-{el['model']}"
    out = CACHE / (hashlib.sha1(f"{tag}|{lang}|{text}".encode()).hexdigest() + ".m4a")
    if out.is_file():
        return out
    raw = CACHE / (out.stem + (".aiff" if el is None else ".mp3"))
    if el is None:
        run(["say", "-v", SAY_VOICE[lang], "-o", str(raw), text])
    else:
        body = json.dumps({"text": text, "model_id": el["model"], "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}}).encode()
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{el['voice']}?output_format=mp3_44100_128", data=body,
                                     headers={"xi-api-key": el["key"], "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            raw.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"ElevenLabs: HTTP {e.code} {e.read()[:200]}")
    run(["ffmpeg", "-y", "-i", str(raw), "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", str(out)])
    raw.unlink(missing_ok=True)
    return out


# ── the pictures ───────────────────────────────────────────────────────────
def title_card(path, title, sub):
    from PIL import Image, ImageDraw, ImageFont

    im = Image.new("RGB", (W, H), (20, 17, 26))
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
    f2 = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    logo = ROOT / "frontend" / "public" / "logos" / "easy2edit" / "logo_dark.png"
    if logo.is_file():
        lg = Image.open(logo).convert("RGBA")
        lg.thumbnail((360, 120))
        im.paste(lg, ((W - lg.width) // 2, 190), lg)
    tw = d.textlength(title, font=f1)
    d.text(((W - tw) / 2, 360), title, font=f1, fill=(236, 234, 242))
    sw = d.textlength(sub, font=f2)
    d.text(((W - sw) / 2, 450), sub, font=f2, fill=(242, 130, 63))
    d.rectangle([0, H - 10, W, H], fill=(242, 130, 63))
    im.save(path)


def segment(frames_txt, audio, dur, out):
    vf = f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps=25,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(frames_txt)]
    if audio:
        cmd += ["-i", str(audio), "-filter_complex", f"[0:v]{vf}[v];[1:a]aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,apad=whole_dur={dur:.3f}[a]", "-map", "[v]", "-map", "[a]"]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
    cmd += ["-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", str(out)]
    run(cmd)


# ── set-up: a temporary superadmin and all modules on, like the screenshots ──
EMAIL = "manual-video@example.com"
User.objects.filter(email=EMAIL).delete()
u = User.objects.create(email=EMAIL, first_name="Alex", last_name="Admin", is_active=True, is_staff=True, is_superuser=True)
u.set_unusable_password()
u.save()
token = Token.objects.create(user=u).key
prev_modules = list(ModuleState.objects.values_list("key", "enabled"))
prev_plugins = list(Plugin.objects.values_list("pk", "enabled"))
en = Language.objects.filter(code="en").first()
was_en = en.enabled if en else None
try:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is not installed (brew install ffmpeg)")
    el = None if PREVIEW else eleven()
    if el is None and not PREVIEW:
        raise RuntimeError("No ElevenLabs link: add one at Admin > API keys (ElevenLabs, with your API key), or use --preview for the voice of the Mac.")
    for m in modules.MODULES:
        if not m.get("core") and not m.get("plugin"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": True})
    Plugin.objects.update(enabled=True)
    runtime.ensure_loaded(True)
    modules.invalidate()
    if en and not en.enabled:
        Language.objects.filter(pk=en.pk).update(enabled=True)
    for lang in LANGS:
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for v in videos:
            final = OUT / lang / f"{v['id']}.mp4"
            if final.is_file() and not REFRESH:
                print("exists ", lang, v["id"])
                continue
            work = TMP / f"{lang}-{v['id']}"
            shutil.rmtree(work, ignore_errors=True)
            work.mkdir(parents=True)
            steps, audios = [], []
            for n, s in enumerate(v["steps"], 1):
                a = speak(s["say"][lang], lang, el)
                audios.append(a)
                steps.append({**{k: s[k] for k in s if k not in ("say",)}, "duration": round(max(4.0, seconds(a) + 0.9), 2)})
            plan = {"base": "https://localhost:5173", "token": token, "lang": lang, "width": W, "height": H, "outDir": str(work), "steps": steps}
            (work / "plan.json").write_text(json.dumps(plan))
            r = subprocess.run(["node", str(TOOLS / "record.mjs"), str(work / "plan.json")], capture_output=True, text=True, timeout=1500)
            print(r.stdout[-600:], r.stderr[-400:])
            segs = []
            card = work / "title.png"
            title_card(card, v["title"][lang], "Easy2edit")
            (work / "title.txt").write_text(f"file '{card}'\nduration 3\nfile '{card}'\n")
            segment(work / "title.txt", None, 3.0, work / "seg-0.mp4")
            segs.append(work / "seg-0.mp4")
            for n, (s, a) in enumerate(zip(steps, audios), 1):
                segment(work / f"step-{n}" / "frames.txt", a, s["duration"], work / f"seg-{n}.mp4")
                segs.append(work / f"seg-{n}.mp4")
            (work / "list.txt").write_text("".join(f"file '{p}'\n" for p in segs))
            run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(work / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(final)])
            run(["ffmpeg", "-y", "-ss", "4", "-i", str(final), "-frames:v", "1", "-q:v", "3", str(OUT / lang / f"{v['id']}.jpg")])
            print("made   ", lang, v["id"], f"{seconds(final):.0f}s", f"{final.stat().st_size // 1024} KB")
finally:
    ModuleState.objects.all().delete()
    ModuleState.objects.bulk_create([ModuleState(key=k, enabled=v) for k, v in prev_modules])
    for pk, on in prev_plugins:
        Plugin.objects.filter(pk=pk).update(enabled=on)
    runtime.ensure_loaded(True)
    modules.invalidate()
    if en is not None and was_en is False:
        Language.objects.filter(pk=en.pk).update(enabled=False)
    User.objects.filter(email=EMAIL).delete()
    print("temporary superadmin removed; modules, plugins and English put back as they were")
