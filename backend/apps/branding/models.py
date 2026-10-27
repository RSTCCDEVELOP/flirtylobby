# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models

# slot -> (label, hint). Frontend uses these keys.
SLOTS = {
    "logo": ("Logo", "Voor lichte achtergrond. PNG/WebP met transparante achtergrond."),
    "logo_dark": ("Logo (donkere modus)", "Optioneel: logo voor donkere achtergrond."),
    "header_logo": ("Header-logo", "Optioneel: eigen logo in de header van de website (lichte modus). Zonder upload geldt het logo."),
    "header_logo_dark": ("Header-logo (donkere modus)", "Optioneel: header-logo voor de donkere modus. Zonder upload geldt het logo (donkere modus)."),
    "favicon": ("Favicon", "Icoon in het browsertabblad. Vierkant, 64×64 of groter (PNG/ICO)."),
    "icon": ("App-icoon", "Voor iPhone/Android-startscherm. Vierkant PNG, 512×512."),
    "og_image": ("Deelafbeelding", "Getoond bij delen op social media. 1200×630."),
}


def branding_path(instance, filename):
    from apps.medialib import areas

    return areas.site_path("branding", filename)


def home_path(instance, filename):
    from apps.medialib import areas

    return areas.site_path("home", filename)


class SiteAsset(models.Model):
    slot = models.CharField(max_length=30, unique=True)
    image = models.ImageField(upload_to=branding_path)
    updated_at = models.DateTimeField(auto_now=True)


class HomePhoto(models.Model):
    image = models.ImageField(upload_to=home_path)
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
