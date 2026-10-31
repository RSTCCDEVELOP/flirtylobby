# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Adds the English translation of every text of the interface that has none yet to frontend/public/locales/en.json (so the screenshots of the manual are in English).
Run:  cd backend && python manage.py shell -c "exec(open('../manuals/tools/fill_en.py').read())"
The texts are found in the frontend (tx("...") / t("...")); the AI translates them in batches; {0} placeholders must stay."""
import glob
import json
import os
import re
from pathlib import Path

from django.conf import settings

from apps.core import themeimport
from apps.integrations import ai

ROOT = Path(settings.BASE_DIR).parent
EN = ROOT / "frontend" / "public" / "locales" / "en.json"
en = json.loads(EN.read_text(encoding="utf-8"))
keys = set()
for f in glob.glob(str(ROOT / "frontend" / "**" / "*.js"), recursive=True):
    if "node_modules" in f or "/.next" in f or not os.path.isfile(f):
        continue
    for m in re.finditer(r"\btx?\(\s*(?:\"((?:[^\"\\]|\\.)*)\"|'((?:[^'\\]|\\.)*)')", open(f, errors="ignore").read()):
        k = (m.group(1) or m.group(2) or "").replace('\\"', '"').replace("\\'", "'")
        if k and re.search(r"[A-Za-zÀ-ÿ]", k):
            keys.add(k)
missing = sorted(k for k in keys if k not in en)
print("missing:", len(missing), flush=True)
SYS = ("You translate the interface texts of a CMS from Dutch to natural, concise English (UI style: short labels, sentence case). Keep placeholders like {0}, {1} exactly as they are, keep punctuation, keep brand and product names "
       "(Easy2edit, Stripe, Claude, Mollie), and do not translate technical tokens. Answer with ONE JSON object only: {\"translations\": {\"<dutch text>\": \"<english text>\", ...}} with exactly the keys you were given.")
BATCH = 90
done = 0
for i in range(0, len(missing), BATCH):
    chunk = missing[i:i + BATCH]
    try:
        out = themeimport._parse_json(ai.claude(SYS, json.dumps(chunk, ensure_ascii=False), max_tokens=7000, timeout=170), need=("translations",))
    except Exception as e:  # noqa: BLE001
        print("batch failed", i, e, flush=True)
        continue
    got = out.get("translations") or {}
    for k in chunk:
        v = got.get(k)
        if isinstance(v, str) and v.strip() and sorted(re.findall(r"\{\d+\}", v)) == sorted(re.findall(r"\{\d+\}", k)):
            en[k] = v.strip()
            done += 1
    EN.write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"batch {i // BATCH + 1}/{-(-len(missing) // BATCH)}: {done} translated", flush=True)
print("done", done, "of", len(missing))
