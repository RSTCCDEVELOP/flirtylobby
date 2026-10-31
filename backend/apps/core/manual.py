# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""The manual of Easy2edit in English and Dutch (made with the AI by `github_repo_list -m`): the PDF, the HTML manual, its screenshots and the instruction videos. Plain files in the project folder `manuals/`."""
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_GET

DIR = Path(getattr(settings, "MANUALS_DIR", None) or settings.PROJECT_ROOT / "manuals")
LANGS = ("en", "nl")


def _lang(lang):
    if lang not in LANGS:
        raise Http404()
    return lang


@require_GET
def pdf(request, lang="en"):
    f = DIR / "pdf" / f"manual_{_lang(lang)}.pdf"
    if not f.is_file():
        raise Http404("De handleiding ontbreekt.")
    return FileResponse(open(f, "rb"), content_type="application/pdf", as_attachment=True, filename=f"easy2edit-manual-{lang}.pdf")


@xframe_options_exempt  # the HTML manual is shown in a pop-up (a frame) of the dashboard
@require_GET
def html(request, lang="en", name="index.html"):
    if not re.fullmatch(r"[a-z0-9-]{1,40}\.html", name or ""):
        raise Http404()
    f = DIR / "html" / _lang(lang) / name
    if not f.is_file():
        raise Http404()
    return FileResponse(open(f, "rb"), content_type="text/html; charset=utf-8")


@xframe_options_exempt
@require_GET
def image(request, lang, name):
    """A screenshot of the manual (manuals/html/<lang>/images/<name>.jpg)."""
    if not re.fullmatch(r"[a-z0-9-]{1,60}\.jpg", name or ""):
        raise Http404()
    f = DIR / "html" / _lang(lang) / "images" / name
    if not f.is_file():
        raise Http404()
    return FileResponse(open(f, "rb"), content_type="image/jpeg")


@xframe_options_exempt
@require_GET
def video(request, lang, name):
    """An instruction video of the manual (manuals/video/<lang>/<name>.mp4 or .jpg); with Range support, so it can be played and skipped in every browser."""
    if not re.fullmatch(r"[a-z0-9-]{1,60}\.(mp4|jpg)", name or ""):
        raise Http404()
    f = DIR / "video" / _lang(lang) / name
    if not f.is_file():
        raise Http404()
    ctype = "video/mp4" if name.endswith(".mp4") else "image/jpeg"
    size = f.stat().st_size
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", request.headers.get("Range", ""))
    if not m or ctype != "video/mp4":
        r = FileResponse(open(f, "rb"), content_type=ctype)
        r["Accept-Ranges"] = "bytes"
        return r
    start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
    end = min(int(m.group(2)), size - 1) if m.group(1) and m.group(2) else size - 1
    if start > end or start >= size:
        r = HttpResponse(status=416)
        r["Content-Range"] = f"bytes */{size}"
        return r
    with open(f, "rb") as fh:
        fh.seek(start)
        data = fh.read(end - start + 1)
    r = HttpResponse(data, status=206, content_type=ctype)
    r["Content-Range"] = f"bytes {start}-{end}/{size}"
    r["Accept-Ranges"] = "bytes"
    return r
