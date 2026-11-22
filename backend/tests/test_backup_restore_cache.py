# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""After a restore the base data (licence data) and the theme are what the backup says, also with the system cache on: nothing stale is shown."""
import pytest
from django.contrib.auth import get_user_model

from apps.backups import service
from apps.core import system


@pytest.mark.django_db
def test_restore_shows_the_base_data_of_the_backup_at_once(settings, tmp_path):
    settings.BACKUPS_DIR = tmp_path
    system.save({"site_name": "Mijn club", "company_name": "Club BV", "system_cache": True, "system_cache_seconds": "300"})
    assert system.get()["site_name"] == "Mijn club"  # (now in the cache for five minutes)
    user = get_user_model().objects.create_user(username="bk", email="bk@x.nl", password="x", is_staff=True)
    b = service.create("manual", user)
    system.save({"site_name": "Anders", "company_name": "Andere BV"})
    assert system.get()["site_name"] == "Anders"
    service.restore(b, None, user)
    got = system.get()
    assert got["site_name"] == "Mijn club" and got["company_name"] == "Club BV"


@pytest.mark.django_db
def test_restore_brings_the_logo_back(settings, tmp_path):
    """The logo (a brand picture in the storage with its row) is in the backup and is back after a restore; and also when only the settings part Logo's is restored."""
    import io

    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from PIL import Image

    from apps.branding.models import SiteAsset

    settings.BACKUPS_DIR = tmp_path
    buf = io.BytesIO()
    Image.new("RGB", (40, 20), (200, 30, 30)).save(buf, "PNG")
    name = default_storage.save("branding/logo-test.png", ContentFile(buf.getvalue()))
    SiteAsset.objects.update_or_create(slot="logo", defaults={"image": name})
    user = get_user_model().objects.create_user(username="lg", email="lg@x.nl", password="x", is_staff=True)
    b = service.create("manual", user)
    keys = [p["key"] for p in b.parts]
    assert "settings:branding" in keys and "files" in keys and "data" in keys
    # the logo is lost: row and file
    SiteAsset.objects.all().delete()
    default_storage.delete(name)
    assert not SiteAsset.objects.filter(slot="logo").exists()
    # only the settings part "Logo's": the file and the row come back from settings.json
    service.restore(b, ["settings:branding"], user)
    a = SiteAsset.objects.get(slot="logo")
    assert default_storage.exists(a.image.name)
    # everything: the row and the file also come back from data.json and files/
    SiteAsset.objects.all().delete()
    default_storage.delete(a.image.name)
    service.restore(b, None, user)
    a = SiteAsset.objects.get(slot="logo")
    assert default_storage.exists(a.image.name)


@pytest.mark.django_db
def test_restore_takes_away_a_logo_slot_that_the_backup_does_not_have(settings, tmp_path):
    """A header logo of another design must not keep winning over the restored logo."""
    import io

    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from PIL import Image

    from apps.branding.models import SiteAsset

    settings.BACKUPS_DIR = tmp_path
    buf = io.BytesIO()
    Image.new("RGB", (30, 30), (10, 10, 200)).save(buf, "PNG")
    SiteAsset.objects.update_or_create(slot="logo", defaults={"image": default_storage.save("branding/lg1.png", ContentFile(buf.getvalue()))})
    user = get_user_model().objects.create_user(username="lg2", email="lg2@x.nl", password="x", is_staff=True)
    b = service.create("manual", user)
    SiteAsset.objects.update_or_create(slot="header_logo", defaults={"image": default_storage.save("branding/other.png", ContentFile(buf.getvalue()))})
    service.restore(b, ["settings:branding"], user)
    assert SiteAsset.objects.filter(slot="logo").exists() and not SiteAsset.objects.filter(slot="header_logo").exists()


@pytest.mark.django_db
def test_restore_puts_the_theme_back_exactly(settings, tmp_path):
    from apps.core.models import SiteSettings

    settings.BACKUPS_DIR = tmp_path
    s = SiteSettings.load()
    s.theme = {"primary": "#112233", "loader_style": "ring"}
    s.save()
    user = get_user_model().objects.create_user(username="th", email="th@x.nl", password="x", is_staff=True)
    b = service.create("manual", user)
    s = SiteSettings.load()
    s.theme = {"primary": "#ffffff", "extra": "x"}
    s.save()
    service.restore(b, ["settings:theme"], user)
    assert SiteSettings.load().theme == {"primary": "#112233", "loader_style": "ring"}
