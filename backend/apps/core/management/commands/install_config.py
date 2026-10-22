"""Stel het systeem in met een installatieconfiguratie (JSON, gemaakt door de wizard): modules, plugins, namen, adres en licentie."""
import json

from django.core.management.base import BaseCommand, CommandError

from apps.core import pricing


class Command(BaseCommand):
    help = "install_config <bestand.json>: stel dit systeem in volgens een installatieconfiguratie van de wizard."

    def add_arguments(self, parser):
        parser.add_argument("file")

    def handle(self, *a, **o):
        try:
            cfg = json.load(open(o["file"], encoding="utf-8"))
            res = pricing.apply_config(cfg)
        except (OSError, ValueError) as e:
            raise CommandError(str(e))
        self.stdout.write(f"install_config: {len(res['modules_on'])} modules, plugins: {', '.join(res['plugins_on']) or '-'}" + (f"; niet geinstalleerd: {', '.join(res['plugins_missing'])}" if res["plugins_missing"] else ""))
