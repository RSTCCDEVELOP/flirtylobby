"""Voorbeeldinhoud om de vormgeving van alle pagina's mee af te stellen: webshop (groepen, producten met afbeelding, verzending, kortingscode),
abonnementen en community (voorbeeldleden met foto, likes, berichten en verzoeken). Veilig opnieuw te draaien (maakt niets dubbel); --remove haalt het weer weg."""
import io
import uuid

from django.apps import apps
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

SOURCE = "demo"
GROUPS = [("Kleding", "kleding"), ("Accessoires", "accessoires"), ("Cadeaus", "cadeaus")]
PRODUCTS = [
    ("Easy2edit T-shirt", "easy2edit-t-shirt", "Zacht katoenen shirt met het logo.", 24.95, "kleding", (255, 120, 60)),
    ("Hoodie Classic", "hoodie-classic", "Warme hoodie met capuchon, uniseks.", 49.95, "kleding", (60, 90, 200)),
    ("Petje Sunset", "petje-sunset", "Verstelbare pet in zonsondergangkleuren.", 17.5, "accessoires", (240, 170, 60)),
    ("Tote bag", "tote-bag", "Stevige katoenen tas voor elke dag.", 12.0, "accessoires", (70, 160, 130)),
    ("Koffiemok", "koffiemok", "Keramische mok, vaatwasserbestendig.", 11.5, "cadeaus", (170, 80, 150)),
    ("Cadeaubon 25 euro", "cadeaubon-25", "Een cadeaubon om zelf uit te kiezen.", 25.0, "cadeaus", (50, 140, 190)),
]
PLANS = [
    ("basis", "Basis", "Alles om te beginnen.", 0, False, [{"type": "likes", "ref": "", "value": 10}]),
    ("plus", "Plus", "Meer likes en berichten, zonder reclame.", 4.95, True, [{"type": "likes", "ref": "", "value": 50}, {"type": "chat", "ref": "", "value": 0}]),
    ("premium", "Premium", "Alles ontgrendeld, met voorrang.", 9.95, False, [{"type": "likes", "ref": "", "value": 500}, {"type": "chat", "ref": "", "value": 0}, {"type": "video_chat", "ref": "", "value": 0}]),
]


