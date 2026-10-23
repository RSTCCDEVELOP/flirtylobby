# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
        p.add_argument("--only", default="", help="alleen deze ids (komma's), bijvoorbeeld adminmenu,supermenu")

    def handle(self, *a, **o):
        langs = [c for c in dict.fromkeys([*LANGS, *Language.objects.values_list("code", flat=True)]) if c != "nl"]
        names = {l.code: l.name for l in Language.objects.all()}
        try:
            data = json.loads(FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {"groups": {}, "items": {}}
        FILE.parent.mkdir(parents=True, exist_ok=True)
        only = {x.strip() for x in o["only"].split(",") if x.strip()}
        jobs = [("group", g, {"title": t}) for g, _lay, t, _art in GROUPS if (g in only) if only] if only else [("group", g, {"title": t}) for g, _lay, t, _art in GROUPS if o["all"] or len(data["groups"].get(g, {})) < len(langs)]
        jobs += [("item", i, {"q": q, "a": a}) for i, _lay, _g, _n, q, a in ITEMS if (i in only if only else (o["all"] or len((data["items"].get(i, {}).get("a") or {})) < len(langs)))]
        system = ("You translate help texts of a website management system (Easy2edit) from Dutch. Keep the meaning, a friendly clear tone, and keep product terms and menu names understandable. "
                  "Menu names in the interface such as 'Admin → Pagina's' stay as written. Answer with ONE JSON object only, no text around it: {id: {field: {code: translation}}} for every id and field given.")
        # small requests (2 texts x 11 languages) so an answer is never cut off; four at a time
        import threading
        import time
        from concurrent.futures import ThreadPoolExecutor

        from django.db import close_old_connections

        lock, state = threading.Lock(), {"done": 0, "failed": []}
        def missing(k, i, c):  # is this language still missing for this text?
            if k == "group":
                return c not in data["groups"].get(i, {})
            return c not in (data["items"].get(i, {}).get("a") or {}) or c not in (data["items"].get(i, {}).get("q") or {})

        calls = []
        for n in range(0, len(jobs), 1):
            batch = jobs[n:n + 1]
            todo = [c for c in langs if o["all"] or any(missing(k, i, c) for k, i, _f in batch)]
            calls += [(batch, todo[m:m + 11]) for m in range(0, len(todo), 11)]

        def work(call):
            batch, chunk = call
            payload = {f"{k}:{i}": f for k, i, f in batch}
            prompt = json.dumps({"languages": [{"code": c, "name": names.get(c, c)} for c in chunk], "texts": payload}, ensure_ascii=False)
            out, last = None, ""
            try:
                for _try in range(4):
                    try:
                        out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=8000, timeout=180), need=tuple(payload))
                        break
                    except ValueError as e:  # an overloaded or rate-limited answer: wait a little and try again
                        last = str(e)
                        time.sleep(6 * (_try + 1))
            finally:
                close_old_connections()
            with lock:
                state["done"] += 1
                if out is None:
                    state["failed"].append(", ".join(payload) + f" ({last})")
                else:
                    for k, i, f in batch:
                        got = out.get(f"{k}:{i}")
                        got = got if isinstance(got, dict) else {}
                        pick = lambda v: v if isinstance(v, dict) else {}  # noqa: E731 - Claude sometimes answers with a string where a dict is expected
                        if k == "group":
                            data["groups"].setdefault(i, {}).update({c: str(pick(got.get("title")).get(c) or "").strip() for c in chunk if pick(got.get("title")).get(c)})
                        else:
                            cur = data["items"].setdefault(i, {"q": {}, "a": {}})
                            for fld in ("q", "a"):
                                cur[fld].update({c: str(pick(got.get(fld)).get(c) or "").strip() for c in chunk if pick(got.get(fld)).get(c)})
                    FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
                self.stdout.write(f"{state['done']}/{len(calls)}")
                self.stdout.flush()

        with ThreadPoolExecutor(2) as pool:
            list(pool.map(work, calls))
        if state["failed"]:
            self.stdout.write(self.style.WARNING(f"Mislukt (opnieuw proberen): {'; '.join(state['failed'])}"))
