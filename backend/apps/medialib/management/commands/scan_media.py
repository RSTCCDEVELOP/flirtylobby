from django.core.management.base import BaseCommand

from apps.medialib import service


class Command(BaseCommand):
    help = "Register files in MEDIA_ROOT that are not in the media library yet."

    def handle(self, *args, **options):
        self.stdout.write(f"{service.scan()} bestand(en) toegevoegd aan de mediabibliotheek.")
