# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class SystemObject(models.Model):
    """An item of another module that can be put on a page in edit mode (a donation button, a subscription, …).
    The source (campaign, plan) says "System Object" with a checkbox; this registry is what the page editor offers."""

    KINDS = [("donation", "Donatie"), ("plan", "Abonnement"), ("plugin", "Plugin"), ("plugin_item", "Onderdeel van een plugin"), ("plugin_part", "Pluginblok"), ("media", "Media"), ("calculator", "Calculatie"), ("marketing", "Marketing"), ("pricelist", "Prijslijst"), ("installation", "Standaardinstallatie"), ("ai", "AI-blok"), ("energy", "Energie"), ("variable", "Variabele"), ("widget", "Widget")]
    kind = models.CharField(max_length=12, choices=KINDS)
    ref_id = models.PositiveIntegerField()
    ref_key = models.CharField(max_length=60, blank=True)  # for a part of a plugin (a game): its name in the plugin folder
    slug = models.SlugField(max_length=80, unique=True)  # what the page stores: <div data-sysobject="slug">
    enabled = models.BooleanField(default=True)  # off = shown nowhere, also not on pages that contain it
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "slug"]
        unique_together = [("kind", "ref_id", "ref_key")]


class InstalledWidget(models.Model):
    """A widget of the library (<source>/widgets/<key>/) that an admin installed on this website. An installed widget is a system object (kind "widget"): it can be put on a page in the page editor.
    `options` are the settings that the admin chose (they apply wherever the widget is shown)."""

    key = models.SlugField(max_length=40, unique=True)
    enabled = models.BooleanField(default=True)
    options = models.JSONField(default=dict, blank=True)
    installed_at = models.DateTimeField(auto_now_add=True)

    @property
    def name(self):  # (the registry makes the address of the object from this: widget-<key>)
        return self.key

    class Meta:
        ordering = ["key"]
