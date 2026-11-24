# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Example page layouts for a new page, in the style of the theme (the hero and the gaps of the theme).
A row is "hero" (the banner of the theme), a number (that many equal columns of text) or "66-33" / "33-66" (a wide and a narrow column)."""
from . import defaults

SAMPLES = {
    "empty": {"name": "Leeg", "info": "Een lege pagina: je bouwt alles zelf.", "rows": []},
    "text": {"name": "Tekstpagina", "info": "Een banner met een kolom tekst.", "rows": ["hero", 1]},
    "two": {"name": "Twee kolommen", "info": "Een banner met twee kolommen naast elkaar.", "rows": ["hero", 2]},
    "cards": {"name": "Drie kaarten", "info": "Een banner met drie kaarten.", "rows": ["hero", 3]},
    "split": {"name": "Tekst met zijbalk", "info": "Een brede kolom met een smalle ernaast.", "rows": ["hero", "66-33"]},
    "about": {"name": "Over ons", "info": "Een banner, een verhaal in twee kolommen en drie kaarten.", "rows": ["hero", 2, 3]},
    "landing": {"name": "Landingspagina", "info": "Een banner, drie kaarten, een tekst en vier punten.", "rows": ["hero", 3, 1, 4]},
}


def listing():
    return [{"key": k, "name": v["name"], "info": v["info"], "rows": v["rows"]} for k, v in SAMPLES.items()]


def build(page_key, sample, theme):
    """Gives the page the blocks of the example (and the Dutch texts to start with). Returns the layout data."""
    from apps.core.models import ContentBlock, Language
    from .models import PageLayout

    spec = defaults.THEME_LAYOUT.get(theme) or defaults.THEME_LAYOUT["normal"]
    gap = spec["gap"]
    rows, texts, n = [], {}, 0

    def cell(name, width="auto", halign="left", text=""):
        texts[defaults._id(page_key, name)] = text
        return {"id": defaults._id(page_key, f"cell-{name}"), "width": width, "halign": halign, "valign": "top", "items": [{"id": defaults._id(page_key, name), "type": "text", "ref": ""}]}

    for r in SAMPLES[sample]["rows"]:
        n += 1
        if r == "hero":
            rows.append(defaults.hero_row(page_key, theme))
            texts[defaults._id(page_key, "intro")] = "Welkom\nVertel hier in een paar zinnen waar deze pagina over gaat."
            continue
        widths = {"66-33": ["66", "33"], "33-66": ["33", "66"]}.get(r) or ["auto"] * int(r)
        cells = [cell(f"r{n}c{i}", w, text=f"Kop {i + 1}\nSchrijf hier je tekst." if len(widths) > 1 else "Kop\nSchrijf hier je tekst. Je kunt dit blok verplaatsen, aanpassen of verwijderen.") for i, w in enumerate(widths)]
        rows.append({"id": defaults._id(page_key, f"row-{n}"), "cols": len(cells), "width": "default", "gap": gap, "cells": cells, "bg": {}})
    data = {"rows": rows, "bg": {}, "preset": ""}
    PageLayout.objects.update_or_create(key=page_key, defaults={"data": data})
    for lang in Language.objects.values_list("code", flat=True):  # Dutch texts to start with (the same in every language until they are translated)
        for item_id, text in texts.items():
            if text:
                ContentBlock.objects.get_or_create(key=f"layout.{page_key}.{item_id}", lang=lang, defaults={"text": text})
    return data
