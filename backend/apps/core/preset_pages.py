# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Pages that belong to a standard installation: a designed start page and other pages that are installed with the installation and removed with it.

install(key)  puts the pages in place (a page that somebody designed by hand is left alone), and remembers which ones are ours;
remove(key)   takes exactly those away again (layouts, pages and their texts); the standard pages get their standard layout back;
link_media(key) after the demo data: the pictures of the heroes are put in the banners.
Texts are content blocks with the key prefix "preset.<installation>." in Dutch and English."""
import hashlib
import logging

logger = logging.getLogger(__name__)
LANGS = ("nl", "en")


def _id(*parts):
    return hashlib.md5(":".join(parts).encode()).hexdigest()[:8]


class Builder:
    """Collects the rows and texts of one page."""

    def __init__(self, prefix, page):
        self.prefix, self.page, self.rows, self.texts, self.images = prefix, page, [], {}, {}

    def t(self, name, nl, en):
        key = f"{self.prefix}.{self.page}.{name}"
        self.texts[key] = {"nl": nl, "en": en}
        return key

    def rich(self, name, nl, en):
        """A text with links (formatted text): cleaned like everything that is typed in edit mode."""
        from . import richtext

        key = f"{self.prefix}.{self.page}.{name}"
        self.texts[key] = {"nl": richtext.PREFIX + richtext.clean(nl), "en": richtext.PREFIX + richtext.clean(en)}
        return key

    def img(self, name, picture):
        """An image item: its key; the picture (a name in the media library, "Dating Zoeken") is put in when the demo pictures exist."""
        key = f"{self.prefix}.{self.page}.img.{name}"
        self.images[key] = picture
        return key

    def cell(self, name, items, halign="left", valign="top", width="auto"):
        return {"id": _id(self.page, name, "cell"), "width": width, "halign": halign, "valign": valign,
                "items": [{"id": _id(self.page, name, str(i)), "type": kind, "ref": ref} for i, (kind, ref) in enumerate(items)]}

    def row(self, name, cells, gap="md", **extra):
        self.rows.append({"id": _id(self.page, name, "row"), "cols": len(cells), "width": "default", "gap": gap, "cells": cells, "bg": {}, **extra})

    def hero(self, name, heading, text, extra_text=None, h=70, hero="dating"):
        items = [("heading", heading), ("text", text)] + ([("text", extra_text)] if extra_text else [])
        self.row(name, [self.cell(name, items, "center", "center")], title="Hero", screen=True, top="touch", h_mode="pct", h=h, padding={"t": 40, "b": 40}, hero=hero, width="100")

    def columns(self, name, cols, gap="lg"):
        """cols: [(heading ref, text ref) or (heading ref, text ref, picture name)]"""
        cells = []
        for i, col in enumerate(cols):
            items = [("heading", col[0]), ("text", col[1])]
            if len(col) > 2:
                items.insert(0, ("image", self.img(f"{name}{i}", col[2])))
            cells.append(self.cell(f"{name}{i}", items))
        self.row(name, cells, gap=gap)


# ── Datingplatform ──────────────────────────────────────────────────────────
def dating():
    pre = "preset.datingplatform"
    out = {"layouts": {}, "pages": []}

    # the start page: banner with the call to sign up, numbers, members near you, how it works, chat and safety, stories, final call
    b = Builder(pre, "home")
    b.hero("hero", b.t("hero.title", "Vind liefde, vriendschap of gewoon een leuk gesprek", "Find love, friendship or just a nice conversation"),
           b.t("hero.intro", "Echte mensen, echte gesprekken. Maak gratis een profiel, ontdek wie er bij jou in de buurt woont en begin vandaag nog een gesprek.", "Real people, real conversations. Create a free profile, discover who lives near you and start a conversation today."),
           b.rich("hero.cta", '<p><a href="/registreren"><strong>Gratis aanmelden</strong></a> &nbsp;·&nbsp; <a href="/login">Inloggen</a></p>', '<p><a href="/registreren"><strong>Sign up for free</strong></a> &nbsp;·&nbsp; <a href="/login">Log in</a></p>'), h=85, hero="custom")
    b.row("numbers", [b.cell("n1", [("heading", b.t("n1.t", "24.000+", "24,000+")), ("text", b.t("n1.x", "leden uit Nederland en België", "members from the Netherlands and Belgium"))], "center"),
                      b.cell("n2", [("heading", b.t("n2.t", "1.250", "1,250")), ("text", b.t("n2.x", "nieuwe matches per week", "new matches per week"))], "center"),
                      b.cell("n3", [("heading", b.t("n3.t", "4,6 / 5", "4.6 / 5")), ("text", b.t("n3.x", "waardering van onze leden", "rating by our members"))], "center")], gap="lg")
    b.row("near-title", [b.cell("near-title", [("heading", b.t("near.title", "Leden in jouw buurt", "Members near you")), ("text", b.t("near.intro", "Een greep uit de leden die vandaag online zijn. Meld je aan om ze allemaal te zien.", "A selection of members who are online today. Sign up to see them all."))], "center")], mt=30)
    import datetime as _dt

    year = _dt.date.today().year
    people = [("Sophie", 1996, "Utrecht", "Koffie, boeken en een lange wandeling"), ("Daan", 1992, "Amsterdam", "Festivals en een goede bak koffie"), ("Lotte", 1999, "Rotterdam", "Yoga, sushi en zonsondergangen"), ("Milan", 1989, "Den Haag", "Ondernemer, hardloper en hobbykok")]
    b.row("near", [b.cell(f"near{i}", [("image", b.img(f"near{i}", f"Dating Lid {n}")), ("heading", b.t(f"near{i}.t", f"{n}, {year - y}", f"{n}, {year - y}")), ("text", b.t(f"near{i}.x", f"{city} · {line}", f"{city} · {line}"))], "center") for i, (n, y, city, line) in enumerate(people)], gap="md")
    b.row("how-title", [b.cell("how-title", [("heading", b.t("how.title", "Zo werkt het", "How it works"))], "center")], mt=30)
    b.columns("how", [(b.t("how1.t", "1. Maak je profiel", "1. Create your profile"), b.t("how1.x", "Vertel wie je bent, kies je mooiste foto's en geef aan wat je zoekt: daten, een relatie, vriendschap of een praatje.", "Tell who you are, choose your best photos and say what you are looking for: dating, a relationship, friendship or a chat."), "Dating Profiel"),
                       (b.t("how2.t", "2. Ontdek en like", "2. Discover and like"), b.t("how2.x", "Zoek op leeftijd, afstand en interesses, of swipe door de aanbevelingen. Likes zijn anoniem tot jullie allebei ja zeggen.", "Search by age, distance and interests, or swipe through the recommendations. Likes stay anonymous until you both say yes."), "Dating Zoeken"),
                       (b.t("how3.t", "3. Chat en ontmoet", "3. Chat and meet"), b.t("how3.x", "Bij een match kun je berichten sturen, chatten en zelfs videobellen. Plan een eerste date in de agenda.", "With a match you can send messages, chat and even video call. Plan a first date in the agenda."), "Dating Chat")])
    b.row("chat", [b.cell("chat-pic", [("image", b.img("chat", "Dating Koffie"))], "center", "center"),
                   b.cell("chat-text", [("heading", b.t("chat.t", "Van eerste bericht tot eerste date", "From first message to first date")),
                                        ("text", b.t("chat.x", "Stuur een bericht, chat live met foto's en video of bel met beeld en geluid, zonder je telefoonnummer te delen. Spreek daarna af op een plek die jullie allebei fijn vinden.", "Send a message, chat live with photos and video or call with picture and sound, without sharing your phone number. Then meet at a place you both like.")),
                                        ("text", b.rich("chat.cta", '<p><a href="/registreren">Begin met kennismaken</a></p>', '<p><a href="/registreren">Start getting to know each other</a></p>'))], "left", "center")], gap="lg")
    b.row("safe", [b.cell("safe1", [("image", b.img("safe", "Dating Veilig")), ("heading", b.t("safe.t", "Veilig en echt", "Safe and real")), ("text", b.t("safe.x", "Elk profiel wordt gecontroleerd. Je bepaalt zelf wie je foto's ziet, je kunt iemand blokkeren of melden, en een slim woordenfilter houdt de toon vriendelijk.", "Every profile is checked. You decide who sees your photos, you can block or report someone, and a smart word filter keeps the tone friendly."))]),
                   b.cell("safe2", [("heading", b.t("safe2.t", "Jouw privacy staat voorop", "Your privacy comes first")), ("text", b.t("safe2.x", "Verberg je afstand, leeftijd of woonplaats, maak foto's privé en kies zelf in welke taal je profiel zichtbaar is. Twee-staps verificatie beschermt je account.", "Hide your distance, age or town, make photos private and choose in which language your profile is visible. Two-step verification protects your account."))])], gap="lg")
    b.row("stories-title", [b.cell("stories-title", [("heading", b.t("stories.title", "Verhalen van leden", "Stories from members"))], "center")], mt=30)
    b.columns("stories", [(b.t("s1.t", "Milan en Sophie", "Milan and Sophie"), b.t("s1.x", "\"We kwamen elkaar tegen via de match-pagina en deelden meteen onze liefde voor wandelen. Inmiddels wandelen we elke zaterdag.\"", "\"We met on the match page and immediately shared our love of walking. We now walk together every Saturday.\""), "Dating Wandelen"),
                          (b.t("s2.t", "Daan en Jesper", "Daan and Jesper"), b.t("s2.x", "\"Een maatje gevonden voor festivals. De chat is gemakkelijk en niemand dringt zich op.\"", "\"Found a buddy for festivals. The chat is easy and nobody is pushy.\""), "Dating Koffie"),
                          (b.t("s3.t", "Fleur", "Fleur"), b.t("s3.x", "\"Ik had niet verwacht dat het zo ontspannen zou zijn. Mijn kat keurt de nieuwe vriend goed.\"", "\"I did not expect it to be so relaxed. My cat approves of the new boyfriend.\""), "Dating Diner")])
    b.row("cta", [b.cell("cta", [("heading", b.t("cta.t", "Klaar voor een eerste gesprek?", "Ready for a first conversation?")), ("text", b.t("cta.x", "Aanmelden duurt twee minuten en is gratis. Je kunt altijd stoppen en je gegevens laten verwijderen.", "Signing up takes two minutes and is free. You can always stop and have your data removed.")),
                                 ("text", b.rich("cta.link", '<p><a href="/registreren"><strong>Maak mijn profiel</strong></a></p>', '<p><a href="/registreren"><strong>Create my profile</strong></a></p>'))], "center", "center")], title="Hero oproep", screen=True, h_mode="pct", h=45, hero="custom", width="100")
    out["layouts"]["home"] = b

    # the community page (overview of the community) and search page: opening banner and cards
    b = Builder(pre, "community")
    b.hero("hero", b.t("hero.title", "Onze community", "Our community"), b.t("hero.intro", "Leden vinden elkaar op leeftijd, interesses en afstand. Kijk rond, like, stuur een bericht of start een chat.", "Members find each other by age, interests and distance. Look around, like, send a message or start a chat."), h=45)
    b.columns("cards", [(b.t("c1.t", "Ledenzoeker", "Member search"), b.t("c1.x", "Filter op leeftijd, woonplaats, leefstijl en interesses. Sla je favorieten op.", "Filter by age, town, lifestyle and interests. Save your favourites."), "Dating Zoeken"),
                        (b.t("c2.t", "Zoeken en matchen", "Search and match"), b.t("c2.x", "Swipe door de aanbevelingen. Zie wie je leuk vindt en wie jou leuk vindt.", "Swipe through the recommendations. See who likes you and whom you like."), "Dating Profiel"),
                        (b.t("c3.t", "Berichten en chat", "Messages and chat"), b.t("c3.x", "Stuur een bericht, chat live met foto's en video, of bel met beeld en geluid.", "Send a message, chat live with photos and video, or call with picture and sound."), "Dating Chat")])
    out["layouts"]["community"] = b
    b = Builder(pre, "search")
    b.hero("hero", b.t("hero.title", "Zoek je match", "Find your match"), b.t("hero.intro", "Kies wie je zoekt en hoe ver je wilt reizen. Hoe meer je invult, hoe beter de aanbevelingen.", "Choose whom you are looking for and how far you want to travel. The more you fill in, the better the recommendations."), h=35)
    b.columns("tips", [(b.t("t1.t", "Tip: foto's", "Tip: photos"), b.t("t1.x", "Profielen met drie foto's krijgen drie keer zoveel reacties.", "Profiles with three photos get three times as many responses.")),
                       (b.t("t2.t", "Tip: vertel iets over jezelf", "Tip: tell something about yourself"), b.t("t2.x", "Eén zin over wat je graag doet is genoeg om het gesprek te beginnen.", "One sentence about what you like to do is enough to start the conversation."))], gap="lg")
    out["layouts"]["search"] = b

    # own pages (in the menu): how it works and safe dating
    for key, nl_t, en_t in (("hoe-werkt-het", "Hoe werkt het?", "How does it work?"), ("veilig-daten", "Veilig daten", "Dating safely")):
        b = Builder(pre, key)
        if key == "hoe-werkt-het":
            b.hero("hero", b.t("title", nl_t, en_t), b.t("intro", "Van aanmelden tot je eerste date, in vier stappen.", "From signing up to your first date, in four steps."), h=35)
            b.columns("steps", [(b.t("a.t", "Aanmelden", "Sign up"), b.t("a.x", "Maak een account met je e-mailadres en bevestig het met de code die we je sturen.", "Create an account with your e-mail address and confirm it with the code we send you.")),
                                (b.t("b.t", "Profiel invullen", "Complete your profile"), b.t("b.x", "Voeg foto's toe, kies je interesses en beschrijf wat je zoekt.", "Add photos, choose your interests and describe what you are looking for.")),
                                (b.t("c.t", "Ontdekken", "Discover"), b.t("c.x", "Zoek, swipe en like. Bij een match krijgen jullie allebei een melding.", "Search, swipe and like. With a match you both get a notice.")),
                                (b.t("d.t", "Afspreken", "Meet up"), b.t("d.x", "Chat, bel en plan je eerste date in de agenda.", "Chat, call and plan your first date in the agenda."))], gap="md")
        else:
            b.hero("hero", b.t("title", nl_t, en_t), b.t("intro", "Een paar tips voor een prettige en veilige eerste ontmoeting.", "A few tips for a pleasant and safe first meeting."), h=35)
            b.columns("tips", [(b.t("a.t", "Spreek op een openbare plek af", "Meet in a public place"), b.t("a.x", "Kies een café of park en laat een vriend weten waar je bent.", "Choose a café or park and tell a friend where you are.")),
                               (b.t("b.t", "Deel niet te snel persoonlijke gegevens", "Do not share personal details too quickly"), b.t("b.x", "Je adres, werkgever en bankgegevens heeft niemand nodig om je te leren kennen.", "Nobody needs your address, employer or bank details to get to know you.")),
                               (b.t("c.t", "Vertrouw op je gevoel", "Trust your feeling"), b.t("c.x", "Voelt iets niet goed? Blokkeer of meld het profiel. Wij kijken er direct naar.", "Does something not feel right? Block or report the profile. We look at it straight away."))], gap="md")
        out["layouts"][key] = b
        out["pages"].append({"key": key, "title": {"nl": nl_t, "en": en_t}, "in_menu": True, "order": 60 + len(out["pages"])})
    return out


def generic(key):
    """The start page and own pages of an installation from its texts (preset_content.SPECS) and pictures (demo_art.ART)."""
    from . import presets
    from .demo_art import ART
    from .preset_content import SPECS

    spec, art = SPECS[key], ART[key]
    pre, theme, prefix = f"preset.{key}", presets.BY_KEY[key]["theme"], art["prefix"]
    pic = lambda label: f"{prefix} {label}"  # noqa: E731
    out = {"layouts": {}, "pages": []}

    b = Builder(pre, "home")
    (ht, hi, hc) = spec["hero"]
    b.hero("hero", b.t("hero.title", *ht), b.t("hero.intro", *hi), b.t("hero.cta", *hc), h=75, hero="custom")  # (on the start page a banner is a block like any other: "custom"; the other pages use the banner of the page itself)
    b.columns("features", [(b.t(f"f{i}.t", *t), b.t(f"f{i}.x", *x), pic(p)) for i, (t, x, p) in enumerate(spec["features"])], gap="lg")
    st, sx, sp = spec["split"]
    b.row("split", [b.cell("split-pic", [("image", b.img("split", pic(sp)))], "center", "center"), b.cell("split-text", [("heading", b.t("split.t", *st)), ("text", b.t("split.x", *sx))], "left", "center")], gap="lg")
    b.columns("steps", [(b.t(f"s{i}.t", *t), b.t(f"s{i}.x", *x)) for i, (t, x) in enumerate(spec["steps"])], gap="lg")
    ct, cx = spec["cta"]
    b.row("cta", [b.cell("cta", [("heading", b.t("cta.t", *ct)), ("text", b.t("cta.x", *cx))], "center", "center")], title="Hero oproep", screen=True, h_mode="pct", h=40, hero="custom", width="100")
    out["layouts"]["home"] = b

    if spec.get("community"):  # the community pages of installations with the plugin Community
        b = Builder(pre, "community")
        b.hero("hero", b.t("hero.title", "Onze community", "Our community"), b.t("hero.intro", *spec["community"]), h=45, hero=theme)
        b.columns("cards", [(b.t("c1.t", "Ledenzoeker", "Member search"), b.t("c1.x", "Zoek leden op naam, regio en interesses.", "Search members by name, region and interests."), pic(spec["features"][0][2])),
                            (b.t("c2.t", "Berichten", "Messages"), b.t("c2.x", "Stuur een bericht aan een lid, ook als je geen contact hebt.", "Send a message to a member, even if you are not in touch yet."), pic(spec["features"][1][2])),
                            (b.t("c3.t", "Chat", "Chat"), b.t("c3.x", "Chat live met foto's en video of bel met beeld en geluid.", "Chat live with photos and video or call with picture and sound."), pic(spec["features"][2][2]))])
        out["layouts"]["community"] = b

    for n, (pkey, title, intro, cols) in enumerate(spec["pages"]):
        b = Builder(pre, pkey)
        b.hero("hero", b.t("title", *title), b.t("intro", *intro), h=35, hero=theme)
        b.columns("cols", [(b.t(f"{i}.t", *t), b.t(f"{i}.x", *x), pic(spec["features"][i % 3][2])) for i, (t, x) in enumerate(cols)], gap="lg")
        out["layouts"][pkey] = b
        out["pages"].append({"key": pkey, "title": {"nl": title[0], "en": title[1]}, "in_menu": True, "order": 60 + n})
    return out


BUILDERS = {"datingplatform": dating}
for _key in ("standaard-website", "webshop", "bedrijfswebsite", "zakelijk-netwerk", "intranet", "sportclub", "stichting", "marktplaats", "spelletjessite"):
    BUILDERS[_key] = (lambda k: (lambda: generic(k)))(_key)


# ── install / remove ────────────────────────────────────────────────────────
def _owned():
    from . import presets

    return dict(presets._data().get("preset_owned") or {})


def _save_owned(owned):
    from . import presets

    data = presets._data()
    data["preset_owned"] = owned
    presets._save_data(data)


HOME_FIXED = ["home.hero", "home.title", "home.text", "home.photos"]  # the fixed elements of the start page (logo or picture, title, text, home photos): the designed start page replaces them


def _layout_dict(b, page_key=""):
    from apps.pages import layout as page_layout

    return page_layout.clean({"rows": b.rows, "bg": {}, **({"moved": HOME_FIXED} if page_key == "home" else {})})


def install(key):
    """Put the pages of this installation in place. Returns the page keys that are ours now."""
    from apps.core.models import ContentBlock
    from apps.pages.models import Page, PageLayout

    build = BUILDERS.get(key)
    if not build:
        return []
    remove_all(except_key=key)
    spec = build()
    before = _owned().get(key) or {}
    mine = {"layouts": [], "pages": [], "backup": dict(before.get("backup") or {}), "images": {}}
    for page_key, b in spec["layouts"].items():
        lay = PageLayout.objects.filter(key=page_key).first()
        designed = bool(lay and (lay.data or {}).get("rows") and not (lay.data or {}).get("auto") and page_key not in before.get("layouts", []))
        if designed:
            mine["backup"][page_key] = lay.data  # a page somebody designed by hand is replaced; it comes back when the installation is removed
        for ck, texts in b.texts.items():
            for lang, text in texts.items():
                ContentBlock.objects.update_or_create(key=ck, lang=lang, defaults={"text": text})
        PageLayout.objects.filter(key=page_key).delete()  # replaced as a whole: what was on the page (blocks, banner, lists) is not combined with the new design
        PageLayout.objects.create(key=page_key, data=_layout_dict(b, page_key))
        mine["layouts"].append(page_key)
        mine["images"].update(b.images)
    for p in spec["pages"]:
        if not Page.objects.filter(key=p["key"]).exists():
            Page.objects.create(key=p["key"], kind="content", title=p["title"], enabled=True, in_menu=p["in_menu"], order=p["order"], source=f"preset:{key}")
            mine["pages"].append(p["key"])
    owned = _owned()
    owned[key] = mine
    _save_owned(owned)
    link_media(key)
    return mine["layouts"]


def remove(key):
    """The pages of this installation go: their layouts and texts, and the pages that were made for it. The standard pages get their standard layout back."""
    from apps.core.models import ContentBlock
    from apps.pages.models import Page, PageLayout

    owned = _owned()
    mine = owned.pop(key, None)
    ContentBlock.objects.filter(key__startswith=f"preset.{key}.").delete()
    if not mine:
        return
    PageLayout.objects.filter(key__in=mine.get("layouts", [])).delete()
    for page_key, data in (mine.get("backup") or {}).items():  # the pages that were designed by hand come back
        PageLayout.objects.update_or_create(key=page_key, defaults={"data": data})
    Page.objects.filter(key__in=mine.get("pages", []), source=f"preset:{key}").delete()
    _save_owned(owned)
    try:
        from apps.pages import defaults as page_defaults

        from . import presets

        presets.ensure_home_logo()
        page_defaults.apply_theme(page_defaults._theme())
    except Exception:  # noqa: BLE001
        logger.exception("Standard pages could not be put back after removing the pages of %s", key)


def remove_all(except_key=None):
    for k in list(_owned()):
        if k != except_key:
            remove(k)


HERO_PREFERENCE = {"datingplatform": "Hero Dating"}  # the banners of an installation prefer the pictures made for it


def link_media(key):
    """After the demo pictures exist: the banners ("Hero") get a hero picture and the image items their picture (found by name), where they have none yet."""
    from apps.core.models import ContentBlock
    from apps.medialib.models import MediaItem
    from apps.pages.models import PageLayout

    mine = _owned().get(key) or {}
    for ref, picture in (mine.get("images") or {}).items():  # pictures in the columns
        item = MediaItem.objects.filter(source="media-demo", name=f"{picture}.jpg").first()
        if item and not ContentBlock.objects.filter(key=ref, lang="*").exists():
            ContentBlock.objects.create(key=ref, lang="*", text=f"media:{item.id}")
    heroes = list(MediaItem.objects.filter(source="media-demo", name__startswith="Hero ", kind="image").order_by("name"))
    from .demo_art import ART

    wanted = HERO_PREFERENCE.get(key) or (f"Hero {ART[key]['prefix']}" if key in ART else "\0")
    pref = [h for h in heroes if h.name.startswith(wanted)]
    heroes = pref or heroes
    if not heroes:
        return
    n = 0
    for page_key in mine.get("layouts", []):
        lay = PageLayout.objects.filter(key=page_key).first()
        if not lay:
            continue
        data, changed = dict(lay.data or {}), False
        for r in data.get("rows", []):
            if str(r.get("title", "")).startswith("Hero") and not (r.get("bg") or {}).get("media"):
                r["bg"] = {"type": "image", "media": heroes[n % len(heroes)].id, "overlay": 0.4}
                n += 1
                changed = True
        if changed:
            PageLayout.objects.filter(pk=lay.pk).update(data=data)
