

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


@pytest.mark.django_db
def test_name_and_details_of_the_website_are_gone_after_a_reset_and_the_name_is_easy2edit_again():
    from apps.core import reset, system
    from apps.core.models import SystemSettings

    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**(row.data or {}), "site_name": "Hebbes Fasion", "tab_title": "hebbes", "company_name": "Studio2", "phone": "085 201 77 85", "frontend_url": "https://example.test", "installation_name": "Standaard website", "welcome_asked": True}
    row.save()
    assert system.site_name() == "Hebbes Fasion"
    reset.perform()
    d = SystemSettings.objects.get(pk=1).data
    assert not any(d.get(k) for k in ("site_name", "tab_title", "company_name", "phone", "installation_name"))
    assert d.get("frontend_url") == "https://example.test"  # the technical settings stay
    assert not d.get("welcome_asked")  # the first question (language, light or dark) comes again
    assert system.site_name() == "easy2edit"
