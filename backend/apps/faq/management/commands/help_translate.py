"""Translate the help texts of the edit mode (the "?" icon) into every language: reads /tmp/help_nl.json (key -> Dutch text), writes frontend/lib/help-i18n.json."""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.core import themeimport
from apps.core.models import Language
from apps.integrations import ai


class Command(BaseCommand):
    def add_arguments(self, p):
        p.add_argument("--src", default="/tmp/help_nl.json")

    def handle(self, *a, **o):
        src = json.loads(Path(o["src"]).read_text(encoding="utf-8"))
        out_file = Path(settings.BASE_DIR).parent / "frontend" / "lib" / "help-i18n.json"
        data = json.loads(out_file.read_text(encoding="utf-8")) if out_file.exists() else {}
        langs = [(l.code, l.name) for l in Language.objects.all() if l.code != "nl"]
        keys = [k for k in src if len(data.get(k, {})) < len(langs)]
        system = ("You translate short help tooltips of a website editor from Dutch. Keep the meaning and a friendly clear tone. Menu names like 'Admin → Pagina's → Menu' stay as written. "
                  "Answer with ONE JSON object only: {key: {code: translation}} for every key and requested language code.")
        for n in range(0, len(keys), 8):
            batch = keys[n:n + 8]
            prompt = json.dumps({"languages": [{"code": c, "name": nm} for c, nm in langs], "texts": {k: src[k] for k in batch}}, ensure_ascii=False)
            got = themeimport._parse_json(ai.claude(system, prompt, max_tokens=12000, timeout=180), need=tuple(batch[:1]))
            for k in batch:
                data[k] = {"nl": src[k], **{c: str(v).strip() for c, v in (got.get(k) or {}).items() if str(v).strip()}}
            out_file.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            self.stdout.write(f"{min(n + 8, len(keys))}/{len(keys)}")
