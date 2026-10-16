from django.db import models


class Page(models.Model):
    """A page / menu item of the website. `system` = built into the app (Home, Producten, …), `content` = own page
    (text edited in edit mode, lives at /p/<key>), `link` = a link to any URL."""

    KINDS = [("system", "Systeempagina"), ("content", "Eigen pagina"), ("link", "Link")]
    AUDIENCE = [("all", "Iedereen"), ("members", "Alleen ingelogde users"), ("guests", "Alleen bezoekers (niet ingelogd)")]

    key = models.SlugField(max_length=60, unique=True)
    kind = models.CharField(max_length=8, choices=KINDS, default="content")
    title = models.JSONField(default=dict)  # {"nl": "...", "en": "..."}
    url = models.CharField(max_length=300, blank=True)  # system pages and links; content pages use /p/<key>
    module = models.CharField(max_length=50, blank=True)  # the page is only available while this module is on
    enabled = models.BooleanField(default=True)  # off = the page does not exist for visitors
    in_menu = models.BooleanField(default=False)  # shown in the header menu
    new_tab = models.BooleanField(default=False)
    audience = models.CharField(max_length=8, choices=AUDIENCE, default="all")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    order = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    @property
    def path(self):
        return f"/p/{self.key}" if self.kind == "content" else self.url
