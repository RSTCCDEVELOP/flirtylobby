"""Translate the Dutch help texts (apps/faq/source.py) into every language of the system with Claude and store them in data/faq.json.
Only what is missing is translated; --all redoes everything."""
import json

from django.core.management.base import BaseCommand

from apps.core import themeimport
from apps.core.models import Language
from apps.faq.source import GROUPS, ITEMS
from apps.faq.views import FILE, LANGS
from apps.integrations import ai


class Command(BaseCommand):
    help = "Vertaal de FAQ naar alle talen."

    def add_arguments(self, p):
        p.add_argument("--all", action="store_true")

    def handle(self, *a, **o):
        langs = [c for c in dict.fromkeys([*LANGS, *Language.objects.values_list("code", flat=True)]) if c != "nl"]
        names = {l.code: l.name for l in Language.objects.all()}
        try:
            data = json.loads(FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {"groups": {}, "items": {}}
        FILE.parent.mkdir(parents=True, exist_ok=True)
        jobs = [("group", g, {"title": t}) for g, _lay, t, _art in GROUPS if o["all"] or len(data["groups"].get(g, {})) < len(langs)]
        jobs += [("item", i, {"q": q, "a": a}) for i, _lay, _g, _n, q, a in ITEMS if o["all"] or len((data["items"].get(i, {}).get("a") or {})) < len(langs)]
        system = ("You translate help texts of a website management system (Easy2edit) from Dutch. Keep the meaning, a friendly clear tone, and keep product terms and menu names understandable. "
                  "Menu names in the interface such as 'Admin → Pagina's' stay as written. Answer with ONE JSON object only, no text around it: {id: {field: {code: translation}}} for every id and field given.")
        for n in range(0, len(jobs), 4):
            batch = jobs[n:n + 4]
            payload = {f"{k}:{i}": f for k, i, f in batch}
            prompt = json.dumps({"languages": [{"code": c, "name": names.get(c, c)} for c in langs], "texts": payload}, ensure_ascii=False)
            out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=12000, timeout=180), need=tuple(payload))
            for k, i, f in batch:
                got = out.get(f"{k}:{i}") or {}
                if k == "group":
                    data["groups"][i] = {c: str(got.get("title", {}).get(c) or "").strip() for c in langs if (got.get("title") or {}).get(c)}
                else:
                    cur = data["items"].setdefault(i, {"q": {}, "a": {}})
                    for fld in ("q", "a"):
                        cur[fld].update({c: str(got.get(fld, {}).get(c) or "").strip() for c in langs if (got.get(fld) or {}).get(c)})
            FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            self.stdout.write(f"{min(n + 4, len(jobs))}/{len(jobs)}")
