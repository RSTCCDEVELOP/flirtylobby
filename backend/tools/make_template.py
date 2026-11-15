# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes a web template (zip) from pages of this site, for resource/templates (see apps/core/templatepacks.py).

  venv/bin/python manage.py shell < tools/make_template.py            (reads the TEMPLATE dict below)
or
  TEMPLATE_KEY=studio TEMPLATE_NAME="Studio" TEMPLATE_PAGES=home-x,about venv/bin/python tools/make_template.py   (needs DJANGO_SETTINGS_MODULE)

Environment: TEMPLATE_KEY, TEMPLATE_NAME, TEMPLATE_DESC, TEMPLATE_AUTHOR, TEMPLATE_VERSION, TEMPLATE_PAGES (keys of own pages, comma separated),
TEMPLATE_THEME (key of an installed theme to bring along), TEMPLATE_COMPONENTS (key of a component set), TEMPLATE_PREVIEWS (image files, comma separated; without them one is drawn),
TEMPLATE_OUT (folder, default resource/templates)."""
import io
import json
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django  # noqa: E402

django.setup()

from apps.core import templatepacks as tp, themepacks  # noqa: E402
from apps.pages import portable  # noqa: E402
from apps.pages.models import Page  # noqa: E402


def drawn_preview(name, colors):
    from PIL import Image, ImageDraw

    im = Image.new("RGB", (1200, 750), colors[0])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1200, 70], fill=colors[1])
    for i, x in enumerate((60, 140, 220)):
        d.ellipse([x, 24, x + 22, 46], fill=colors[2 + i % 2])
    d.rectangle([80, 170, 700, 230], fill=colors[1])
    d.rectangle([80, 260, 600, 285], fill=colors[3])
    d.rectangle([80, 305, 540, 330], fill=colors[3])
    d.rounded_rectangle([80, 380, 300, 440], 14, fill=colors[2])
    d.rounded_rectangle([760, 150, 1120, 560], 18, fill=colors[4])
    for i in range(3):
        d.rounded_rectangle([80 + i * 340, 600, 380 + i * 340, 710], 14, fill=colors[4])
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def build(key, name, pages, desc="", author="", version="1.0.0", theme="", components="", previews=()):
    ps = list(Page.objects.filter(key__in=pages, kind="content"))
    if not ps:
        raise SystemExit("Geen eigen pagina's gevonden met deze keys.")
    ps.sort(key=lambda p: pages.index(p.key))
    parts = {p.key: portable.build(p, True) for p in ps}
    pbuf = io.BytesIO()
    with zipfile.ZipFile(pbuf, "w", zipfile.ZIP_DEFLATED) as z:
        for k, files in parts.items():
            for path, raw in files.items():
                z.writestr(f"{k}/{path}", raw)
        z.writestr(portable.MENU_FILE, json.dumps(portable.menu_file(ps), indent=2, ensure_ascii=False))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        man = {"format": tp.FORMAT, "version": 1, "key": key, "name": name, "description": desc, "version": version, "author": author, "pages": "pages.zip", "previews": []}
        if previews:
            for i, f in enumerate(previews):
                ext = Path(f).suffix.lower() or ".jpg"
                z.writestr(f"previews/{i + 1}{ext}", Path(f).read_bytes())
                man["previews"].append(f"previews/{i + 1}{ext}")
        else:
            z.writestr("previews/1.jpg", drawn_preview(name, ["#f7f5f2", "#1f2a37", "#f0833a", "#d9d6d1", "#ffffff"]))
            man["previews"].append("previews/1.jpg")
        if theme:
            z.writestr("theme.zip", themepacks.as_zip(theme))
            man["theme"] = "theme.zip"
        if components:
            man["components"] = components
        z.writestr("template.json", json.dumps(man, indent=2, ensure_ascii=False))
        z.writestr("pages.zip", pbuf.getvalue())
    data = out.getvalue()
    tp.read(data)  # it must pass its own check
    folder = Path(os.getenv("TEMPLATE_OUT") or ROOT / "resource" / "templates")
    folder.mkdir(parents=True, exist_ok=True)
    f = folder / f"{key}-{version}.zip"
    f.write_bytes(data)
    return f


if __name__ == "__main__":
    e = os.environ.get
    print(build(e("TEMPLATE_KEY", "mijn-template"), e("TEMPLATE_NAME", "Mijn template"), [x for x in (e("TEMPLATE_PAGES") or "").split(",") if x], e("TEMPLATE_DESC", ""), e("TEMPLATE_AUTHOR", ""),
                e("TEMPLATE_VERSION", "1.0.0"), e("TEMPLATE_THEME", ""), e("TEMPLATE_COMPONENTS", ""), [x for x in (e("TEMPLATE_PREVIEWS") or "").split(",") if x]))
