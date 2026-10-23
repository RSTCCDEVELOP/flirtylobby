"""Settings backup as a zip (optionally encrypted with AES-256 and a password) and the restore of such a zip.

Nothing is left behind on the server: the zip of a back-up is made in memory. A restore keeps the uploaded zip only while it is read; the
parts are then kept as small files in one temporary folder per restore, which is removed when the restore is finished, and anything older
than an hour (a closed browser) is removed on the next restore.
"""
import io
import json
import logging
import re
import secrets
import shutil
import tempfile
import time
from pathlib import Path

import pyzipper
from django.utils import timezone

from . import settings_backup as backup

logger = logging.getLogger(__name__)
INNER = "easy2edit-settings.json"
MAX_AGE = 3600  # seconds a restore folder may live
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,64}$")


class PasswordNeeded(Exception):
    pass


class WrongPassword(Exception):
    pass


def make_zip(bundle, password=""):
    """The back-up as zip bytes. With a password: AES-256 encrypted (opens in 7-Zip, Keka, WinZip, …)."""
    raw = json.dumps(bundle, ensure_ascii=False).encode()
    buf = io.BytesIO()
    with pyzipper.AESZipFile(buf, "w", compression=pyzipper.ZIP_DEFLATED, **({"encryption": pyzipper.WZ_AES} if password else {})) as z:
        if password:
            z.setpassword(password.encode())
        z.writestr(INNER, raw)
    return buf.getvalue()


def filename():
    return f"easy2edit-instellingen-{timezone.localtime().strftime('%Y%m%d-%H%M')}.zip"


# ── restore ─────────────────────────────────────────────────────────────────
def base():
    d = Path(tempfile.gettempdir()) / "easy2edit-restore"
    d.mkdir(mode=0o700, exist_ok=True)
    return d


def sweep(max_age=MAX_AGE):
    """Remove restore folders that were left behind (a closed browser, a crash)."""
    now = time.time()
    for d in base().iterdir():
        try:
            if d.is_dir() and now - d.stat().st_mtime > max_age:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


def folder(token):
    if not TOKEN_RE.match(token or ""):
        raise ValueError("Ongeldige herstelsessie.")
    d = base() / token
    if not d.is_dir():
        raise ValueError("Deze herstelsessie bestaat niet meer. Kies het bestand opnieuw.")
    return d


def close(token):
    try:
        shutil.rmtree(folder(token), ignore_errors=True)
    except ValueError:
        pass


def _read_json(upload, password):
    """The settings JSON out of an uploaded zip (or a plain .json of before), as text. Raises PasswordNeeded / WrongPassword / ValueError."""
    head = upload.read(4)
    upload.seek(0)
    if head[:2] != b"PK":
        return upload.read().decode("utf-8")
    try:
        z = pyzipper.AESZipFile(upload)
    except (pyzipper.BadZipFile, ValueError):
        raise ValueError("Dit is geen geldig zipbestand.")
    with z:
        names = [i for i in z.infolist() if not i.is_dir() and i.filename.endswith(".json")]
        if not names:
            raise ValueError("In deze zip zit geen instellingenbestand.")
        info = next((i for i in names if i.filename == INNER), names[0])
        if info.flag_bits & 0x1:
            if not password:
                raise PasswordNeeded()
            z.setpassword(password.encode())
        try:
            return z.read(info).decode("utf-8")
        except RuntimeError:
            raise WrongPassword()
        except (pyzipper.BadZipFile, ValueError):
            raise WrongPassword()


def open_restore(upload, password=""):
    """Read the zip, keep each part as its own file in a temporary folder. Returns (token, inspect-result)."""
    sweep()
    try:
        bundle = json.loads(_read_json(upload, password))
    except json.JSONDecodeError:
        raise ValueError("Dit bestand is geen geldig instellingenbestand.")
    info = backup.inspect(bundle)  # also checks that it is a settings file
    token = secrets.token_urlsafe(24)
    d = base() / token
    d.mkdir(mode=0o700)
    try:
        for key, part in bundle["sections"].items():
            (d / f"{re.sub(r'[^A-Za-z0-9_-]', '_', key)}.json").write_text(json.dumps({"key": key, "part": part}, ensure_ascii=False))
        (d / "meta.json").write_text(json.dumps({k: bundle.get(k) for k in ("format", "version", "exported_at", "secrets_included", "files_included")}))
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        raise
    return token, info


def load_part(token, key, mode, phase):
    """One part of an opened restore (its own request, so the screen can show progress)."""
    d = folder(token)
    d.touch()
    meta = json.loads((d / "meta.json").read_text())
    f = d / f"{re.sub(r'[^A-Za-z0-9_-]', '_', key)}.json"
    if not f.is_file():
        raise ValueError("Onderdeel niet in het bestand.")
    part = json.loads(f.read_text())["part"]
    return backup.load({**meta, "sections": {key: part}}, [key], mode, phase)


# ── remembered password (per person, encrypted on the server) ───────────────
def saved_password(user):
    from apps.integrations import crypto

    from .models import BackupPassword

    row = BackupPassword.objects.filter(user=user).first()
    return (crypto.decrypt(row.secret).get("password") or "") if row else ""


def save_password(user, password):
    from apps.integrations import crypto

    from .models import BackupPassword

    BackupPassword.objects.update_or_create(user=user, defaults={"secret": crypto.encrypt({"password": password})})


def forget_password(user):
    from .models import BackupPassword

    BackupPassword.objects.filter(user=user).delete()
