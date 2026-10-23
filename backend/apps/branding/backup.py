# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Logos and brand pictures (favicon, app icon, share image) and the home photos, carried inside the backup."""
import os

from apps.core.backup_files import Budget, read, write
from apps.core.settings_backup import register

from .models import HomePhoto, SiteAsset


def _export(opts):
    if not opts.get("include_files", True):
        return {"assets": [], "photos": [], "note": "files not included"}
    b = Budget()
    assets = [{"slot": a.slot, "file": os.path.basename(a.image.name), **(read(a.image.name, b) or {})} for a in SiteAsset.objects.all() if a.image]
    photos = [{"caption": p.caption, "order": p.order, "file": os.path.basename(p.image.name), **(read(p.image.name, b) or {})} for p in HomePhoto.objects.all() if p.image]
    return {"assets": [a for a in assets if "b64" in a], "photos": [p for p in photos if "b64" in p], "skipped": b.skipped}


def _apply(data, ctx):
    data = data or {}
    n = 0
    for a in data.get("assets", []):
        if not (a.get("slot") and a.get("b64")):
            continue
        name = write(f"branding/{os.path.basename(a.get('file') or a['slot'])}", a["b64"])
        SiteAsset.objects.update_or_create(slot=a["slot"], defaults={"image": name})
        n += 1
    m = 0
    for p in data.get("photos", []):
        if p.get("b64"):
            name = write(f"home/{os.path.basename(p.get('file') or 'photo')}", p["b64"])
            if not HomePhoto.objects.filter(image=name).exists():
                HomePhoto.objects.create(image=name, caption=p.get("caption", ""), order=int(p.get("order", 0) or 0))
                m += 1
    return f"{n} logo's/afbeeldingen en {m} homepagefoto's geladen." if (n or m) else "Geen bestanden in dit onderdeel."


def _add(data, ctx):
    have = set(SiteAsset.objects.values_list("slot", flat=True))
    return _apply({**(data or {}), "assets": [a for a in (data or {}).get("assets", []) if a.get("slot") not in have]}, ctx)


def _clear():
    HomePhoto.objects.all().delete()


register("branding", "Logo's en huisstijlafbeeldingen", _export, _apply, description="Logo, donkere logo, favicon, app-icoon, deelafbeelding en homepagefoto's (de bestanden zelf).", order=5, add=_add, clear=_clear)
