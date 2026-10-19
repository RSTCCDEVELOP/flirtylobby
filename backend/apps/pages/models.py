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
    slugs = models.JSONField(default=dict, blank=True)  # the address in every language: {"nl": "abonnementen", "en": "subscriptions", ...}; they all lead to this one page
    scope = models.CharField(max_length=8, default="public", db_index=True)  # "public": the website (/p/<key>, header menu); "private": behind the login (/dashboard/<key>, menu of the dashboard)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    order = models.PositiveIntegerField(default=0)
    source = models.CharField(max_length=40, blank=True, db_index=True)  # "import:<id>" for pages that come from a site import
    background = models.JSONField(default=dict, blank=True)  # {"type": "image"|"video", "media": MediaItem id, "overlay": 0-0.9}
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def path_in(self, lang):
        """The address of this page in a language (zh and ar use the English one; the canonical one when there is none)."""
        sl = self.slugs or {}
        s = sl.get(lang) or (sl.get("en") if lang in ("zh", "ar") else "")
        if s and self.scope == "public" and self.kind in ("system", "content", "link"):
            return "/" + s.strip("/")
        return self.path

    def all_paths(self):
        """Every address that leads to this page (the canonical one first)."""
        out = [self.path]
        for s in (self.slugs or {}).values():
            if s and self.scope == "public":
                p = "/" + s.strip("/")
                if p not in out:
                    out.append(p)
        return out

    @property
    def path(self):
        if self.kind == "content":
            if self.scope == "private":
                return f"/dashboard/{self.key}"
            return self.url or f"/p/{self.key}"  # a standard page has an address of its own (/community), an own page /p/<key>
        return self.url


class PageLayout(models.Model):
    """The blocks of one page, built in edit mode: rows of columns (a grid) with items (text, picture, system object) in the cells.
    {"rows": [{"id", "cols": 1-4, "gap": "sm|md|lg", "cells": [{"id", "halign": left|center|right, "valign": top|center|bottom, "items": [{"id", "type": text|image|object, "ref"}]}]}]}"""

    key = models.CharField(max_length=80, unique=True)  # page key ("home", an own page key, …)
    data = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
