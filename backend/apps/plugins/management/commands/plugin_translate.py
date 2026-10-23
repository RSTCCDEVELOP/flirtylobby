# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import json
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.plugins import installer

# the texts of a plugin that have to be translated: t("…") in its pages, T("…") in plugin.py, and the texts in plugin.json
JS_T = re.compile(r"""\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')""")
PY_T = re.compile(r"""\bT\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')""")


def unescape(s):
    return json.loads('"' + s.replace('"', '\\"').replace("\\'", "'") + '"') if "\\" in s else s


def collect(folder):
    """Every Dutch text of the plugin that needs a translation."""
    folder, keys = Path(folder), set()
    for f in folder.rglob("*"):
        rel = f.relative_to(folder).parts
        if not f.is_file() or rel[0] in ("lang", "__pycache__") or f.name == "plugin.sig":
            continue
        if f.suffix in (".html", ".js", ".htm"):
            keys |= {unescape(a or b) for a, b in JS_T.findall(f.read_text(errors="replace"))}
        elif f.suffix == ".py":
            keys |= {unescape(a or b) for a, b in PY_T.findall(f.read_text(errors="replace"))}
    try:
        man = json.loads((folder / "plugin.json").read_text())
        keys |= {x for x in (man.get("title"), man.get("description"), (man.get("menu") or {}).get("label")) if x}
        for c in man.get("config", []):
            keys |= {x for x in (c.get("label"), c.get("hint")) if x} | set(c.get("options") or [])
    except (OSError, ValueError):
        pass
    return sorted(k for k in keys if k and re.search(r"[A-Za-zÀ-ÿ]", k))


def system_dictionary(code):
    f = Path(settings.PROJECT_ROOT) / "frontend" / "public" / "locales" / f"{code}.json"
    try:
        return json.loads(f.read_text())
    except (OSError, ValueError):
        return {}


def biggest_object(raw):
    """The JSON object with the most entries in an answer (Claude sometimes writes a broken first try before the real one)."""
    dec, best = json.JSONDecoder(), None
    for m in re.finditer(r"\{", raw):
        try:
            obj, _ = dec.raw_decode(raw[m.start():])
        except ValueError:
            continue
        if isinstance(obj, dict) and (best is None or len(obj) > len(best)):
            best = obj
    if best is None:
        raise ValueError("geen JSON in het antwoord")
    return best


def fill(folder, ask_ai=True, out=None):
    """Write <plugin>/lang/<code>.json for every language of the system: own translations stay, the rest comes from the system's own texts, then from Claude when linked.
    Returns {code: [missing keys]}."""
    folder, keys = Path(folder), collect(folder)
    lang = folder / "lang"
    lang.mkdir(exist_ok=True)
    (lang / "nl.json").write_text(json.dumps({k: k for k in keys}, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    missing = {}
    for code in installer.languages():
        if code == "nl":
            continue
        f = lang / f"{code}.json"
        cur = json.loads(f.read_text()) if f.is_file() else {}
        sysd = system_dictionary(code)
        for k in keys:
            if not cur.get(k) and sysd.get(k):
                cur[k] = sysd[k]
        todo = [k for k in keys if not cur.get(k)]
        if todo and ask_ai:
            try:
                from concurrent.futures import ThreadPoolExecutor

                from apps.integrations import ai

                if ai.available():
                    def chunk(part):  # a few texts per request: one big request is cut off by the answer limit and gives nothing at all
                        for _try in range(2):
                            try:
                                raw = ai.claude(f"Translate these Dutch interface texts for a website into the language with code '{code}'. Keep {{0}}, {{1}} placeholders and punctuation. Answer ONLY with a JSON object {{dutch: translation}}.",
                                                json.dumps(part, ensure_ascii=False), 4000)
                                return biggest_object(raw)
                            except Exception as e:  # noqa: BLE001
                                err = e
                        if len(part) > 3:  # still no valid answer: try it in smaller pieces
                            half = len(part) // 2
                            return {**chunk(part[:half]), **chunk(part[half:])}
                        if out:
                            out.write(f"  ({code}) een deel vertalen lukte niet: {err}")
                        return {}

                    parts = [todo[i:i + 30] for i in range(0, len(todo), 30)]
                    with ThreadPoolExecutor(4) as pool:
                        for got in pool.map(chunk, parts):
                            for k in todo:
                                if isinstance(got.get(k), str) and got[k].strip():
                                    cur[k] = got[k]
            except Exception as e:  # noqa: BLE001
                if out:
                    out.write(f"  ({code}) vertalen met Claude lukte niet: {e}")
        f.write_text(json.dumps({k: cur[k] for k in sorted(cur) if k in keys}, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
        missing[code] = [k for k in keys if not cur.get(k)]
    return missing


class Command(BaseCommand):
    help = "Provide a plugin with all languages of the system: collects its texts and fills lang/<code>.json (own translations, the system's texts, Claude)."

    def add_arguments(self, parser):
        parser.add_argument("name")
        parser.add_argument("--no-ai", action="store_true")

    def handle(self, *a, **o):
        folder = installer.plugin_dir(o["name"])
        if not (folder / "plugin.json").is_file():
            raise CommandError(f"Geen plugin gevonden in {folder}.")
        missing = fill(folder, not o["no_ai"], self.stdout)
        total = len(collect(folder))
        for code, ks in missing.items():
            self.stdout.write(f"{code}: {total - len(ks)}/{total}" + (f"  ontbreekt: {len(ks)}" if ks else "  compleet"))
        if any(missing.values()):
            self.stdout.write(self.style.WARNING("Vul de ontbrekende teksten in lang/<code>.json aan (of koppel Claude) en draai dit nog eens."))
