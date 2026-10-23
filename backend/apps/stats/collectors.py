# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""What every module shows on its own tab of Statistieken. A collector gets the number of days and returns widgets:
number {title, value, sub} · series {title, points | series: [{name, points}]} · bars {title, rows: [{label, value}]} · table {title, columns, rows}.
They read the tables of the module itself (what is there) and the counters that modules and plugins record (what happened)."""
from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from . import service as st


# ── widgets ──
def num(title, value, sub=""):
    return {"type": "number", "title": title, "value": value, "sub": sub}


def line(title, points, sub=""):
    return {"type": "series", "title": title, "points": points, "sub": sub}


def lines(title, named, sub=""):
    return {"type": "series", "title": title, "series": [{"name": n, "points": p} for n, p in named], "sub": sub}


def bars(title, rows, sub=""):
    rows = [(r["label"], r["value"]) if isinstance(r, dict) else r for r in rows]  # st.top gives {label, value}
    return {"type": "bars", "title": title, "rows": [{"label": str(a), "value": int(b)} for a, b in rows if b is not None], "sub": sub}


def table(title, columns, rows):
    return {"type": "table", "title": title, "columns": columns, "rows": [[("" if c is None else str(c)) for c in r] for r in rows]}


def per_day(qs, field, days):
    """Rows of a queryset per day: [{x, y}] with zeros."""
    ds = st._days(days)
    got = dict(qs.filter(**{f"{field}__date__gte": ds[0]}).annotate(d=TruncDate(field)).values_list("d").annotate(n=Count("id")).order_by())
    return [{"x": d.isoformat(), "y": int(got.get(d, 0))} for d in ds]


def counts(qs, field, labels=None, limit=12):
    rows = qs.values_list(field).annotate(n=Count("id")).order_by("-n")[:limit]
    return [((labels or {}).get(k, k) if k not in (None, "") else "—", n) for k, n in rows]


def ev(source, event, days):
    return st.series(source, event, days)


def evsum(source, event, days):
    return st.total(source, event, days)


# ── the collectors ──
def users(days):
    from apps.accounts.models import User, UserGroup

    now = timezone.now()
    last = User.objects.exclude(last_login=None).order_by("-last_login")[:8]
    names = {str(u.id): (u.get_full_name() or u.email or u.username) for u in User.objects.all()[:5000]}
    most = [(names.get(r["label"], r["label"]), r["value"]) for r in st.top("users", "login", days, 8)]
    groups = [(g.name, g.members.count()) for g in UserGroup.objects.all()]
    return [
        num("Gebruikers", User.objects.count(), f"{User.objects.filter(is_active=True).count()} actief"), num(f"Ingelogd (laatste {days} dagen)", User.objects.filter(last_login__gte=now - timedelta(days=days)).count()),
        num("Nooit ingelogd", User.objects.filter(last_login=None).count()), num("Beheerders", User.objects.filter(is_staff=True).count()),
        lines("Nieuwe gebruikers en inlogs per dag", [("Nieuw", per_day(User.objects.all(), "date_joined", days)), ("Inlogs", ev("users", "login", days))]),
        line("Mislukte inlogpogingen per dag", ev("users", "login_failed", days)),
        table("Laatste inlog", ["Gebruiker", "Laatste inlog", "Rol"], [(u.get_full_name() or u.email, u.last_login.strftime("%d-%m-%Y %H:%M"), u.role or ("superadmin" if u.is_staff else "")) for u in last]),
        bars("Meest ingelogd", most), bars("Groepen (aantal leden)", groups),
    ]


def roles(days):
    from apps.accounts.models import ModuleGrant, Role, User, UserGroup

    return [num("Rollen", Role.objects.count()), num("Groepen", UserGroup.objects.count()), num("Toegangsregels", ModuleGrant.objects.count()),
            bars("Gebruikers per rol", counts(User.objects.exclude(role=""), "role")), bars("Rechten per module", counts(ModuleGrant.objects.all(), "module")),
            table("Groepen", ["Groep", "Leden", "Rollen"], [(g.name, g.members.count(), g.roles.count()) for g in UserGroup.objects.all()])]


def registration(days):
    from apps.accounts.models import Invitation, PasskeyCredential, PendingRegistration, SocialIdentity, User

    return [num("Aanmeldingen (periode)", User.objects.filter(date_joined__gte=timezone.now() - timedelta(days=days)).count()), num("Wachten op bevestiging", PendingRegistration.objects.count()),
            num("Uitnodigingen", Invitation.objects.count(), f"{Invitation.objects.exclude(used_at=None).count()} gebruikt"), num("Passkeys", PasskeyCredential.objects.count()),
            line("Aanmeldingen per dag", per_day(User.objects.all(), "date_joined", days)), bars("Inloggen met Google of Apple", counts(SocialIdentity.objects.all(), "provider")),
            line("Uitnodigingen per dag", per_day(Invitation.objects.all(), "created_at", days))]


def twofa(days):
    from apps.accounts.models import PasskeyCredential, User

    return [num("Met twee-staps verificatie", User.objects.exclude(twofa_method="").count(), f"van {User.objects.count()}"), num("Passkeys", PasskeyCredential.objects.count()),
            bars("Methode per gebruiker", counts(User.objects.exclude(twofa_method=""), "twofa_method")), bars("Beheerders met twee-staps verificatie", [("Aan", User.objects.filter(is_staff=True).exclude(twofa_method="").count()), ("Uit", User.objects.filter(is_staff=True, twofa_method="").count())]),
            line("Mislukte inlogpogingen per dag", ev("users", "login_failed", days))]


def security_basic(days):
    from apps.security.models import LoginThrottle

    now = timezone.now()
    return [num("Nu geblokkeerd", LoginThrottle.objects.filter(locked_until__gt=now).count()), num("Adressen met mislukte pogingen", LoginThrottle.objects.filter(failures__gt=0).count()),
            line("Mislukte inlogpogingen per dag", ev("users", "login_failed", days)), line("Succesvolle inlogs per dag", ev("users", "login", days)),
            table("Meest mislukte pogingen", ["Sleutel", "Pogingen", "Geblokkeerd tot"], [(t.key[:30], t.failures, t.locked_until.strftime("%d-%m %H:%M") if t.locked_until else "") for t in LoginThrottle.objects.order_by("-failures")[:8]])]


def pages(days):
    from apps.pages.models import Page

    qs = Page.objects.all()
    return [num("Pagina's", qs.count()), num("In het menu", qs.filter(in_menu=True).count()), num("Uitgeschakeld", qs.filter(enabled=False).count()),
            bars("Soort pagina", counts(qs, "kind", {"system": "Systeem", "content": "Eigen pagina", "link": "Link", "menu": "Menu-item"})), bars("Voor wie", counts(qs, "audience", {"all": "Iedereen", "members": "Ingelogd", "guests": "Bezoekers"})),
            bars("Meest bezocht", st.top("seo", "page_view", days, 10)), table("Laatst gewijzigd", ["Pagina", "Soort", "Gewijzigd"], [(p.key, p.kind, p.updated_at.strftime("%d-%m-%Y")) for p in qs.order_by("-updated_at")[:8]])]


def edit_mode(days):
    from apps.core.models import ContentBlock

    return [num("Teksten", ContentBlock.objects.count()), line("Gewijzigde teksten per dag", per_day(ContentBlock.objects.all(), "updated_at", days)), bars("Teksten per taal", counts(ContentBlock.objects.all(), "lang"))]


def media(days):
    from apps.medialib.models import MediaItem, MediaView

    qs = MediaItem.objects.all()
    mb = round((qs.aggregate(n=Sum("size"))["n"] or 0) / 1048576, 1)
    return [num("Bestanden", qs.count()), num("Opslag", f"{mb} MB"), num("Versleuteld", qs.filter(encrypted=True).count()), num("Weergaven (systeemobjecten)", MediaView.objects.count()),
            line("Uploads per dag", per_day(qs, "created_at", days)), bars("Soort bestand", counts(qs, "kind")), bars("Opslag", counts(qs, "storage", {"local": "Lokaal", "s3": "S3"})),
            table("Grootste bestanden", ["Naam", "Soort", "MB"], [(m.name[:40], m.kind, round(m.size / 1048576, 1)) for m in qs.order_by("-size")[:8]])]


def siteimport(days):
    from apps.siteimport.models import SiteImport

    return [num("Imports", SiteImport.objects.count()), bars("Status", counts(SiteImport.objects.all(), "status")), line("Imports per dag", per_day(SiteImport.objects.all(), "created_at", days)),
            table("Laatste imports", ["Naam", "Bron", "Status"], [(i.name, i.kind, i.status) for i in SiteImport.objects.order_by("-created_at")[:8]])]


def sysobjects(days):
    from apps.sysobjects.models import SystemObject

    qs = SystemObject.objects.all()
    return [num("Systeemobjecten", qs.count()), num("Aan", qs.filter(enabled=True).count()), bars("Per soort", counts(qs, "kind"))]


def branding(days):
    from apps.branding.models import HomePhoto, SiteAsset

    return [num("Logo's en iconen", SiteAsset.objects.count()), num("Homepage-foto's", HomePhoto.objects.count())]


def theme(days):
    from apps.core.models import ThemePack

    return [num("Themapakketten", ThemePack.objects.count()), num("Aan", ThemePack.objects.filter(enabled=True).count()), table("Thema's", ["Thema", "Aan", "Bijgewerkt"], [(t.key, "ja" if t.enabled else "nee", t.updated_at.strftime("%d-%m-%Y")) for t in ThemePack.objects.all()[:12]])]


def languages(days):
    from apps.core.models import ContentBlock, Language

    return [num("Talen aan", Language.objects.filter(enabled=True).count(), f"van {Language.objects.count()}"), bars("Bezoeken per taal", st.top("seo", "language", days, 10)), bars("Teksten per taal", counts(ContentBlock.objects.all(), "lang")),
            table("Actieve talen", ["Taal", "Code", "Standaard"], [(l.native_name, l.code, "ja" if l.is_default else "") for l in Language.objects.filter(enabled=True)])]


def seo(days):
    return seo_widgets(days)


def seo_widgets(days):
    from apps.seo.models import SeoPage

    refs = st.top("seo", "referral", days, 12)
    kinds = {}
    for r in refs:
        k, _, name = r["label"].partition(":")
        kinds[k] = kinds.get(k, 0) + r["value"]
    bot_names = st.top("seo", "bot_visit", days, 14)
    return [
        num("Bezoekers", evsum("seo", "visitor", days)), num("Paginaweergaven", evsum("seo", "page_view", days)), num("Klikken uit zoekmachines", evsum("seo", "search_click", days)), num("Klikken uit AI-assistenten", evsum("seo", "ai_click", days)),
        num("Bezoeken van zoekbots", evsum("seo", "bot_search", days)), num("Bezoeken van AI-bots", evsum("seo", "bot_ai", days)), num("Overige bots", evsum("seo", "bot_other", days)), num("Pagina's met eigen SEO-tekst", SeoPage.objects.count()),
        lines("Bezoekers en paginaweergaven per dag", [("Bezoekers", ev("seo", "visitor", days)), ("Paginaweergaven", ev("seo", "page_view", days))]),
        lines("Klikken vanuit zoekmachines en AI per dag", [("Zoekmachines", ev("seo", "search_click", days)), ("AI-assistenten", ev("seo", "ai_click", days))]),
        lines("Bezoeken van bots per dag", [("Zoekbots", ev("seo", "bot_search", days)), ("AI-bots", ev("seo", "bot_ai", days)), ("Overig", ev("seo", "bot_other", days))]),
        bars("Waar bezoekers vandaan komen", [({"direct": "Direct", "search": "Zoekmachine", "ai": "AI-assistent", "social": "Social", "other": "Overige sites"}.get(k, k), v) for k, v in kinds.items()]),
        bars("Zoekmachines (klikken)", st.top("seo", "search_click", days, 8)), bars("AI-assistenten (klikken)", st.top("seo", "ai_click", days, 8)),
        bars("Bots per naam", [(r["label"].split(":", 1)[-1] + (" · AI" if r["label"].startswith("ai:") else ""), r["value"]) for r in bot_names]),
        bars("Meest bezochte pagina's", st.top("seo", "page_view", days, 10)), bars("Beste landingspagina's (uit zoek en AI)", st.top("seo", "landing", days, 10)), bars("Pagina's die bots lezen", st.top("seo", "bot_page", days, 10)),
        lines("Bots die robots.txt, sitemap en llms.txt opvragen", [("robots.txt", ev("seo", "robots", days)), ("sitemap", ev("seo", "sitemap", days)), ("llms.txt", ev("seo", "llms", days))]),
    ]


def help_(days):
    from apps.faq.models import HelpTip

    return [num("Aangepaste helpteksten", HelpTip.objects.count())]


def faq(days):
    from apps.faq.models import FaqEntry

    return [num("Vragen", FaqEntry.objects.count()), num("Zichtbaar", FaqEntry.objects.filter(active=True).count()), bars("Bezoeken van /faq", st.top("seo", "page_view", days, 3, prefix="/faq")), line("Gewijzigd per dag", per_day(FaqEntry.objects.all(), "updated_at", days))]


def privacy_pages(days):
    return [bars("Bezoeken privacy- en cookiepagina", [(r["label"], r["value"]) for r in st.top("seo", "page_view", days, 20) if r["label"].startswith(("/privacy", "/cookies"))])]


def subscriptions(days):
    from apps.plugins import facade
    Plan, Subscription = facade.models("subscriptions", "Plan", "Subscription")  # (the plugin Abonnementen)

    qs = Subscription.objects.all()
    act = qs.filter(status="active")
    return [num("Abonnementen", Plan.objects.count(), f"{Plan.objects.filter(active=True).count()} aan"), num("Lopende abonnees", act.count()), num("Omzet per periode (lopend)", f"€ {round(float(act.aggregate(n=Sum('price'))['n'] or 0), 2)}"),
            line("Nieuwe abonnementen per dag", per_day(qs, "created_at", days)), bars("Status", counts(qs, "status")), bars("Abonnees per plan", [(p.name, p.subscription_set.count()) for p in Plan.objects.all()] if hasattr(Plan, "subscription_set") else []),
            table("Laatste abonnees", ["Gebruiker", "Plan", "Tot"], [(s.user, s.plan, s.period_end.strftime("%d-%m-%Y") if s.period_end else "") for s in qs.select_related("user", "plan").order_by("-created_at")[:8]])]


def donations(days):
    from apps.plugins import facade
    Donation, DonationCampaign = facade.models("subscriptions", "Donation", "DonationCampaign")  # (the plugin Abonnementen)

    paid = Donation.objects.filter(status="paid")
    tot = paid.aggregate(n=Sum("amount"))["n"] or 0
    return [num("Acties", DonationCampaign.objects.count()), num("Giften", paid.count()), num("Opgehaald", f"€ {round(float(tot), 2)}"), num("Gemiddeld", f"€ {round(float(tot) / paid.count(), 2) if paid.count() else 0}"),
            line("Giften per dag", per_day(paid, "created_at", days)), bars("Per actie", [(c.name, c.donation_set.filter(status="paid").count()) for c in DonationCampaign.objects.all()]),
            table("Laatste giften", ["Naam", "Bedrag", "Datum"], [(d.name or "anoniem", f"€ {d.amount}", d.created_at.strftime("%d-%m-%Y")) for d in paid.order_by("-created_at")[:8]])]


def profiles(days):
    from apps.plugins import facade
    Block, Profile, ProfileVisit = facade.models("community", "Block", "Profile", "ProfileVisit")  # (the plugin Community)

    qs = Profile.objects.all()
    return [num("Profielen", qs.count()), num("Zichtbaar", qs.filter(enabled=True).count()), num("Geblokkeerd (paren)", Block.objects.count()), line("Profielbezoeken per dag", per_day(ProfileVisit.objects.all(), "visited_at", days)),
            bars("Zichtbaarheid", counts(qs, "visibility")), bars("Land", counts(qs.exclude(country=""), "country")), bars("Geslacht", counts(qs.exclude(gender=""), "gender"))]


def discover(days):
    from apps.plugins import facade
    Connection, Favorite, Like, Pass = facade.models("community", "Connection", "Favorite", "Like", "Pass")  # (the plugin Community)

    return [num("Likes", Like.objects.count()), num("Favorieten", Favorite.objects.count()), num("Weggeswiped", Pass.objects.count()), num("Verbindingen", Connection.objects.count()),
            lines("Likes en passes per dag", [("Likes", per_day(Like.objects.all(), "created_at", days)), ("Passes", per_day(Pass.objects.all(), "created_at", days))]), bars("Verbindingen", counts(Connection.objects.all(), "status"))]


def messages(days):
    from apps.plugins import facade
    DirectMessage = facade.models("community", "DirectMessage")  # (the plugin Community)

    qs = DirectMessage.objects.all()
    return [num("Berichten", qs.count()), num("Ongelezen", qs.filter(read_at=None).count()), line("Berichten per dag", per_day(qs, "created_at", days))]


def chat(days):
    from apps.plugins import facade
    ChatMessage = facade.models("community", "ChatMessage")  # (the plugin Community)

    qs = ChatMessage.objects.all()
    return [num("Chatberichten", qs.count()), num("Met bijlage", qs.exclude(attachment="").count()), line("Chatberichten per dag", per_day(qs, "created_at", days)), bars("Bijlagen", counts(qs.exclude(attachment_kind=""), "attachment_kind"))]


def directconnect(days):
    from apps.plugins import facade
    DirectRoom = facade.models("community", "DirectRoom")  # (the plugin Community)

    qs = DirectRoom.objects.all()
    return [num("Verbindingen", qs.count()), num("Gesloten", qs.filter(closed=True).count()), line("Verbindingen per dag", per_day(qs, "created_at", days))]


def geo(days):
    return [line("Geblokkeerde bezoeken per dag", ev("geo", "blocked", days)), bars("Geblokkeerd per land", st.top("geo", "blocked", days, 10))]


def age_gate(days):
    return [lines("Leeftijdspopup per dag", [("Bevestigd", ev("age_gate", "confirmed", days)), ("Weggegaan", ev("age_gate", "left", days))])]


def gambling(days):
    return [lines("Waarschuwingspopup per dag", [("Bevestigd", ev("gambling", "confirmed", days)), ("Weggegaan", ev("gambling", "left", days))])]


def cookies(days):
    return [lines("Cookiekeuzes per dag", [("Alles", ev("cookies", "accept_all", days)), ("Weigeren", ev("cookies", "reject", days)), ("Eigen keuze", ev("cookies", "custom", days))]),
            bars("Keuzes (periode)", [("Alles accepteren", evsum("cookies", "accept_all", days)), ("Weigeren", evsum("cookies", "reject", days)), ("Eigen keuze", evsum("cookies", "custom", days))])]


def word_filter(days):
    return [line("Geblokkeerde teksten per dag", ev("word_filter", "blocked", days)), bars("Gevonden woorden", st.top("word_filter", "blocked", days, 12))]


def integrations(days):
    from apps.integrations.models import Integration

    qs = Integration.objects.all()
    ai = lines("AI-aanroepen per dag", [("Aanroepen", ev("ai", "call", days)), ("Fouten", ev("ai", "error", days))])
    return [num("Koppelingen", qs.count()), num("Aan", qs.filter(enabled=True).count()), num("Test mislukt", qs.filter(last_test_ok=False).count()), num("AI-aanroepen", evsum("ai", "call", days)), num("Tokens in", evsum("ai", "tokens_in", days)), num("Tokens uit", evsum("ai", "tokens_out", days)),
            ai, lines("Tokens per dag", [("In", ev("ai", "tokens_in", days)), ("Uit", ev("ai", "tokens_out", days))]), bars("AI-aanroepen per model", st.top("ai", "call", days, 6)), bars("AI-aanroepen waarvoor", st.top("ai", "purpose", days, 10)),
            table("Koppelingen", ["Naam", "Soort", "Aan", "Test"], [(i.name, i.provider, "ja" if i.enabled else "nee", {True: "gelukt", False: "mislukt", None: "—"}[i.last_test_ok]) for i in qs])]


def communication(days):
    from apps.communication.models import CommAddress

    return [num("Adressen en nummers", CommAddress.objects.count()), lines("E-mail per dag", [("Verstuurd", ev("communication", "email_sent", days)), ("Mislukt", ev("communication", "email_failed", days))]), bars("Per soort", counts(CommAddress.objects.all(), "kind")),
            bars("Waarvoor verstuurd", st.top("communication", "email_sent", days, 10))]


def plugins(days):
    from apps.plugins.models import Plugin

    qs = Plugin.objects.all()
    return [num("Plugins", qs.count()), num("Aan", qs.filter(enabled=True).count()), num("Met fout", qs.exclude(error="").count()),
            table("Plugins", ["Plugin", "Versie", "Aan", "Fout"], [(p.title, p.version, "ja" if p.enabled else "nee", p.error[:40]) for p in qs])]


def notifications(days):
    from apps.notifications.models import Notification

    qs = Notification.objects.all()
    return [num("Meldingen", qs.count()), num("Ongelezen", qs.filter(read_at=None).count()), line("Meldingen per dag", per_day(qs, "created_at", days)), bars("Per module", counts(qs, "module")), bars("Per soort", counts(qs, "kind"))]


def sandbox(days):
    from apps.sandbox.models import SandboxMessage, SandboxPayment

    return [num("Gesimuleerde berichten", SandboxMessage.objects.count()), num("Gesimuleerde betalingen", SandboxPayment.objects.count()), line("Berichten per dag", per_day(SandboxMessage.objects.all(), "created_at", days)),
            bars("Soort bericht", counts(SandboxMessage.objects.all(), "kind")), bars("Betalingen per status", counts(SandboxPayment.objects.all(), "status"))]


def system(days):
    from apps.core import modules
    from apps.core import system as sysmod

    s = sysmod.get()
    return [num("Website", s.get("site_name") or "—"), num("Omgeving", s.get("environment")), num("Onderhoudsmodus", "aan" if s.get("maintenance") else "uit"), num("Modules aan", sum(1 for m in modules.MODULES if modules.enabled(m["key"])), f"van {len(modules.MODULES)}"),
            bars("Bezoekers per dag (laatste dagen)", [(p["x"][5:], p["y"]) for p in st.series("seo", "visitor", min(days, 14))])]


def storage(days):
    from apps.medialib.models import FileKey, MediaItem

    qs = MediaItem.objects.all()
    return [num("Bestanden", qs.count()), num("Versleuteld", qs.filter(encrypted=True).count()), num("Sleutels", FileKey.objects.count()), bars("Opslag", counts(qs, "storage", {"local": "Lokaal", "s3": "S3"})),
            bars("Versleuteld", [("Ja", qs.filter(encrypted=True).count()), ("Nee", qs.filter(encrypted=False).count())]), line("Uploads per dag", per_day(qs, "created_at", days))]


def backups(days):
    from apps.backups.models import Backup

    qs = Backup.objects.all()
    last = qs.order_by("-created_at").first()
    mb = round((qs.aggregate(n=Sum("size"))["n"] or 0) / 1048576, 1)
    return [num("Back-ups", qs.count()), num("Totale grootte", f"{mb} MB"), num("Laatste back-up", last.created_at.strftime("%d-%m-%Y %H:%M") if last else "nog geen"), bars("Per soort", counts(qs, "frequency", {"day": "Dag", "week": "Week", "month": "Maand", "manual": "Handmatig"})),
            line("Back-ups per dag", per_day(qs, "created_at", days)), table("Laatste back-ups", ["Datum", "MB", "Soort"], [(b.created_at.strftime("%d-%m-%Y %H:%M"), round(b.size / 1048576, 1), b.frequency) for b in qs.order_by("-created_at")[:8]])]


def dashboard(days):
    from apps.core.models import DashboardLayout, UserShortcuts

    return [num("Eigen dashboards", DashboardLayout.objects.exclude(user=None).count()), num("Gebruikers met snelkoppelingen", UserShortcuts.objects.count()), line("Inlogs per dag", ev("users", "login", days))]


def modules_(days):
    from apps.core import modules

    groups = {}
    for m in modules.MODULES:
        g = groups.setdefault(m.get("group", ""), [0, 0])
        g[0 if modules.enabled(m["key"]) else 1] += 1
    return [num("Modules aan", sum(v[0] for v in groups.values())), num("Modules uit", sum(v[1] for v in groups.values())), bars("Aan per groep", [(k, v[0]) for k, v in groups.items()]), bars("Uit per groep", [(k, v[1]) for k, v in groups.items()]),
            table("Uitgeschakeld", ["Module", "Groep"], [(m["label"], m.get("group", "")) for m in modules.MODULES if not modules.enabled(m["key"])])]


def orders(days):
    return plugin_of("orders", days)


def payments(days):
    return plugin_of("payments", days)


def plugin_of(name, days):
    from . import plugin_stats

    return plugin_stats.widgets(name, days)


COLLECTORS = {
    "users": users, "roles": roles, "registration": registration, "twofa": twofa, "security_basic": security_basic, "pages": pages, "edit_mode": edit_mode, "media": media, "siteimport": siteimport, "sysobjects": sysobjects, "branding": branding,
    "theme": theme, "languages": languages, "seo": seo, "help": help_, "faq": faq, "privacy_pages": privacy_pages, "subscriptions": subscriptions, "donations": donations, "orders": orders, "payments": payments, "profiles": profiles, "discover": discover,
    "messages": messages, "chat": chat, "directconnect": directconnect, "geo": geo, "age_gate": age_gate, "gambling": gambling, "cookies": cookies, "word_filter": word_filter, "integrations": integrations, "communication": communication,
    "plugins": plugins, "notifications": notifications, "sandbox": sandbox, "system": system, "storage": storage, "backups": backups, "dashboard": dashboard, "modules": modules_,
}


def general(days):
    """Algemeen: the most important numbers and graphs of everything."""
    from apps.accounts.models import User
    from apps.core import modules
    from apps.medialib.models import MediaItem
    from apps.pages.models import Page
    from apps.plugins.models import Plugin
    from apps.plugins import facade
    ChatMessage, DirectMessage = facade.models("community", "ChatMessage", "DirectMessage")  # (the plugin Community)

    now = timezone.now()
    return [
        num("Bezoekers", evsum("seo", "visitor", days)), num("Paginaweergaven", evsum("seo", "page_view", days)), num("Gebruikers", User.objects.count(), f"{User.objects.filter(last_login__gte=now - timedelta(days=days)).count()} actief"),
        num("Pagina's", Page.objects.count()), num("Bestanden", MediaItem.objects.count()), num("Modules aan", sum(1 for m in modules.MODULES if modules.enabled(m["key"]))), num("Plugins aan", Plugin.objects.filter(enabled=True).count()), num("AI-aanroepen", evsum("ai", "call", days)),
        lines("Bezoekers en paginaweergaven per dag", [("Bezoekers", ev("seo", "visitor", days)), ("Paginaweergaven", ev("seo", "page_view", days))]),
        lines("Nieuwe gebruikers en inlogs per dag", [("Nieuw", per_day(User.objects.all(), "date_joined", days)), ("Inlogs", ev("users", "login", days))]),
        lines("Bots en AI per dag", [("Zoekbots", ev("seo", "bot_search", days)), ("AI-bots", ev("seo", "bot_ai", days)), ("AI-aanroepen", ev("ai", "call", days))]),
        lines("Berichten en uploads per dag", [("Berichten", [{"x": a["x"], "y": a["y"] + b["y"]} for a, b in zip(per_day(DirectMessage.objects.all(), "created_at", days), per_day(ChatMessage.objects.all(), "created_at", days))]), ("Uploads", per_day(MediaItem.objects.all(), "created_at", days))]),
        bars("Meest bezochte pagina's", st.top("seo", "page_view", days, 8)), bars("Waar bezoekers vandaan komen", [(r["label"].split(":", 1)[-1], r["value"]) for r in st.top("seo", "referral", days, 8)]),
        bars("Bots per soort", [("Zoekmachines", evsum("seo", "bot_search", days)), ("AI", evsum("seo", "bot_ai", days)), ("Overig", evsum("seo", "bot_other", days))]),
        bars("Activiteit per module (opgenomen gebeurtenissen)", [(r["source"].replace("plugin:", "plugin ") , r["n"]) for r in __import__("apps.stats.models", fromlist=["StatDay"]).StatDay.objects.filter(day__gte=st._days(days)[0]).values("source").annotate(n=Sum("count")).order_by("-n")[:10]]),
    ]
