# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The data of the widgets: a widget that names a provider gets the database content of that plugin (or of the system) when it is on, in window.WIDGET_DATA; without the plugin it is inactive."""
import json
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.sysobjects import widgetdata, widgets


class FakeQS(list):
    """A list that answers the few queryset calls of the providers."""

    def filter(self, *a, **k):
        return self

    def order_by(self, *a):
        return self


class FakeModel:
    def __init__(self, rows):
        self.objects = FakeQS(rows)


def _obj(**kw):
    return type("Row", (), kw)()


@pytest.fixture
def lib(settings, tmp_path):
    settings.SOURCE_DIR = tmp_path
    d = tmp_path / "widgets" / "demo"
    d.mkdir(parents=True)
    (d / "widget.json").write_text(json.dumps({"key": "demo", "name": "Demo", "description": "x", "category": "Test", "data": {"provider": "entity"}, "options": [{"key": "source", "label": "Bron", "type": "choice", "default": "auto", "choices": [{"value": "auto", "label": "Auto"}, {"value": "own", "label": "Eigen"}]}]}))
    (d / "widget.html").write_text("<p>hoi</p>")
    (d / "widget.css").write_text("")
    (d / "widget.js").write_text("")
    return tmp_path


def test_without_the_plugin_a_provider_is_inactive_and_never_breaks():
    for p in ("faq", "webshop", "agenda"):
        d = widgetdata.get(p)
        assert d["provider"] == p and d["active"] is False and d["items"] == []
    assert widgetdata.get("nope") == {"provider": "nope", "items": [], "active": False}
    assert widgetdata.status("faq") == {"provider": "faq", "label": "FAQ-plugin", "active": False, "count": 0}


def test_the_faq_of_the_plugin_comes_in_with_a_text_per_language(monkeypatch):
    monkeypatch.setattr(widgetdata, "_plugin_on", lambda n: True)
    monkeypatch.setattr(widgetdata, "_model", lambda label, name: FakeModel([_obj(question={"nl": "Wat kost het?", "en": "What does it cost?"}, answer={"nl": "Niets", "en": "Nothing"}, category={})]))
    d = widgetdata.get("faq")
    assert d["active"] and d["items"] == [{"q": {"nl": "Wat kost het?", "en": "What does it cost?"}, "a": {"nl": "Niets", "en": "Nothing"}, "c": {}}]


def test_only_the_discount_codes_that_are_on_now_come_in(monkeypatch):
    now = timezone.now()
    row = lambda **k: _obj(code="X", description="", kind="percent", value=Decimal("10"), min_subtotal=Decimal("0"), max_uses=None, used_count=0, starts_at=None, ends_at=None, **k)  # noqa: E731
    rows = [row(), _obj(code="OLD", description="", kind="percent", value=Decimal("5"), min_subtotal=0, max_uses=None, used_count=0, starts_at=None, ends_at=now - timedelta(days=1)),
            _obj(code="FULL", description="", kind="fixed", value=Decimal("5"), min_subtotal=0, max_uses=3, used_count=3, starts_at=None, ends_at=None),
            _obj(code="LATER", description="", kind="fixed", value=Decimal("5"), min_subtotal=0, max_uses=None, used_count=0, starts_at=now + timedelta(days=2), ends_at=None)]
    monkeypatch.setattr(widgetdata, "_plugin_on", lambda n: True)
    monkeypatch.setattr(widgetdata, "_model", lambda label, name: FakeModel(rows))
    d = widgetdata.get("webshop")
    assert [i["code"] for i in d["items"]] == ["X"] and d["items"][0]["value"] == 10.0  # expired, used up and not yet started are left out


@pytest.mark.django_db
def test_the_company_of_the_website_is_one_item_when_the_module_is_on(monkeypatch):
    from apps.core import modules
    from apps.core.models import Entity

    monkeypatch.setattr(modules, "enabled", lambda k, *a, **kw: True)
    Entity.objects.create(is_own=True, name="Shop BV", email="info@shop.nl", phone="020 1234567", street="Damrak", house_number="1", postal_code="1012 LG", city="Amsterdam", locations=[{"name": "Magazijn", "city": "Utrecht"}])
    d = widgetdata.get("entity")
    assert d["active"] and len(d["items"]) == 1 and d["items"][0]["name"] == "Shop BV" and d["items"][0]["city"] == "Amsterdam" and d["items"][0]["locations"][0]["city"] == "Utrecht"


@pytest.mark.django_db
def test_the_opening_hours_come_from_the_installed_widget(lib, settings):
    d = lib / "widgets" / "opening-hours"
    d.mkdir(parents=True)
    (d / "widget.json").write_text(json.dumps({"key": "opening-hours", "name": "Tijden", "description": "x", "category": "Bedrijf", "options": [{"key": "d1", "label": "Ma", "type": "text", "default": "09:00-17:00"}]}))
    (d / "widget.html").write_text("<p>x</p>")
    assert widgetdata.get("hours")["active"] is False  # not installed
    widgets.install("opening-hours")
    got = widgetdata.get("hours")
    assert got["active"] and got["items"][0]["d1"] == "09:00-17:00"


@pytest.mark.django_db
def test_a_widget_with_a_provider_has_the_data_in_its_document_and_a_status(lib, monkeypatch):
    m = widgets.manifest("demo")
    assert m["data"] == {"provider": "entity", "label": "Bedrijfsgegevens (module Entiteit)"}
    html = widgets.doc("demo", example=True)
    assert "window.WIDGET_DATA={" in html and '"provider": "entity"' in html
    assert widgets.admin_listing()[0]["data_status"]["provider"] == "entity"
    other = lib / "widgets" / "plain"
    other.mkdir()
    (other / "widget.json").write_text(json.dumps({"key": "plain", "name": "Plain", "description": "x", "category": "Test", "data": {"provider": "onzin"}}))
    (other / "widget.html").write_text("<p>x</p>")
    assert widgets.manifest("plain")["data"] is None  # an unknown provider is no provider
    assert "window.WIDGET_DATA=null" in widgets.doc("plain")
    assert "data" in widgets.GROUPS  # the tab Gegevens
