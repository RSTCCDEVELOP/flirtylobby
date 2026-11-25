# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Repairs the components of the standard set whose html was cut off (13 of them ended halfway: one stat of four, one alert, no closing tags). The cut-off html is completed with the missing
items and closing tags, so the templates that the creator copies and the preview in the editor are complete. Writes the next version of resource/components/easy2edit-ui-kit-<version>.zip.

  venv/bin/python tools/make_kit_repair.py     (from backend/; run it after make_kit_heroes.py and before make_kit_variants.py)

A component that is already complete (balanced tags) is left alone, so the tool can be run again."""
import json
import re
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "resource" / "components"
KEY = "easy2edit-ui-kit"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class _Stack(HTMLParser):
    def __init__(self):
        super().__init__()
        self.st = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.st.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID or tag not in self.st:
            return
        while self.st and self.st.pop() != tag:
            pass


def open_tags(html):
    p = _Stack()
    p.feed(html)
    p.close()
    return p.st


def close_all(html):
    """The html with the tags that were left open closed (inner first)."""
    return html + "".join(f"</{t}>" for t in reversed(open_tags(html)))


ALERT = '<div class="e2e-alert {c}" role="{r}"><span class="e2e-alert__icon">{i}</span><div><strong>{t}</strong><p>{p}</p></div></div>'
ICON = '<div class="e2e-contact-item"><div class="e2e-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{svg}</svg></div><div><strong>{t}</strong><p>{p}</p></div></div>'
STAT = '<div class="e2e-stat"><div class="e2e-stat__value">{v}</div><div class="e2e-stat__label">{l}</div></div>'
FIELD = '<div class="e2e-field"><div class="e2e-row" style="justify-content:space-between"><span class="e2e-label">{l}</span><small>{v}%</small></div><div class="e2e-progress" role="progressbar" aria-valuenow="{v}" aria-valuemin="0" aria-valuemax="100"><span style="width:{v}%"></span></div></div>'
LI = '<li><div class="e2e-date"><small>{m}</small><b>{d}</b></div><div class="e2e-agenda__body"><h4>{t}</h4><div class="e2e-meta"><span>🕘 {h}</span><span>📍 {p}</span></div></div></li>'
TASK = '<div class="e2e-task" draggable="true"><span class="e2e-badge{c}" style="align-self:start">{b}</span>{t}<div class="e2e-task__foot"><span>📅 {d}</span><span class="e2e-avatar e2e-avatar--sm">{a}</span></div></div>'
COL = '<div class="e2e-kanban__col" data-col="{k}"><div class="e2e-kanban__head" style="--_c:var(--e2e-{c})"><span>{n}</span><span class="e2e-badge{bc}" data-count>1</span></div>{task}</div>'

# tag -> (how many of the open tags stay open, what is added after the cut-off item is closed). The rest is closed afterwards.
PLAN = {
    "ui-alerts": (2, ALERT.format(c="e2e-alert--success", r="status", i="✓", t="Gelukt", p="Het bericht is verstuurd.") + ALERT.format(c="e2e-alert--warning", r="alert", i="!", t="Let op", p="Je abonnement loopt over drie dagen af.") + ALERT.format(c="e2e-alert--danger", r="alert", i="×", t="Mislukt", p="De betaling is niet gelukt. Probeer het opnieuw.")),
    "ui-stats": (3, STAT.format(v="12k", l="Bezoekers per maand") + STAT.format(v="98%", l="Tevreden klanten") + STAT.format(v="24/7", l="Altijd bereikbaar")),
    "ui-contact": (3, ICON.format(svg='<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', t="Telefoon", p="030 123 45 67")
                   + ICON.format(svg='<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', t="Adres", p="Voorbeeldstraat 1, 3511 AA Utrecht") + "</div>"
                   '<form class="e2e-card e2e-stack" style="padding:1.6rem"><div class="e2e-field"><label class="e2e-label">Naam</label><input class="e2e-input" placeholder="Je naam"></div><div class="e2e-field"><label class="e2e-label">E-mail</label><input class="e2e-input" type="email" placeholder="jij@voorbeeld.nl"></div><div class="e2e-field"><label class="e2e-label">Bericht</label><textarea class="e2e-textarea" rows="4" placeholder="Waar kunnen we mee helpen?"></textarea></div><button type="button" class="e2e-btn e2e-btn--block">Versturen</button></form>'),
    "ui-progress": (2, FIELD.format(l="Opslag gebruikt", v=45) + FIELD.format(l="Doel behaald", v=90)),
    "ui-agenda": (2, LI.format(m="nov", d="27", t="Workshop webdesign", h="19:00 – 21:30", p="Online") + LI.format(m="dec", d="04", t="Netwerkborrel", h="17:00 – 20:00", p="Amersfoort")),
    "ui-kanban": (3, TASK.format(c=" e2e-badge--neutral", b="Content", t="Teksten schrijven", d="19 nov", a="AK") + TASK.format(c=" e2e-badge--neutral", b="Techniek", t="Hosting regelen", d="21 nov", a="JD") + "</div>"
                  + COL.format(k="doing", c="primary", n="Bezig", bc="", task=TASK.format(c=" e2e-badge--warning", b="Ontwikkeling", t="Contactformulier bouwen", d="22 nov", a="JD"))
                  + COL.format(k="done", c="success", n="Klaar", bc=" e2e-badge--success", task=TASK.format(c=" e2e-badge--success", b="Content", t="Teksten nalopen", d="15 nov", a="AK"))),
    "ui-cards": (2, ""),
    "ui-footer": (3, '<div class="e2e-footer__bottom"><span>© 2026 Bedrijfsnaam</span><ul class="e2e-footer__legal"><li><a href="#">Privacy</a></li><li><a href="#">Cookies</a></li><li><a href="#">Voorwaarden</a></li></ul></div>'),
}


CSS_MARK = "/* ===== HERSTEL: VOETREGEL */"
CSS = CSS_MARK + "\n.e2e-footer__bottom ul{display:flex;flex-wrap:wrap;gap:1.2rem;list-style:none;margin:0;padding:0}\n"


def repaired(c):
    """(html, changed): the html of a component, completed when it was cut off (a cut-off html ends with the closing tag of the wrapper, put there by the maker)."""
    h = c["html"]
    if not open_tags(h):
        return h, False
    core = h[:-len("\n</div>")] if h.endswith("\n</div>") else h
    keep, extra = PLAN.get(c["easy2edit_tag"], (None, ""))
    if keep is not None:
        core += "".join(f"</{t}>" for t in reversed(open_tags(core)[keep:])) + extra
    return close_all(core), True


def main():
    zips = sorted(LIB.glob(f"{KEY}-*.zip"))
    if not zips:
        sys.exit("Geen easy2edit-ui-kit zip in resource/components.")
    z = zipfile.ZipFile(zips[-1])
    man = json.loads(z.read("components.json"))
    css, js = z.read("components.css").decode(), z.read("components.js").decode()
    css = css.split(CSS_MARK)[0].rstrip() + "\n" + CSS
    fixed = []
    for c in man["components"]:
        h, changed = repaired(c)
        if changed:
            c["html"] = h
            fixed.append(c["easy2edit_tag"])
    if not fixed:
        print("Alle onderdelen zijn compleet.")
        return
    left = [c["easy2edit_tag"] for c in man["components"] if open_tags(c["html"])]
    if left:
        sys.exit(f"Nog niet in orde: {left}")
    major, minor, patch = (int(x) for x in str(man["version"]).split("."))
    man["version"] = f"{major}.{minor}.{patch + 1}"
    out = LIB / f"{KEY}-{man['version']}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as w:
        w.writestr("components.json", json.dumps(man, indent=2, ensure_ascii=False))
        w.writestr("components.css", css)
        w.writestr("components.js", js)
    for old in LIB.glob(f"{KEY}-*.zip"):
        if old != out:
            old.unlink()
    print(out.name, "hersteld:", ", ".join(fixed))


if __name__ == "__main__":
    main()
