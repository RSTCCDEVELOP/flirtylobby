# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The standard page "Content niet beschikbaar" (/geen-toegang): always there, editable, and shown for a page that is not for this visitor."""
import pytest
from rest_framework.test import APIClient

from apps.pages import service
from apps.pages.models import Page


@pytest.mark.django_db
def test_the_page_is_always_there_and_editable():
    service.ensure_defaults()
    p = Page.objects.get(key="forbidden")
    assert p.url == "/geen-toegang" and p.scope == "public" and p.title["nl"] == "Content niet beschikbaar"
    assert "forbidden" in service.ALWAYS_ON and "forbidden" in service.EDITABLE
    assert APIClient().get("/api/pages/by-url/?path=/geen-toegang").status_code == 200


@pytest.mark.django_db
def test_a_page_for_members_gives_403_to_a_guest_and_404_when_it_does_not_exist(django_user_model):
    service.ensure_defaults()
    Page.objects.create(key="ledenzone", kind="content", title={"nl": "Ledenzone"}, url="/ledenzone", scope="public", audience="members", in_menu=False)
    guest = APIClient()
    r = guest.get("/api/pages/by-url/?path=/ledenzone")
    assert r.status_code == 403 and r.json() == {"forbidden": True}
    assert guest.get("/api/pages/by-url/?path=/bestaat-niet").status_code == 404
    member = APIClient()
    member.force_authenticate(django_user_model.objects.create_user("m", "m@x.nl", "pw12345678!"))
    assert member.get("/api/pages/by-url/?path=/ledenzone").status_code == 200
