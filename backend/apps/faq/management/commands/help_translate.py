# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Translate the help texts of the edit mode (the "?" icon) into every language: reads /tmp/help_nl.json (key -> Dutch text), writes frontend/lib/help-i18n.json.
Small parts (a few texts x a few languages) in parallel, with a new try when an answer cannot be read; what is done is saved as it goes. Run again to fill the gaps."""
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.core import themeimport
from apps.core.models import Language
from apps.integrations import ai

SYSTEM = ("You translate short help tooltips of a website editor from Dutch. Keep the meaning and a friendly clear tone. Menu names like 'Admin → Pagina's → Menu' stay as written. "
          "Answer with ONE JSON object only: {key: {code: translation}} for every key and requested language code.")


class Command(BaseCommand):
    def add_arguments(self, p):
        p.add_argument("--src", default="/tmp/help_nl.json")
        p.add_argument("--workers", type=int, default=4)

    def handle(self, *a, **o):
        src = json.loads(Path(o["src"]).read_text(encoding="utf-8"))
        out_file = Path(settings.BASE_DIR).parent / "frontend" / "lib" / "help-i18n.json"
        data = json.loads(out_file.read_text(encoding="utf-8")) if out_file.exists() else {}
        langs = [(l.code, l.name) for l in Language.objects.all() if l.code != "nl"]
        lock = threading.Lock()
        for k in src:  # the Dutch text is always the current one; the other languages are kept when they exist
            data.setdefault(k, {})["nl"] = src[k]
        todo = []
        keys = list(src)
        for i in range(0, len(keys), 3):
            batch = keys[i:i + 3]
            for j in range(0, len(langs), 11):
                part = [(c, n) for c, n in langs[j:j + 11] if any(c not in data[k] for k in batch)]
                if part:
                    todo.append((batch, part))
        self.stdout.write(f"{len(todo)} parts")
        done = [0]

        def work(item):
            batch, part = item
            prompt = json.dumps({"languages": [{"code": c, "name": n} for c, n in part], "texts": {k: src[k] for k in batch}}, ensure_ascii=False)
            for attempt in range(4):
                try:
                    got = themeimport._parse_json(ai.claude(SYSTEM, prompt, max_tokens=8000, timeout=150), need=tuple(batch[:1]))
                    break
                except ValueError:
                    time.sleep(2 + attempt * 3)
            else:
                return
            with lock:
                for k in batch:
                    for c, v in (got.get(k) or {}).items():
                        if isinstance(v, str) and v.strip() and c in {x for x, _ in part}:
                            data[k][c] = v.strip()
                done[0] += 1
                out_file.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
                self.stdout.write(f"done {done[0]}/{len(todo)}")
                self.stdout.flush()

        with ThreadPoolExecutor(max_workers=o["workers"]) as ex:
            list(ex.map(work, todo))
        missing = sum(1 for k in src for c, _ in langs if c not in data[k])
        self.stdout.write(f"ready; missing translations: {missing}")
