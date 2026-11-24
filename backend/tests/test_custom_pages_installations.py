# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Custom pages (own pages) are no part of a standard installation and are gone after a reset."""
import pytest

from apps.core import presets
from apps.pages.models import Page, PageLayout


@pytest.mark.django_db
def test_a_custom_page_is_not_offered_not_saved_and_not_used_by_an_installation():
    key = presets.PRESETS[0]["key"]
    Page.objects.create(key="mijn-eigen", kind="content", title={"nl": "Mijn pagina"}, source="")
    PageLayout.objects.create(key="mijn-eigen", data={"rows": [{"cells": [{"items": [{"type": "text", "id": "a", "ref": "x"}]}]}]})
    assert "mijn-eigen" not in [p["key"] for p in presets.edit_options(key)["pages"]]
    with pytest.raises(ValueError):
        presets.save_page(key, "mijn-eigen")
    d = presets._data()
    d["preset_pages"] = {key: {"mijn-eigen": {"layout": {}, "blocks": {}}}}
    d["preset_edits"] = {key: {"pages": {"add": ["mijn-eigen"], "remove": []}}}
    presets._save_data(d)
    assert "mijn-eigen" not in presets.saved_pages(key) and "mijn-eigen" not in presets.page_edits(key)["add"]


@pytest.mark.django_db
def test_a_reset_removes_custom_pages_and_what_installations_kept_of_them(django_user_model):
    from apps.core import reset
    from apps.core.models import SystemSettings

    key = presets.PRESETS[0]["key"]
    Page.objects.create(key="mijn-eigen", kind="content", title={"nl": "Mijn pagina"}, source="")
    d = presets._data()
    d["preset_pages"] = {key: {"mijn-eigen": {"layout": {}, "blocks": {}}}}
    d["preset_edits"] = {key: {"pages": {"add": ["mijn-eigen"], "remove": []}, "modules": ["x"]}}
    presets._save_data(d)
    django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    reset.perform()
    assert not Page.objects.filter(key="mijn-eigen").exists()
    data = SystemSettings.objects.get(pk=1).data
    assert "preset_pages" not in data and "pages" not in (data.get("preset_edits") or {}).get(key, {})
