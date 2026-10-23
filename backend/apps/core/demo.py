# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo-gegevens: alles wat nodig is om het systeem te testen, in één keer te maken en weer weg te halen (Super admin).

Media (voorbeeldplaatjes en media-systeemobjecten), gebruikers met profiel, inhoud (abonnementen, donatie-acties, FAQ, pagina's), systeemobjecten en wat de plugins zelf
aanbieden (webshop: groepen, producten, ontwerpen, transporteurs, verzendmethoden en bestellingen). Wat hier wordt gemaakt is herkenbaar (e-mailadres demo-…@example.com,
bron "demo", of een lijst met nummers in de systeeminstellingen) en gaat er in één keer weer uit."""
import datetime
import logging

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

FAQ = [
    ("Hoe maak ik een account aan?", "Klik rechtsboven op Inloggen en kies Registreren. Je hebt alleen een e-mailadres nodig.", "How do I create an account?", "Click Log in at the top right and choose Register. You only need an email address."),
    ("Hoe lang duurt de levering?", "Bestellingen worden binnen 1 tot 3 werkdagen bezorgd. Je ontvangt een track & trace-code.", "How long does delivery take?", "Orders arrive within 1 to 3 working days. You receive a track & trace code."),
    ("Kan ik mijn bestelling retourneren?", "Ja, binnen 14 dagen. Het retourbeleid staat bij de gekozen transporteur.", "Can I return my order?", "Yes, within 14 days. The returns policy is shown with the chosen carrier."),
    ("Hoe betaal ik?", "Online met iDEAL of creditcard, of achteraf op factuur als de winkel dat aanbiedt.", "How do I pay?", "Online with iDEAL or credit card, or on invoice if the shop offers it."),
]
PAGES = [("demo-over-ons", "Over ons", "About us"), ("demo-contact", "Contact", "Contact"), ("demo-voorwaarden", "Algemene voorwaarden", "Terms and conditions")]


def _store():
    from .models import SystemSettings

    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    return obj


def _ids(kind):
    """The numbers of the demo rows of this kind that are really there (rows that were taken away by hand are not counted)."""
    ids = list(((_store().data or {}).get("demo_ids") or {}).get(kind, []))
    if not ids:
        return []
    from apps.faq.models import FaqEntry
    from apps.plugins import facade

    DonationCampaign, Plan = facade.models("subscriptions", "DonationCampaign", "Plan")  # (the plugin Abonnementen; without it these are empty)

    model = {"plans": Plan, "campaigns": DonationCampaign, "faq": FaqEntry}.get(kind)
    return list(model.objects.filter(pk__in=ids).values_list("pk", flat=True)) if model else ids


def _remember(kind, pks):
    obj = _store()
    data = dict(obj.data or {})
    ids = dict(data.get("demo_ids") or {})
    ids[kind] = sorted(set(ids.get(kind, [])) | set(pks))
    data["demo_ids"] = ids
    obj.data = data
    obj.save()


def _forget(kind):
    obj = _store()
    data = dict(obj.data or {})
    ids = dict(data.get("demo_ids") or {})
    ids.pop(kind, None)
    data["demo_ids"] = ids
    obj.data = data
    obj.save()


def _users_qs():
    from django.db.models import Q

    return get_user_model().objects.filter(Q(email__startswith="demo-", email__endswith="@example.com") | Q(username__startswith="fake_shop_"))


def _plugins(only=None):
    """The demo offers of the switched-on plugins (only those in `only` when given: the plugins of a standard installation)."""
    from apps.plugins import runtime

    return [p for name, p in runtime.providers("demo") if only is None or name in only]


def counts():
    from apps.medialib.models import MediaItem, MediaView
    from apps.pages.models import Page

    out = {"images": MediaItem.objects.filter(source="media-demo").exclude(name__startswith="Hero ").count(), "heroes": MediaItem.objects.filter(source="media-demo", name__startswith="Hero ").count(), "views": MediaView.objects.filter(slug__startswith="demo-").count(), "users": _users_qs().count(),
           "plans": len(_ids("plans")), "campaigns": len(_ids("campaigns")), "faq": len(_ids("faq")), "pages": Page.objects.filter(source="demo").count()}
    for p in _plugins():
        try:
            for k, v in (p.counts() or {}).items():
                out[k] = out.get(k, 0) + int(v)
        except Exception:  # noqa: BLE001
            logger.exception("Demo counts of a plugin failed")
    return out


def exists():
    return any(counts().values()) or bool(registry())


def registry():
    """{standard installation: [parts]} of the demo data that was made per installation ("_all" = made without an installation)."""
    return {k: list(v) for k, v in ((_store().data or {}).get("demo_presets") or {}).items()}


def _set_registry(reg):
    obj = _store()
    data = dict(obj.data or {})
    data["demo_presets"] = reg
    obj.data = data
    obj.save()


def incomplete():
    """Installations that have demo data of which a part is missing (for instance the plugin was not on when it was made)."""
    out = []
    for k in registry():
        try:
            if any(not present(x) for x in parts_for(None if k == "_all" else k)):
                out.append(k)
        except Exception:  # noqa: BLE001
            pass
    return out


def _plugins_named(only=None):
    from apps.plugins import runtime

    return [(n, p) for n, p in runtime.providers("demo") if only is None or n in only]


def present(part):
    """Is this part of the demo data already there?"""
    from apps.medialib.models import MediaItem, MediaView
    from apps.pages.models import Page

    if part == "media":
        return MediaItem.objects.filter(source="media-demo").exclude(name__startswith="Hero ").exists()
    if part == "heroes":
        return MediaItem.objects.filter(source="media-demo", name__startswith="Hero ").exists()
    if part == "views":
        return MediaView.objects.filter(slug__startswith="demo-").exists()
    if part == "users":
        return _users_qs().exists()
    if part == "plans":
        return bool(_ids("plans"))
    if part == "money":
        return bool(_ids("campaigns"))
    if part == "faq":
        return bool(_ids("faq"))
    if part == "pages":
        return Page.objects.filter(source="demo").exists()
    if part.startswith("plugin:"):
        for n, p in _plugins_named({part[7:]}):
            try:
                return any((p.counts() or {}).values())
            except Exception:  # noqa: BLE001
                return False
    return False


def make_users(n):
    """n people with a profile and a photo. The first eight have the names of the example community (and get a subscription and gifts with the content)."""
    from apps.plugins import facade
    from .management.commands import demo_content as dc

    from . import demo_intranet

    if demo_intranet.active():  # the Intranet has colleagues with a function and department instead of the example community
        return demo_intranet.make_people(n)
    Profile, ProfilePhoto = facade.models("community", "Profile", "ProfilePhoto")  # (the plugin Community: without it the people are made without a profile)

    User, pal, made = get_user_model(), dc.palette(), 0
    for k in range(n):
        name, g, year, city, cc, bio, interests, aim, rgb = dc.MEMBERS[k % len(dc.MEMBERS)]
        rnd = k // len(dc.MEMBERS)
        label = name + (str(rnd + 1) if rnd else "")
        email = f"demo-{label.lower()}@example.com"
        if User.objects.filter(email=email).exists():
            continue
        u = User(username=email, email=email, first_name=name, last_name=f"Demo{rnd + 1}" if rnd else "Demo", display_name=label, gender=g, birth_date=datetime.date(year, 1 + k % 12, 1 + k % 27), is_active=True,
                 address=f"Demostraat {k + 1}", postal_code=f"{1000 + k % 9000} AB", city=city, country=cc)
        u.set_unusable_password()
        u.save()
        if Profile is facade._NullModel:  # (no Community: the person is there without a profile)
            made += 1
            continue
        try:
            pr = Profile.objects.create(user=u, slug=f"{label.lower()}-demo", enabled=True, visibility="members", headline=f"Hoi, ik ben {label}!", bio=bio, discover=True, gender=g, birth_date=u.birth_date, city=city, country=cc, interests=interests, aim=aim,
                                        accept_messages=True, accept_chat=True, searchable_local=True, available=[], looking_for_genders=[])
            ph = ProfilePhoto(profile=pr, visibility="public", order=0, caption="")
            ph.image.save(f"{label.lower()}-0.jpg", ContentFile(dc.avatar(label, pal[k % len(pal)])), save=True)
        except Exception:  # noqa: BLE001 - the person exists; the profile is a bonus (community module off)
            logger.exception("Demo profile for %s failed", email)
        made += 1
    return made


class _Out:
    def write(self, *_a):
        pass


def make_content(parts=("plans", "money", "faq", "pages")):
    """Subscriptions, donation campaigns with gifts, subscribers, FAQ and pages (only the `parts` asked for)."""
    from apps.faq.models import FaqEntry
    from apps.pages.models import Page
    from apps.plugins import facade

    DonationCampaign, Plan = facade.models("subscriptions", "DonationCampaign", "Plan")  # (the plugin Abonnementen; without it these are empty)
    from .management.commands import demo_content as dc

    made = {}
    had = set(Plan.objects.values_list("pk", flat=True))
    for slug, name, desc, price, hi, grants in (dc.PLANS if "plans" in parts or "money" in parts else []):
        Plan.objects.get_or_create(slug=slug, defaults=dict(name=name, description=desc, price=price, interval="month", highlight=hi, grants=grants, system_object=True, order=Plan.objects.count()))
    new = set(Plan.objects.values_list("pk", flat=True)) - had
    _remember("plans", new)
    made["plans"] = len(new)
    had = set(DonationCampaign.objects.values_list("pk", flat=True))
    if "money" in parts:
        dc.money_demo(_Out())
    new = set(DonationCampaign.objects.values_list("pk", flat=True)) - had
    _remember("campaigns", new)
    made["campaigns"] = len(new)
    from . import demo_intranet

    intranet = demo_intranet.active()
    if "faq" in parts and not _ids("faq"):
        rows = demo_intranet.make_faq() if intranet else [FaqEntry.objects.create(question={"nl": qn, "en": qe}, answer={"nl": an, "en": ae}, order=900 + i) for i, (qn, an, qe, ae) in enumerate(FAQ)]
        _remember("faq", [r.pk for r in rows])
        made["faq"] = len(rows)
    n = 0
    if "pages" in parts and intranet:
        n = demo_intranet.make_pages()
    for i, (key, nl, en) in enumerate(PAGES if "pages" in parts and not intranet else []):
        if not Page.objects.filter(key=key).exists():
            Page.objects.create(key=key, kind="content", title={"nl": nl, "en": en}, enabled=True, in_menu=False, order=900 + i, source="demo")
            n += 1
    made["pages"] = n
    return made


PART_ORDER = ["media", "heroes", "users", "plans", "money", "faq", "pages", "views"]


def parts_for(preset=None, content=True, objects=True, orders=True, media=1, heroes=1, users=1, ignore_drop=False):
    """The parts of the demo data for a standard installation (or for everything): what its modules and plugins use."""
    want, only, views = None, None, True
    if preset:
        from . import presets

        p = presets.get(preset)
        want, only = presets._wanted_modules(p), set(presets.plugins_for(p))
    has = lambda *m: want is None or bool(want & set(m))  # noqa: E731
    out = []
    if media and (has("media") or only):
        out.append("media")
    if heroes and has("media"):
        out.append("heroes")
    if users and has("profiles", "discover", "messages", "chat", "subscriptions", "donations", "orders"):
        out.append("users")
    if content:
        out += [x for x, on in (("plans", has("subscriptions", "donations")), ("money", has("subscriptions", "donations")), ("faq", has("faq")), ("pages", has("pages"))) if on]
    if objects and has("media"):
        out.append("views")
    out += [f"plugin:{n}" for n, _p in _plugins_named(only)]
    if preset and not ignore_drop:  # parts the superadmin left out of this installation's demo data
        drop = set(presets.demo_config(preset)["drop"])
        out = [x for x in out if x not in drop]
    return out


def _clean(media, users, heroes):
    return max(0, min(80, int(media or 0))), max(0, min(200, int(users or 0))), max(0, min(24, int(heroes or 0)))


def plan(preset=None, content=True, objects=True, orders=True, media=16, heroes=6, users=8, shops=None):
    """The steps to make the demo data for a standard installation, in order: [part]. A step that is already done is left out (a chosen example shop and the repair of pictures stay)."""
    media, users, heroes = _clean(media, users, heroes)
    return [x for x in parts_for(preset, content, objects, orders, media, heroes, users) if not present(x) or (x.startswith("plugin:") and (shops or x))]


class NeedsPlugin(Exception):
    """A step of the demo data needs a plugin that is off: the screen asks to switch it on."""

    def __init__(self, name):
        super().__init__(name)
        self.name = name


def create_part(part, media=16, users=8, objects=True, orders=True, heroes=6, shops=None):
    """Make one part of the demo data. Returns what was made."""
    from apps.medialib import mediaviews

    media, users, heroes = _clean(media, users, heroes)
    made = {}
    if part == "media":
        made["images"] = len(mediaviews.demo_images(media))
    elif part == "heroes":
        made["heroes"] = len(mediaviews.demo_heroes(heroes))
    elif part == "users":
        made["users"] = make_users(users)
    elif part in ("plans", "money", "faq", "pages"):
        if part in ("plans", "money"):
            from apps.plugins import facade

            if facade.provider("subscriptions") is None:
                raise NeedsPlugin("subscriptions")
        if not present(part):
            made.update(make_content((part,)))
    elif part == "views":
        made["views"] = mediaviews.demo(replace=False, count=media or 16)
    elif part.startswith("plugin:"):
        for _n, p in _plugins_named({part[7:]}):
            try:
                if present(part) and not shops:
                    if hasattr(p, "repair"):
                        made["images_linked"] = p.repair()  # the pictures that were lost are linked again
                    continue
                for k, v in (p.create(objects=objects, orders=orders, use_media=present("media"), **({"sets": shops} if shops else {})) or {}).items():
                    made[k] = made.get(k, 0) + (v if isinstance(v, int) else 0)
            except Exception:  # noqa: BLE001
                logger.exception("Demo data of a plugin failed")
                made.setdefault("errors", []).append(part)
    return made


def finish(preset, parts):
    """The demo data of this installation is complete: write it down (so it can be taken away again) and refresh the system objects."""
    from apps.sysobjects import service as so

    reg = registry()
    reg[preset or "_all"] = list(parts)
    _set_registry(reg)
    try:
        from . import themepacks

        themepacks.logos_to_library()  # also after the demo data (the library of a clean site then has the logos too)
    except Exception:  # noqa: BLE001
        logger.exception("Logos could not be put in the media library")
    if preset:
        try:
            from . import presets

            presets.relink_saved_pages(preset)  # a page saved in this installation gets its pictures from the demo data
        except Exception:  # noqa: BLE001
            logger.exception("Linking pictures of saved pages failed")
    try:
        so.sync()
    except Exception:  # noqa: BLE001
        logger.exception("System objects sync failed")


def create(media=16, users=8, content=True, objects=True, orders=True, preset=None, heroes=6, shops=None):
    """Make the demo data for a standard installation (or all of it) in one go; only the parts that are not there yet are made, so more installations add to each other."""
    media, users, heroes = _clean(media, users, heroes)
    parts = parts_for(preset, content, objects, orders, media, heroes, users)
    todo = plan(preset, content, objects, orders, media, heroes, users, shops)
    made = {}
    for part in todo:
        for k, v in create_part(part, media, users, objects, orders, heroes, shops).items():
            made[k] = made.get(k, 0) + v if isinstance(v, int) else v
    finish(preset, parts)
    made["skipped"] = [x for x in parts if x not in todo]
    return made


def _release_media(ids):
    """The tables of plugins (also of plugins that are off now) may still point at these pictures: let go of them before the pictures are deleted."""
    from django.db import connection

    ids = list(ids)
    if not ids:
        return
    with connection.cursor() as cur:
        for table in [t for t in connection.introspection.table_names() if t.startswith("plg_")]:
            for col, (_ref, ref_table) in connection.introspection.get_relations(cur, table).items():
                if ref_table == "medialib_mediaitem":
                    cur.execute('UPDATE "%s" SET "%s" = NULL WHERE "%s" IN (%s)' % (table, col, col, ",".join("%s" for _ in ids)), ids)


def remove_parts(parts):
    """Take away these parts of the demo data in the safe order: plugins (orders first), the money, the content, the people, the media."""
    from apps.faq.models import FaqEntry
    from apps.medialib import mediaviews
    from apps.medialib.models import MediaItem
    from apps.pages.models import Page
    from apps.plugins import facade

    Donation, DonationCampaign, Plan, Subscription = facade.models("subscriptions", "Donation", "DonationCampaign", "Plan", "Subscription")
    from apps.sysobjects import service as so
    from .management.commands import demo_content as dc

    parts, done = set(parts), {}
    for part in [x for x in parts if x.startswith("plugin:")]:
        for _n, p in _plugins_named({part[7:]}):
            try:
                for k, v in (p.remove() or {}).items():
                    done[k] = done.get(k, 0) + (v if isinstance(v, int) else 0)
            except Exception:  # noqa: BLE001
                logger.exception("Removing demo data of a plugin failed")
    if "money" in parts:
        Donation.objects.filter(email__startswith="demo-").delete()
        Subscription.objects.filter(user__email__startswith="demo-", user__email__endswith="@example.com").delete()
        DonationCampaign.objects.filter(pk__in=_ids("campaigns")).delete()
        _forget("campaigns")
        _release_media(MediaItem.objects.filter(source=dc.SOURCE).values_list("id", flat=True))
        for m in MediaItem.objects.filter(source=dc.SOURCE):  # the pictures of the example campaigns
            try:
                default_storage.delete(m.key)
            except Exception:  # noqa: BLE001
                pass
            m.delete()
    if "plans" in parts:
        Plan.objects.filter(pk__in=_ids("plans")).exclude(pk__in=Subscription.objects.values("plan_id")).delete()  # a plan with real subscribers stays
        _forget("plans")
    if "faq" in parts:
        FaqEntry.objects.filter(pk__in=_ids("faq")).delete()
        _forget("faq")
    if "pages" in parts:
        done["pages"] = Page.objects.filter(source="demo").count()
        Page.objects.filter(source="demo").delete()
        from . import demo_intranet

        demo_intranet.remove_pages()
    if "users" in parts:
        users = _users_qs()
        done["users"] = done.get("users", 0) + users.count()
        try:
            from apps.plugins import facade

            ProfilePhoto = facade.models("community", "ProfilePhoto")
            for ph in ProfilePhoto.objects.filter(profile__user__in=users):
                try:
                    ph.image.delete(save=False)
                except Exception:  # noqa: BLE001
                    pass
        except Exception:  # noqa: BLE001
            pass
        try:
            from apps import commerce

            ids = list(users.values_list("id", flat=True))
            o = commerce.orders()
            if o:
                o.detach_users(ids)  # orders of these people stay (without the person)
            elif ids:  # the plugin Orders is off: its table is still there
                from django.db import connection

                if "plg_orders_order" in connection.introspection.table_names():
                    with connection.cursor() as cur:
                        cur.execute("UPDATE plg_orders_order SET user_id = NULL WHERE user_id IN (%s)" % ",".join("%s" for _ in ids), ids)
        except Exception:  # noqa: BLE001
            logger.exception("Detaching orders from demo users failed")
        users.delete()
        from . import demo_intranet

        demo_intranet.remove_people()
    if "views" in parts:
        done["views"] = mediaviews.remove_demo(["views"]).get("views", 0)
    for part, q in (("heroes", MediaItem.objects.filter(source="media-demo", name__startswith="Hero ")), ("media", MediaItem.objects.filter(source="media-demo").exclude(name__startswith="Hero "))):
        if part in parts:
            n = 0
            _release_media(q.values_list("id", flat=True))
            for m in q:
                try:
                    default_storage.delete(m.key)
                except Exception:  # noqa: BLE001
                    pass
                m.delete()
                n += 1
            done["images" if part == "media" else "heroes"] = n
    try:
        so.sync()
    except Exception:  # noqa: BLE001
        pass
    return done


def remove(preset=None):
    """Remove the demo data of one standard installation (what no other installation with demo data needs), or everything when no installation is given."""
    reg = registry()
    if preset and preset in reg:
        mine = set(reg.pop(preset))
        keep = {x for v in reg.values() for x in v}
        if any(x == "money" or x.startswith("plugin:") for x in keep):
            keep.add("users")  # their subscriptions, gifts and orders belong to these people
        if "money" in keep:
            keep.add("plans")
        done = remove_parts(mine - keep)
        _set_registry(reg)
        return done
    present_parts = [x for x in PART_ORDER if present(x)] + [f"plugin:{n}" for n, _p in _plugins_named() if present(f"plugin:{n}")]
    done = remove_parts(present_parts)
    _set_registry({})
    return done
