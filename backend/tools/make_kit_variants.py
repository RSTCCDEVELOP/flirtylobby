# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes the other component sets of the library from the standard set: the same components (the same easy2edit_tag and html), another look.

  venv/bin/python tools/make_kit_variants.py     (from backend/; run it after make_kit_extra.py)

A set is a zip with components.json, components.css and components.js; these variants add css at the end of the standard css, so they take the colours and fonts of the theme like the standard set."""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "resource" / "components"
BASE = "easy2edit-ui-kit"

SURFACES = ".e2e-linklist,.e2e-tagadd,.e2e-colorpick__pop,.e2e-card,.e2e-price,.e2e-panel,.e2e-chartcard,.e2e-detail,.e2e-recform,.e2e-login,.e2e-cart,.e2e-profile,.e2e-trend,.e2e-newsletter,.e2e-slide,.e2e-process li,.e2e-table-wrap,.e2e-accordion,.e2e-mini,.e2e-cal,.e2e-sched,.e2e-reclist,.e2e-notes,.e2e-sidemenu,.e2e-sechead,.e2e-statbox,.e2e-stat,.e2e-cal-toolbar,.e2e-filterbar,.e2e-alert,.e2e-modal"
FIELDS = ".e2e-input,.e2e-select,.e2e-textarea"
BUTTONS = ".e2e-btn"
BADGES = ".e2e-badge"

VARIANTS = [
    {"key": "easy2edit-ui-zacht", "name": "easy2edit Zacht", "description": "Zachte, ronde onderdelen: kaarten zonder rand met een zachte schaduw, gevulde velden en ronde knoppen.",
     "css": f"""
/* ===== VARIANT ZACHT ===== */
{SURFACES}{{border-color:transparent;box-shadow:0 6px 24px color-mix(in srgb,var(--e2e-text) 9%,transparent);border-radius:calc(var(--e2e-radius-lg) + 6px)}}
{FIELDS}{{background:var(--e2e-surface);border:1.5px solid transparent;border-radius:999px;padding-inline:1.2em}}
.e2e-textarea{{border-radius:calc(var(--e2e-radius-lg) + 2px)}}
{FIELDS.replace(',', ':focus,')}:focus{{background:var(--e2e-bg);border-color:var(--e2e-primary)}}
{BUTTONS}{{border-radius:999px;box-shadow:0 4px 14px color-mix(in srgb,var(--e2e-primary) 30%,transparent)}}
.e2e-btn--outline,.e2e-btn--ghost{{box-shadow:none}}
{BADGES}{{border-radius:999px}}
.e2e-hero-split,.e2e-hero-center{{}}
"""},
    {"key": "easy2edit-ui-strak", "name": "easy2edit Strak", "description": "Strakke, vierkante onderdelen met dunne lijnen, zonder schaduw, hoofdletters op knoppen en koppen met ruimte tussen de letters.",
     "css": f"""
/* ===== VARIANT STRAK ===== */
{SURFACES}{{border-radius:0;box-shadow:none;border-width:1px;border-color:color-mix(in srgb,var(--e2e-text) 22%,var(--e2e-bg))}}
{FIELDS}{{border-radius:0;border-width:1px;border-color:color-mix(in srgb,var(--e2e-text) 35%,var(--e2e-bg))}}
{BUTTONS}{{border-radius:0;text-transform:uppercase;letter-spacing:.09em;font-size:.82rem;font-weight:700;box-shadow:none}}
{BADGES}{{border-radius:0;text-transform:uppercase;letter-spacing:.08em;font-size:.68rem}}
.e2e-eyebrow{{letter-spacing:.2em}}
.e2e-card__media,.e2e-split__media,.e2e-gallery img,.e2e-gallery__img,.e2e-avatar{{border-radius:0}}
.e2e-tabs__tab{{border-radius:0!important;text-transform:uppercase;letter-spacing:.08em;font-size:.82rem}}
.e2e-bar>i,.e2e-track,.e2e-track>i,.e2e-chip,.e2e-sched__ev{{border-radius:0}}
"""},
    {"key": "easy2edit-ui-speels", "name": "easy2edit Speels", "description": "Speelse onderdelen met dikke randen en een stevige schaduw naast het onderdeel, opvallende knoppen en ronde hoeken.",
     "css": f"""
