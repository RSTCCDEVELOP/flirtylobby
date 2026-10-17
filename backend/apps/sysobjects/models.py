from django.db import models


class SystemObject(models.Model):
    """An item of another module that can be put on a page in edit mode (a donation button, a subscription, …).
    The source (campaign, plan) says "System Object" with a checkbox; this registry is what the page editor offers."""

    KINDS = [("donation", "Donatie"), ("plan", "Abonnement")]
    kind = models.CharField(max_length=12, choices=KINDS)
    ref_id = models.PositiveIntegerField()
    slug = models.SlugField(max_length=80, unique=True)  # what the page stores: <div data-sysobject="slug">
    enabled = models.BooleanField(default=True)  # off = shown nowhere, also not on pages that contain it
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "slug"]
        unique_together = [("kind", "ref_id")]
