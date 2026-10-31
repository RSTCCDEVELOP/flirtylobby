# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""The manual of Easy2edit (English), made with the AI by `github_repo_list -m`: the PDF and the HTML manual. Plain files in the project folder `manuals/`."""
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_GET

DIR = Path(getattr(settings, "MANUALS_DIR", None) or settings.PROJECT_ROOT / "manuals")


@require_GET
def pdf(request):
    f = DIR / "pdf" / "manual_en.pdf"
    if not f.is_file():
        raise Http404("De handleiding ontbreekt.")
    return FileResponse(open(f, "rb"), content_type="application/pdf", as_attachment=True, filename="easy2edit-manual-en.pdf")


@xframe_options_exempt  # the HTML manual is shown in a pop-up (a frame) of the dashboard
@require_GET
def html(request, name="index.html"):
    if not re.fullmatch(r"[a-z0-9-]{1,40}\.html", name or ""):
        raise Http404()
    f = DIR / "html" / "en" / name
    if not f.is_file():
        raise Http404()
    return FileResponse(open(f, "rb"), content_type="text/html; charset=utf-8")
