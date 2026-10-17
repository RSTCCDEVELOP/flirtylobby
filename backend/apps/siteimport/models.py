from django.conf import settings
from django.db import models


class SiteImport(models.Model):
    """A website that was read in (from an address, a folder or a ZIP file). Everything created from it is tagged with
    `import:<id>` (pages, library pictures) so removing the import removes exactly that content again."""

    name = models.CharField(max_length=120)  # the name of the theme
    slug = models.CharField(max_length=60, blank=True, db_index=True)  # folder themes/<slug>/ with all files of this import
    status = models.CharField(max_length=10, default="imported")  # proposal (waiting for approval) | imported
    source = models.CharField(max_length=500)  # address, folder name or ZIP name
    kind = models.CharField(max_length=10)  # url | folder | zip
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    proposal = models.JSONField(default=dict, blank=True)  # what was found, until the user approves it
    theme = models.JSONField(default=dict, blank=True)  # {"values": {...theme values...}, "palette": [...], "fonts": [...], "dark": bool}
    theme_applied = models.BooleanField(default=False)
    theme_backup = models.JSONField(default=dict, blank=True)  # previous values of the keys the theme changed
    home = models.JSONField(default=dict, blank=True)  # {"title": "...", "html": "..."}
    home_applied = models.BooleanField(default=False)
    home_backup = models.JSONField(default=dict, blank=True)
    notes = models.JSONField(default=list, blank=True)  # what was skipped and why
    assets = models.JSONField(default=list, blank=True)  # [{"media": id, "role": "logo|favicon|icon|og_image|image", "name", "src"}]

    class Meta:
        ordering = ["-created_at", "-id"]

    @property
    def tag(self):
        return f"import:{self.id}"
