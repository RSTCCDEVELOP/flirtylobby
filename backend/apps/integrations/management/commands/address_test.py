# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A test call to the address search (free sources PDOK and OpenStreetMap).
`manage.py address_test "bol.com Utrecht"`   `manage.py address_test "3542 DH 46"`"""
from django.core.management.base import BaseCommand, CommandError

from apps.integrations import addresssearch


class Command(BaseCommand):
    help = "Test call to the address search."

    def add_arguments(self, parser):
        parser.add_argument("query", nargs="?", default="bol.com Utrecht")

    def handle(self, *a, **o):
        self.stdout.write(f"Zoeken: {o['query']!r}  |  bron: PDOK en OpenStreetMap")
        try:
            found = addresssearch.free_search(o["query"])
        except ValueError as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"{len(found)} resultaten"))
        for r in found:
            self.stdout.write(f"  {r['naam'] or '-'}  |  {r['adres']}  |  {r['street']} {r['house_number']}, {r['postal_code']} {r['city']}, {r['country']}")
