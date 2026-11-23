# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A placeholder ("Component ontbreekt") is for the editor only: a visitor gets a layout without it."""
from apps.pages import layout as pl

PH = {"id": "a1", "type": "widget", "widget": "code", "data": {"html": '<div data-easy2edit-tag="placeholder" data-missing="x"><p>Component ontbreekt: X</p></div>', "css": ""}}
TXT = {"id": "b1", "type": "text", "ref": "t1"}


def _row(rid, *items):
    return {"id": rid, "cols": 1, "cells": [{"id": rid + "c", "items": list(items)}]}


def test_placeholders_are_stripped_and_a_block_with_only_a_placeholder_goes_away():
    data = {"rows": [_row("r1", TXT, PH), _row("r2", PH), _row("r3", TXT)], "bg": {}}
    out = pl.strip_placeholders(data)
    assert [r["id"] for r in out["rows"]] == ["r1", "r3"]
    assert out["rows"][0]["cells"][0]["items"] == [TXT]


def test_a_component_with_the_placeholder_tag_counts_too():
    assert pl.is_placeholder({"type": "widget", "widget": "code", "data": {"kit": True, "tag": "placeholder", "html": ""}})
    assert not pl.is_placeholder({"type": "widget", "widget": "code", "data": {"html": "<p>hi</p>"}})
    assert not pl.is_placeholder(TXT)


def test_a_visitor_does_not_get_it_but_an_empty_row_stays_when_nothing_was_removed(db):
    from django.test import Client

    from apps.pages.models import PageLayout

    PageLayout.objects.create(key="home", data={"rows": [_row("r1", TXT, PH), _row("r2")], "bg": {}})
    rows = Client().get("/api/pages/layout/home/").json()["rows"]
    assert [r["id"] for r in rows] == ["r1", "r2"] and rows[0]["cells"][0]["items"][0]["id"] == "b1" and len(rows[0]["cells"][0]["items"]) == 1
