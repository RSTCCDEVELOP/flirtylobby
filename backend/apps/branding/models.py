from django.db import models

# slot -> (label, hint). Frontend uses these keys.
SLOTS = {
    "logo": ("Logo", "Voor lichte achtergrond. PNG/WebP met transparante achtergrond."),
    "logo_dark": ("Logo (donkere modus)", "Optioneel: logo voor donkere achtergrond."),
    "favicon": ("Favicon", "Icoon in het browsertabblad. Vierkant, 64×64 of groter (PNG/ICO)."),
    "icon": ("App-icoon", "Voor iPhone/Android-startscherm. Vierkant PNG, 512×512."),
    "og_image": ("Deelafbeelding", "Getoond bij delen op social media. 1200×630."),
}


class SiteAsset(models.Model):
    slot = models.CharField(max_length=30, unique=True)
    image = models.ImageField(upload_to="branding/")
    updated_at = models.DateTimeField(auto_now=True)


class HomePhoto(models.Model):
    image = models.ImageField(upload_to="home/")
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
