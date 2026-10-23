# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Create (or complete) the folder of one website: <SITE_DIR>/{Database,media,plugins,themes,content,public,private}. Safe to run again; nothing is overwritten.
With --move the existing data of an installation from before the split is moved into it (stop the servers first)."""
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

PARTS = ("Database", "media", "plugins", "themes", "content", "public", "private")


class Command(BaseCommand):
    help = "Maak de map van deze website aan (site/): Database, media, plugins, themes, content."

    def add_arguments(self, parser):
        parser.add_argument("--move", action="store_true", help="verplaats de bestaande Database/, plugins/, themes/ en backend/media naar site/ (stop eerst de servers)")

    def handle(self, *args, **opts):
        site = Path(settings.SITE_DIR)
        for p in PARTS:
            (site / p).mkdir(parents=True, exist_ok=True)
        (site / "README.md").write_text(README, encoding="utf-8") if not (site / "README.md").exists() else None
        self.stdout.write(f"Sitemap klaar: {site}")
        if not opts["move"]:
            return
        root = Path(settings.PROJECT_ROOT)
        for name, old in (("Database", root / "Database"), ("plugins", root / "plugins"), ("themes", root / "themes"), ("media", Path(settings.BASE_DIR) / "media"), ("content", root / "CONTENT")):
            if not old.exists() or old.resolve() == (site / name).resolve():
                continue
            for item in old.iterdir():
                target = site / name / item.name
                if target.exists():
                    self.stdout.write(f"  overgeslagen (bestaat al): {name}/{item.name}")
                    continue
                shutil.move(str(item), str(target))
                self.stdout.write(f"  verplaatst: {old.name}/{item.name} -> site/{name}/{item.name}")
        self.stdout.write("Klaar. Start de servers opnieuw.")


README = """# Deze website

Alles wat bij DEZE website hoort staat hier. Een update van het systeem (backend/ en frontend/) raakt deze map nooit.

- Database/   de database (sqlite) en de back-ups
- media/      geüploade afbeeldingen en video's
- plugins/    de plugins van deze site (ondertekend, uit plugins/.dist of ontwikkeld)
- themes/     de themapakketten van deze site
- public/     exports van pagina's van de website (public/<pagina>/)
- private/    exports van dashboardpagina's (private/<pagina>/)
- content/    exports, imports en losse bestanden (logo's, instellingen-exports)

Zet deze map in een eigen (privé) repository of maak er een back-up van. Een andere website = een andere site-map met dezelfde systeemcode.
"""