/* ===== VARIANT SPEELS ===== */
{SURFACES}{{border:2px solid var(--e2e-text);box-shadow:5px 5px 0 var(--e2e-text);border-radius:calc(var(--e2e-radius-lg) + 2px)}}
{FIELDS}{{border:2px solid var(--e2e-text);border-radius:var(--e2e-radius);box-shadow:3px 3px 0 var(--e2e-text)}}
{BUTTONS}{{border:2px solid var(--e2e-text);color:var(--e2e-text);background:var(--e2e-primary);box-shadow:4px 4px 0 var(--e2e-text);font-weight:800;transition:transform .12s,box-shadow .12s}}
.e2e-btn:hover{{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--e2e-text)}}
.e2e-btn--outline,.e2e-btn--ghost{{background:var(--e2e-bg)}}
{BADGES}{{border:2px solid var(--e2e-text);background:var(--e2e-bg);color:var(--e2e-text)}}
.e2e-badge--solid{{background:var(--e2e-primary)}}
.e2e-bar>i,.e2e-track,.e2e-track>i{{border:2px solid var(--e2e-text)}}
.e2e-card--hover:hover,.e2e-price:hover{{transform:translate(-2px,-2px);box-shadow:8px 8px 0 var(--e2e-text)}}
"""},
    {"key": "easy2edit-ui-glas", "name": "easy2edit Glas", "description": "Doorzichtige onderdelen met een vervaagde achtergrond en dunne lichte randen; mooi op een foto of kleurvlak.",
     "css": f"""
/* ===== VARIANT GLAS ===== */
{SURFACES}{{background:color-mix(in srgb,var(--e2e-bg) 62%,transparent);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1px solid color-mix(in srgb,var(--e2e-text) 14%,transparent);box-shadow:0 10px 30px color-mix(in srgb,var(--e2e-text) 10%,transparent)}}
{FIELDS}{{background:color-mix(in srgb,var(--e2e-bg) 55%,transparent);border:1px solid color-mix(in srgb,var(--e2e-text) 20%,transparent);backdrop-filter:blur(8px)}}
{BUTTONS}{{backdrop-filter:blur(6px)}}
.e2e-btn--outline,.e2e-btn--ghost{{background:color-mix(in srgb,var(--e2e-bg) 45%,transparent)}}
{BADGES}{{backdrop-filter:blur(6px)}}
.e2e-table-wrap .e2e-table thead th{{background:color-mix(in srgb,var(--e2e-surface) 60%,transparent)}}
"""},
]


def main():
    src = sorted(LIB.glob(f"{BASE}-*.zip"))
    if not src:
        raise SystemExit("De standaardset ontbreekt (draai eerst make_kit_extra.py).")
    z = zipfile.ZipFile(src[-1])
    man = json.loads(z.read("components.json"))
    css, js = z.read("components.css").decode(), z.read("components.js").decode()
    for v in VARIANTS:
        for old in LIB.glob(f"{v['key']}-*.zip"):
            old.unlink()
        css_v = css.split("/* ===== VARIANT")[0].rstrip() + "\n" + v["css"]
        m = {**man, "key": v["key"], "name": v["name"], "description": v["description"], "version": "1.0.8"}
        out = LIB / f"{v['key']}-1.0.8.zip"
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as w:
            w.writestr("components.json", json.dumps(m, indent=2, ensure_ascii=False))
            w.writestr("components.css", css_v)
            w.writestr("components.js", js)
        print(out.name, len(m["components"]), "components")


if __name__ == "__main__":
    main()
