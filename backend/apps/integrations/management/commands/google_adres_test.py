# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A test call to the address search: with the link Google adressen (Admin -> API keys, or --key) through Google, without it through the free sources PDOK and OpenStreetMap.
`manage.py google_adres_test "RST Coaching Utrecht"`   `manage.py google_adres_test "RST Coaching 3542 DH"`"""
from django.core.management.base import BaseCommand, CommandError

from apps.integrations import addresssearch, googleplaces


class Command(BaseCommand):
    help = "Test call to the Google address search."

    def add_arguments(self, parser):
        parser.add_argument("query", nargs="?", default="RST Coaching Utrecht")
        parser.add_argument("--key", default="", help="a key to try without a link (not stored)")

    def handle(self, *a, **o):
        cfg = {"api_key": o["key"], "region": "NL", "language": "nl"} if o["key"] else googleplaces.settings()
        self.stdout.write(f"Zoeken: {o['query']!r}  |  bron: {'Google (sleutel)' if cfg else 'gratis bronnen (PDOK en OpenStreetMap)'}")
        try:
            found = googleplaces.search(o["query"], cfg=cfg) if cfg else addresssearch.free_search(o["query"])
        except ValueError as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"{len(found)} resultaten"))
        for r in found:
            self.stdout.write(f"  {r['naam'] or '-'}  |  {r['adres']}  |  {r['street']} {r['house_number']}, {r['postal_code']} {r['city']}, {r['country']}")
        if found and cfg:
            try:
                self.stdout.write(f"Details van de eerste: {googleplaces.place(found[0]['id'], cfg=cfg)}")
            except ValueError as e:
                raise CommandError(str(e))
