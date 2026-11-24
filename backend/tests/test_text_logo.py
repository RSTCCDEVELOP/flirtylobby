# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The text logo of a designed website: "&" in the name is escaped once (it showed as &amp; in the header)."""
import pytest

from apps.branding.models import SiteAsset
from apps.core import sitecreator


@pytest.mark.django_db
def test_an_ampersand_in_the_name_is_not_escaped_twice(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    sitecreator.text_logo("Boekhout & Partners", {"text": "#1f2937", "primary": "#0d9488"}, ("Boekhout &amp;", "Partners"))
    svg = SiteAsset.objects.get(slot="logo").image.read().decode()
    assert "Boekhout &amp; " in svg and "&amp;amp;" not in svg  # (one escape: the picture shows "&")
    sitecreator.text_logo("Boekhout & Partners", {"text": "#1f2937", "primary": "#0d9488"})
    svg = SiteAsset.objects.get(slot="logo").image.read().decode()
    assert "&amp;amp;" not in svg and "Boekhout &amp;" in svg