def picture(label, rgb):
    from PIL import Image, ImageDraw, ImageFont

    w, h = 900, 900
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        k = y / h
        for x in range(w):
            px[x, y] = tuple(int(c * (1 - 0.45 * k) + 255 * 0.15 * (x / w)) for c in rgb)
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
    except Exception:
        font = ImageFont.load_default()
    d.ellipse((w // 2 - 190, h // 2 - 250, w // 2 + 190, h // 2 + 130), fill=(255, 255, 255, 40), outline=(255, 255, 255), width=6)
    tw = d.textlength(label, font=font)
    d.text(((w - tw) / 2, h - 190), label, fill="white", font=font)
    out = io.BytesIO()
    im.save(out, "JPEG", quality=85)
    return out.getvalue()


MEMBERS = [
    ("Sophie", "f", 1996, "Utrecht", "NL", "Dol op koffie, boeken en lange wandelingen.", ["Wandelen", "Lezen", "Koffie"], "relationship", (230, 110, 140)),
    ("Daan", "m", 1992, "Amsterdam", "NL", "Zoek een maatje voor festivals en een goede bak koffie.", ["Muziek", "Festivals", "Reizen"], "friends", (70, 130, 210)),
    ("Lotte", "f", 1999, "Rotterdam", "NL", "Yogalerares met een zwak voor sushi.", ["Yoga", "Sushi", "Fotografie"], "dating", (240, 160, 70)),
    ("Milan", "m", 1989, "Den Haag", "NL", "Ondernemer, hardloper en hobbykok.", ["Hardlopen", "Koken", "Zeilen"], "relationship", (60, 160, 130)),
    ("Fleur", "f", 1994, "Eindhoven", "NL", "Ontwerpster. Mijn kat vindt jou vast ook leuk.", ["Design", "Katten", "Films"], "dating", (160, 90, 190)),
    ("Jesper", "m", 1997, "Groningen", "NL", "Gamer, fietser en altijd in voor een spelletje.", ["Gamen", "Fietsen", "Spelletjes"], "chat", (200, 90, 70)),
    ("Amira", "f", 1991, "Antwerpen", "BE", "Reislustig, nieuwsgierig en gek op street food.", ["Reizen", "Eten", "Talen"], "friends", (50, 150, 170)),
    ("Tim", "m", 1995, "Gent", "BE", "Muzikant. Zoekt iemand om mee te duetten.", ["Gitaar", "Concerten", "Bier"], "dating", (110, 110, 200)),
]


def avatar(label, rgb):
    from PIL import Image, ImageDraw, ImageFont

    w, h = 600, 800
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            k = (x + y) / (w + h)
            px[x, y] = tuple(int(c * (1 - 0.5 * k) + 255 * 0.2 * k) for c in rgb)
    d = ImageDraw.Draw(im)
    d.ellipse((w // 2 - 110, 190, w // 2 + 110, 410), fill=(255, 255, 255))
    d.ellipse((w // 2 - 220, 450, w // 2 + 220, 950), fill=(255, 255, 255))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 54)
    except Exception:
        font = ImageFont.load_default()
    d.text(((w - d.textlength(label, font=font)) / 2, 700), label, fill=rgb, font=font)
    out = io.BytesIO()
    im.save(out, "JPEG", quality=85)
    return out.getvalue()


def community(stdout):
    pal = palette()
    import datetime

    from django.contrib.auth import get_user_model

    from apps.social.models import AvailabilityOption, Connection, DirectMessage, Like, Profile, ProfilePhoto, ProfileVisit

    User = get_user_model()
    me = User.objects.filter(is_staff=True).order_by("id").first()
    avail = list(AvailabilityOption.objects.values_list("key", flat=True)[:6]) if hasattr(AvailabilityOption, "key") else []
    made = []
    for i, (name, g, year, city, cc, bio, interests, aim, rgb) in enumerate(MEMBERS):
        email = f"demo-{name.lower()}@example.com"
        u, new = User.objects.get_or_create(email=email, defaults=dict(username=email, first_name=name, display_name=name, gender=g, birth_date=datetime.date(year, 3 + i, 10 + i), is_active=True))
        if new:
            u.set_unusable_password()
            u.save()
        pr, _ = Profile.objects.get_or_create(user=u, defaults=dict(slug=f"{name.lower()}-demo", enabled=True, visibility="members", headline=f"Hoi, ik ben {name}!", bio=bio, discover=True, gender=g, birth_date=u.birth_date, city=city, country=cc, interests=interests, aim=aim, accept_messages=True, accept_chat=True, searchable_local=True, available=avail[: 1 + i % 4], looking_for_genders=[]))
        pr.photos.all().delete()
        if True:
            for n in range(3):
                ph = ProfilePhoto(profile=pr, visibility="public", order=n, caption="")
                ph.image.save(f"{name.lower()}-{n}.jpg", ContentFile(avatar(f"{name} {n + 1}", tuple(max(0, min(255, c + n * 25 - 25)) for c in pal[i % len(pal)]))), save=True)
        made.append(u)
    if me:
        for n, u in enumerate(made):
            if n % 2 == 0:
                Like.objects.get_or_create(from_user=u, to_user=me)
            if n % 3 == 0:
                Like.objects.get_or_create(from_user=me, to_user=u)
            if n < 3:
                ProfileVisit.objects.get_or_create(profile=Profile.objects.get(user=me), viewer=u) if Profile.objects.filter(user=me).exists() else None
            if n < 4 and not DirectMessage.objects.filter(sender=u, recipient=me).exists():
                DirectMessage.objects.create(sender=u, recipient=me, subject="Hoi!", body=f"Hoi, ik zag je profiel en ben benieuwd naar je. Zin om te kletsen? Groet, {u.first_name}")
            if n in (4, 5):
                Connection.objects.get_or_create(from_user=u, to_user=me, kind="friend", defaults=dict(message="Leuk om kennis te maken!"))
    stdout.write(f"Voorbeeldleden: {len(made)}")


CAMPAIGNS = [
    ("nieuwe-server", "Een snellere server", "Help ons de site sneller en veiliger te maken.", "Help ons de site sneller en veiliger te maken.", "Help us make the site faster and safer.", 5, 100, 25, 1500),
    ("steun-een-lid", "Steun onze community", "Een gift voor de moderatoren en vrijwilligers die de community gezellig houden.", "Een gift voor de moderatoren en vrijwilligers die de community gezellig houden.", "A gift for the volunteers who keep the community friendly.", 2, 50, 10, 500),
]
GIFTS = [("Sophie", 10, "Mooie site, ga zo door!"), ("Daan", 25, "Voor de koffie."), ("Lotte", 5, ""), ("Milan", 50, "Bedankt voor alles."), ("Fleur", 15, "Veel succes!"), ("Anoniem", 20, "")]


def money_demo(stdout):
    """Examples for the pages of subscriptions and donations: more campaigns, gifts that were paid, members with a subscription."""
    import datetime

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from apps.medialib.models import MediaItem
    from apps.subscriptions.models import Donation, DonationCampaign, Plan, Subscription

    pal = palette()
    for i, (slug, name, d_nl, d_nl2, d_en, lo, hi, dflt, goal) in enumerate(CAMPAIGNS):
        if DonationCampaign.objects.filter(slug=slug).exists():
            continue
        key = default_storage.save(f"library/demo/{uuid.uuid4().hex[:8]}-{slug}.jpg", ContentFile(picture(name, pal[(i + 2) % len(pal)])))
        m, _ = MediaItem.objects.update_or_create(key=key, defaults=dict(name=f"{name}.jpg", kind="image", mime="image/jpeg", size=default_storage.size(key), source=SOURCE, tags=["demo", "donatie", "actie"]))
        DonationCampaign.objects.create(slug=slug, name=name, description=d_nl, recipient="de makers", min_amount=lo, max_amount=hi, step=1, default_amount=dflt, goal=goal, names={"nl": name, "en": name}, descriptions={"nl": d_nl, "en": d_en}, recipients={"nl": "de makers", "en": "the creators"},
                                       button={"as_button": True, "labels": {"nl": "Doneer", "en": "Donate"}, "icon": "heart", "variant": "primary", "size": "md", "radius": "default", "color": ""}, system_object=True,
                                       info={"titles": {"nl": name, "en": name}, "texts": {"nl": d_nl2, "en": d_en}, "media": m.id, "placement": "center:m"}, order=i + 1)
    camps = list(DonationCampaign.objects.filter(active=True).order_by("id"))
    now = timezone.now()
    if camps and not Donation.objects.filter(email__startswith="demo-").exists():
        for n, (who, amount, msg) in enumerate(GIFTS):
            c = camps[n % len(camps)]
            Donation.objects.create(campaign=c, name=who, email=f"demo-{who.lower()}@example.com", amount=amount, message=msg, anonymous=who == "Anoniem", status="paid", paid_at=now - datetime.timedelta(days=n * 3), payment_ref=f"demo{n}")
    User = get_user_model()
    plans = list(Plan.objects.order_by("price"))
    if plans:
        states = [("active", 1), ("active", 2), ("trial", 1), ("canceled", 2), ("active", 2), ("pending", 1), ("past_due", 2), ("active", 0)]
        for n, (name, *_r) in enumerate(MEMBERS):
            u = User.objects.filter(email=f"demo-{name.lower()}@example.com").first()
            st, pi = states[n % len(states)]
            if u and not Subscription.objects.filter(user=u).exists():
                pl = plans[min(pi, len(plans) - 1)]
                Subscription.objects.create(user=u, plan=pl, status=st, started_at=now - datetime.timedelta(days=40 - n), period_start=now - datetime.timedelta(days=10), period_end=now + datetime.timedelta(days=20), periods=1 + n % 3, price=pl.price, cancel_at_period_end=st == "canceled")
    stdout.write(f"Donatie-acties: {DonationCampaign.objects.count()}, donaties: {Donation.objects.count()}, abonnees: {Subscription.objects.count()}")


def remove_community():
    from django.contrib.auth import get_user_model

    get_user_model().objects.filter(email__startswith="demo-", email__endswith="@example.com").delete()


# colours of the community theme (the same as the banner of the pages): the pictures of the examples use them
PALETTES = {
    "normal": [(59, 130, 246), (99, 102, 241), (14, 165, 233), (139, 92, 246), (20, 184, 166), (245, 158, 11)],
    "dating": [(236, 72, 153), (139, 92, 246), (244, 114, 182), (249, 115, 22), (168, 85, 247), (251, 113, 133)],
    "business": [(29, 78, 216), (8, 145, 178), (15, 118, 110), (71, 85, 105), (79, 70, 229), (14, 116, 144)],
    "sporters": [(22, 163, 74), (13, 148, 136), (132, 204, 22), (234, 88, 12), (37, 99, 235), (234, 179, 8)],
    "webshop": [(249, 115, 22), (245, 158, 11), (239, 68, 68), (234, 88, 12), (251, 146, 60), (217, 119, 6)],
}


def palette():
    """The colours of the active site theme (primary and secondary colour and shades of them): the pictures of the examples use them."""
    try:
        from apps.core import themepacks

        v = themepacks.current_values()
        rgb = lambda h: tuple(int(str(h).lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))  # noqa: E731
        p, q = rgb(v["primary"]), rgb(v["secondary"])
        mix = lambda a, b, k: tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3))  # noqa: E731
        return [p, q, mix(p, q, 0.5), mix(p, (255, 255, 255), 0.25), mix(p, (0, 0, 0), 0.3), mix(q, p, 0.25)]
    except Exception:  # noqa: BLE001
        return PALETTES["normal"]


class Command(BaseCommand):
    help = "Maak voorbeeldinhoud aan (webshop, abonnementen) om de pagina's mee af te stellen."

    def add_arguments(self, parser):
        parser.add_argument("--remove", action="store_true", help="haal de voorbeeldinhoud weer weg")

    def handle(self, *a, **o):
        from apps.medialib.models import MediaItem
        from apps.plugins import runtime
        from apps.subscriptions.models import Plan

        runtime.ensure_loaded(True)

        if o["remove"]:
            remove_community()
            from apps.subscriptions.models import Donation, DonationCampaign, Subscription

            Donation.objects.filter(email__startswith="demo-").delete()
            Subscription.objects.filter(user__email__startswith="demo-").delete()
            DonationCampaign.objects.filter(slug__in=[c[0] for c in CAMPAIGNS]).delete()
            Plan.objects.filter(slug__in=[p[0] for p in PLANS]).delete()
            try:
                Product = apps.all_models["plugin_webshop"]["product"]
                Product.objects.filter(slug__in=[p[1] for p in PRODUCTS]).delete()
                apps.all_models["plugin_webshop"]["group"].objects.filter(slug__in=[g[1] for g in GROUPS]).delete()
            except KeyError:
                pass
            for m in MediaItem.objects.filter(source=SOURCE):
                default_storage.delete(m.key)
                m.delete()
            return self.stdout.write("Voorbeeldinhoud verwijderd.")

        community(self.stdout)
        for slug, name, desc, price, hi, grants in PLANS:
            Plan.objects.get_or_create(slug=slug, defaults=dict(name=name, description=desc, price=price, interval="month", highlight=hi, grants=grants, system_object=True, order=len(Plan.objects.all())))
        self.stdout.write(f"Abonnementen: {Plan.objects.count()}")
        money_demo(self.stdout)

        try:
            Group, Product, Image, Method, Discount = (apps.all_models["plugin_webshop"][n.lower()] for n in ("Group", "Product", "Image", "Method", "Discount"))
        except KeyError:
            return self.stdout.write("Webshop-plugin is niet geïnstalleerd: alleen abonnementen aangemaakt.")
        groups = {s: Group.objects.get_or_create(slug=s, defaults=dict(name=n, order=i))[0] for i, (n, s) in enumerate(GROUPS)}
        pal = palette()
        for k, (name, slug, summ, price, grp, rgb) in enumerate(PRODUCTS):
            rgb = pal[k % len(pal)]
            p, new = Product.objects.get_or_create(slug=slug, defaults=dict(name=name, summary=summ, description=f"<p>{summ}</p><p>Dit is voorbeeldtekst: zo ziet een productbeschrijving eruit op de productpagina. Past bij elk thema.</p>", price=price, stock=25, group=groups[grp]))
            if True:
                p.images.all().delete()
                key = default_storage.save(f"library/demo/{uuid.uuid4().hex[:8]}-{slug}.jpg", ContentFile(picture(name, rgb)))
                m, _ = MediaItem.objects.update_or_create(key=key, defaults=dict(name=f"{name}.jpg", kind="image", mime="image/jpeg", size=default_storage.size(key), source=SOURCE))
                Image.objects.create(product=p, media=m, alt=name)
        used = set(Image.objects.values_list("media_id", flat=True))
        for m in MediaItem.objects.filter(source=SOURCE).exclude(pk__in=used):
            default_storage.delete(m.key)
            m.delete()
        Method.objects.get_or_create(name="Standaard verzending", defaults=dict(description="Pakketpost", delivery_time="2-3 werkdagen", price=4.95, free_from=50))
        Method.objects.get_or_create(name="Ophalen", defaults=dict(description="Gratis ophalen", delivery_time="Direct", price=0))
        Discount.objects.get_or_create(code="WELKOM10", defaults=dict(description="10% korting", kind="percent", value=10))
        self.stdout.write(f"Producten: {Product.objects.count()}")
