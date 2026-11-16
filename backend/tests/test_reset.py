

def test_site_folder_is_cleaned_but_backups_database_settings_and_plugins_stay(tmp_path, monkeypatch):
    from django.conf import settings

    from apps.core import reset

    site = tmp_path / "site"
    for d in ("Database", "backups", "content", "plugins", "pages", "public", "private", "imports", "templates", "components", "media/users/1", "media/users/9", "media/photos"):
        (site / d).mkdir(parents=True)
        (site / d / "x.txt").write_text("x")
    (site / "README.md").write_text("r")
    (site / "other.zip").write_text("o")
    monkeypatch.setattr(settings, "SITE_DIR", site)
    monkeypatch.setattr(settings, "SITE_IMPORT_DIR", site / "imports")
    monkeypatch.setattr(settings, "TEMPLATES_DIR", site / "templates")
    monkeypatch.setattr(settings, "COMPONENTS_DIR", site / "components")
    monkeypatch.setattr(settings, "THEMES_DIR", site / "themes")
    monkeypatch.setattr(settings, "MEDIA_ROOT", site / "media")
    monkeypatch.setattr("apps.core.componentpacks.ensure_default", lambda: None)
    n = reset.clean_site_folder([1])
    assert n > 5
    for stay in ("Database/x.txt", "backups/x.txt", "content/x.txt", "plugins/x.txt", "README.md", "media/users/1/x.txt"):
        assert (site / stay).exists(), stay
    for gone in ("pages/x.txt", "public/x.txt", "private/x.txt", "other.zip", "media/photos", "media/users/9"):
        assert not (site / gone).exists(), gone
    assert not list((site / "imports").iterdir()) and not list((site / "templates").iterdir())


import pytest  # noqa: E402


@pytest.mark.django_db
def test_standard_pages_of_parts_that_are_off_do_not_exist_until_the_part_is_on(monkeypatch):
    from apps.core import modules
    from apps.core.models import ModuleState
    from apps.pages import service as pages_service
    from apps.pages.models import Page

    Page.objects.all().delete()
    for m in modules.MODULES:
        if not m.get("core"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": m["key"] in modules.ALWAYS_ON})
    modules.invalidate()
    pages_service.ensure_defaults()
    assert Page.objects.filter(key="home").exists()
    assert not Page.objects.filter(key__in=["community", "search", "payment", "cart", "checkout"]).exists()
    real = modules.enabled
    monkeypatch.setattr(modules, "enabled", lambda k: True if k == "discover" else real(k))  # (the part is a plugin: switched on)
    pages_service.ensure_defaults()  # the part is on now: its page is there
    assert Page.objects.filter(key="search").exists()
