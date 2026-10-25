# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo people for the standard installations that are not the Datingplatform or the Intranet (those have their own files): twelve people with a picture,
a function and, where the installation has the plugin Community, a full profile in the fields of its theme, three photos, and what happens between them
(messages, chats, favourites, visits, likes and requests). The first eight have the names of the example community, because the demo subscriptions and gifts
(demo_content.money_demo) belong to them. Everything is recognisable (demo-…@example.com) and goes away with the demo data."""
import datetime
import logging

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from . import demo_dating as dd

logger = logging.getLogger(__name__)

# name, gender, birth year, city, colour
POOL = [("Sophie", "f", 1996, "Utrecht", (230, 110, 140)), ("Daan", "m", 1992, "Amsterdam", (70, 130, 210)), ("Lotte", "f", 1999, "Rotterdam", (240, 160, 70)), ("Milan", "m", 1989, "Den Haag", (60, 160, 130)),
        ("Fleur", "f", 1994, "Eindhoven", (160, 90, 190)), ("Jesper", "m", 1997, "Groningen", (200, 90, 70)), ("Amira", "f", 1991, "Antwerpen", (50, 150, 170)), ("Tim", "m", 1995, "Gent", (110, 110, 200)),
        ("Noor", "f", 1993, "Haarlem", (200, 120, 150)), ("Bas", "m", 1986, "Leiden", (90, 120, 160)), ("Yara", "f", 1998, "Arnhem", (230, 90, 110)), ("Rik", "m", 1990, "Nijmegen", (80, 150, 100))]

# the people of an installation with the plugin Community: (function, headline, bio, interests, fields of the theme)
SETS = {
    "zakelijk-netwerk": [
        ("Marketingadviseur", "Marketing die klanten oplevert", "Ik help mkb-bedrijven met een marketingplan dat past bij hun budget.", ["Marketing", "Netwerken"], dict(company="Sophie Marketing", title="Eigenaar", industry="IT & software", size="ZZP", expertise=["Marketing", "Verkoop"], looking=["Klanten", "Partners"], offer="Marketingplan in vier weken.", website="https://example.com")),
        ("Productmanager", "Van idee naar product", "Productmanager in de fintech. Ik zoek sparringpartners en talent.", ["Producten", "Fintech"], dict(company="Finly", title="Productmanager", industry="Financieel", size="11-50", expertise=["Strategie"], looking=["Talent", "Partners"], offer="Productstrategie en discovery.", hiring=True)),
        ("Interim-manager", "Interim met resultaat", "Interim-manager in de zorg: reorganisaties, kwaliteit en teamontwikkeling.", ["Zorg", "Leiderschap"], dict(company="Lotte Interim", title="Interim-manager", industry="Zorg", size="ZZP", expertise=["Strategie"], looking=["Klanten"], offer="Interim-opdrachten van 3 tot 12 maanden.")),
        ("Directeur", "Bouwen aan vertrouwen", "Directeur van een bouwbedrijf met 40 medewerkers. Altijd op zoek naar slimme partners.", ["Bouw", "Duurzaamheid"], dict(company="Den Haag Bouw", title="Directeur", industry="Bouw", size="11-50", expertise=["Strategie", "Verkoop"], looking=["Partners", "Talent"], offer="Verbouw en nieuwbouw.", hiring=True)),
        ("Ontwerper", "Interieur met karakter", "Interieurontwerper voor kantoren en horeca.", ["Design", "Horeca"], dict(company="Fleur Design", title="Ontwerper", industry="Bouw", size="ZZP", expertise=["Marketing"], looking=["Klanten"], offer="Ontwerp en styling.")),
        ("Ontwikkelaar", "Software die werkt", "Freelance developer (Python, React). Beschikbaar voor projecten.", ["Code", "Open source"], dict(company="Jesper Dev", title="Developer", industry="IT & software", size="ZZP", expertise=["Strategie"], looking=["Klanten"], offer="Webapplicaties en integraties.", open_to_work=True, wanted_role="Freelance developer")),
        ("Vertaler", "Woorden die verbinden", "Vertaler Nederlands, Engels, Frans en Arabisch voor bedrijven en instellingen.", ["Talen", "Cultuur"], dict(company="Amira Talen", title="Vertaler", industry="Financieel", size="ZZP", expertise=["Marketing"], looking=["Klanten"], offer="Gecertificeerde vertalingen.")),
        ("Muziekdocent", "Muziek op de werkvloer", "Muziek en teambuilding: workshops voor bedrijven.", ["Muziek", "Teams"], dict(company="Tim Music", title="Docent", industry="Zorg", size="ZZP", expertise=["Marketing"], looking=["Klanten"], offer="Teamworkshops met muziek.")),
        ("Dierenarts", "Zorg voor dier en baas", "Eigen praktijk in Haarlem. Zoek partners voor samenwerking.", ["Dieren", "Zorg"], dict(company="Noor Dierenarts", title="Eigenaar", industry="Zorg", size="2-10", expertise=["Strategie"], looking=["Partners", "Talent"], offer="Dierenzorg en preventie.", hiring=True)),
        ("Docent en trainer", "Leren dat blijft hangen", "Trainer in leiderschap en communicatie.", ["Leren", "Leiderschap"], dict(company="Bas Training", title="Trainer", industry="IT & software", size="ZZP", expertise=["Strategie", "Verkoop"], looking=["Klanten"], offer="Trainingen voor teams.")),
        ("Eventmanager", "Evenementen met energie", "Ik organiseer bedrijfsevenementen van 20 tot 500 gasten.", ["Evenementen", "Dans"], dict(company="Yara Events", title="Eventmanager", industry="Financieel", size="2-10", expertise=["Marketing"], looking=["Klanten", "Partners"], offer="Evenementen van A tot Z.")),
        ("Fysiotherapeut", "Gezond ondernemen", "Fysiotherapeut met oog voor ondernemers: werkhouding, stress en herstel.", ["Gezondheid", "Sport"], dict(company="Rik Fysio", title="Eigenaar", industry="Zorg", size="2-10", expertise=["Strategie"], looking=["Klanten"], offer="Behandeling en preventie op locatie.")),
    ],
    "sportclub": [
        ("Trainer jeugd", "Elke training een feestje", "Trainer van de F-jeugd. Plezier eerst, winnen komt vanzelf.", ["Voetbal", "Jeugd"], dict(sports=["Hardlopen"], level="Gevorderd", goals=["Gezond blijven"], days=["Wo", "Za"], time="Middag", club="Onze club", buddy=True)),
        ("Aanvoerder", "Altijd vooraan", "Aanvoerder van het eerste. Ik train vier keer per week.", ["Voetbal", "Fitness"], dict(sports=["Hardlopen"], level="Wedstrijd", goals=["Wedstrijd"], days=["Ma", "Wo", "Do", "Za"], time="Avond", club="Onze club", buddy=True)),
        ("Lid", "Net begonnen en al verslaafd", "Sinds dit jaar lid. Ik train op maandag en donderdag.", ["Hardlopen", "Fitness"], dict(sports=["Hardlopen"], level="Beginner", goals=["Afvallen", "Gezond blijven"], days=["Ma", "Do"], time="Avond", club="Onze club", buddy=True)),
        ("Voorzitter", "De club draait door vrijwilligers", "Voorzitter sinds 2019. Altijd bereikbaar voor een idee.", ["Bestuur", "Zeilen"], dict(sports=["Hardlopen"], level="Gemiddeld", goals=["Gezond blijven"], days=["Za"], time="Ochtend", club="Onze club")),
        ("Lid", "Yoga en hardlopen", "Ik train graag in de ochtend en help met de kantinedienst.", ["Yoga", "Hardlopen"], dict(sports=["Hardlopen", "Zwemmen"], level="Gemiddeld", goals=["Gezond blijven"], days=["Di", "Za"], time="Ochtend", club="Onze club", buddy=True)),
        ("Lid", "Fietsen, spelletjes en bier", "Lid van het tweede. Na de wedstrijd altijd in de kantine.", ["Fietsen", "Spelletjes"], dict(sports=["Wielrennen"], level="Gemiddeld", goals=["Sterker worden"], days=["Zo"], time="Wisselend", club="Onze club", buddy=True)),
        ("Vrijwilliger", "Kantine en bar", "Ik draai in het weekend de kantine. Kom gerust langs.", ["Koken", "Reizen"], dict(sports=["Zwemmen"], level="Beginner", goals=["Gezond blijven"], days=["Za"], time="Middag", club="Onze club")),
        ("Trainer senioren", "Muziek in de kleedkamer", "Trainer van de senioren en muzikant. De sfeer moet goed zijn.", ["Muziek", "Sport"], dict(sports=["Hardlopen"], level="Gevorderd", goals=["Wedstrijd"], days=["Ma", "Wo"], time="Avond", club="Onze club", coach=True)),
        ("Lid", "Hardlopen met mijn hond", "Ik loop elke dag en neem mijn hond mee naar de club.", ["Honden", "Hardlopen"], dict(sports=["Hardlopen"], level="Gevorderd", goals=["Gezond blijven"], days=["Di", "Do", "Za"], time="Ochtend", club="Onze club", buddy=True)),
        ("Scheidsrechter", "Fluiten voor het plezier", "Docent en scheidsrechter. Ik houd van heldere afspraken.", ["Scheidsrechter", "Geschiedenis"], dict(sports=["Hardlopen"], level="Gemiddeld", goals=["Gezond blijven"], days=["Za"], time="Ochtend", club="Onze club")),
        ("Lid", "Dansen en trainen", "Ik train elke woensdag en ben dol op toernooien.", ["Dansen", "Toernooien"], dict(sports=["Hardlopen"], level="Gemiddeld", goals=["Sterker worden"], days=["Wo"], time="Avond", club="Onze club", buddy=True)),
        ("Fysio", "Blessurevrij door het seizoen", "Clubfysio. Blessure? Loop op dinsdag even binnen.", ["Fysiotherapie", "Klimmen"], dict(sports=["Hardlopen"], level="Gevorderd", goals=["Gezond blijven"], days=["Di"], time="Middag", club="Onze club", coach=True)),
    ],
    "marktplaats": [
        ("Verkoper", "Tweedehands met zorg", "Ik verkoop kleding en boeken die nog goed zijn. Verzenden kan.", ["Kleding", "Boeken"], dict(shop="Sophie's kast", category="Mode", delivery="1-2 dagen", region=["Nederland"], payment=["iDEAL"])),
        ("Handelaar", "Festivalspullen en gadgets", "Ik koop en verkoop festivalspullen, tenten en elektronica.", ["Festival", "Elektronica"], dict(shop="Daan Gear", category="Elektronica", delivery="Dezelfde dag", region=["Nederland", "België"], payment=["iDEAL", "Creditcard"])),
        ("Yogadocent", "Lessen en workshops", "Ik geef yoga en adem-workshops. Boek een les via mijn aanbod.", ["Yoga", "Ademwerk"], dict(shop="Lotte Yoga", category="Sport", delivery="Dezelfde dag", region=["Nederland"], payment=["iDEAL"])),
        ("Ondernemer", "Zeil- en watersport", "Zeilspullen en cursussen. Ik help je graag op weg.", ["Zeilen", "Water"], dict(shop="Milan Marine", category="Sport", delivery="3-5 dagen", region=["Nederland", "Duitsland"], payment=["iDEAL", "PayPal"])),
        ("Designer", "Meubels met een verhaal", "Ik restaureer meubels en verkoop unieke stukken.", ["Meubels", "Design"], dict(shop="Fleur Vintage", category="Wonen", delivery="3-5 dagen", region=["Nederland"], payment=["iDEAL"])),
        ("Gamer", "Games en consoles", "Ik ruil en verkoop games, consoles en accessoires.", ["Gamen", "Retro"], dict(shop="Jesper Games", category="Elektronica", delivery="1-2 dagen", region=["Nederland", "België"], payment=["iDEAL", "Achteraf"])),
        ("Kok", "Streetfood en kookworkshops", "Ik geef kookworkshops en verkoop zelfgemaakte sauzen.", ["Koken", "Reizen"], dict(shop="Amira Kitchen", category="Wonen", delivery="1-2 dagen", region=["België", "Nederland"], payment=["iDEAL", "Creditcard"])),
        ("Muzikant", "Gitaren en lessen", "Ik verkoop gitaren en geef les in Gent.", ["Gitaar", "Les"], dict(shop="Tim Strings", category="Elektronica", delivery="3-5 dagen", region=["België"], payment=["iDEAL"])),
        ("Dierenarts", "Alles voor je huisdier", "Ik verkoop huisdierartikelen en geef advies.", ["Honden", "Katten"], dict(shop="Noor Pets", category="Wonen", delivery="1-2 dagen", region=["Nederland"], payment=["iDEAL"])),
        ("Docent", "Boeken en lessen", "Ik verkoop boeken en geef bijles geschiedenis.", ["Boeken", "Bijles"], dict(shop="Bas Boeken", category="Mode", delivery="3-5 dagen", region=["Nederland"], payment=["iDEAL"])),
        ("Danseres", "Dans en kleding", "Danslessen en danskleding in alle maten.", ["Dans", "Kleding"], dict(shop="Yara Dance", category="Sport", delivery="1-2 dagen", region=["Nederland"], payment=["iDEAL"])),
        ("Klusser", "Gereedschap en klussen", "Gereedschap te koop en klussen te boeken.", ["Klussen", "Fietsen"], dict(shop="Rik Klus", category="Wonen", delivery="Dezelfde dag", region=["Nederland"], payment=["iDEAL", "Achteraf"])),
    ],
    "spelletjessite": [
        ("Speler", "Puzzelaar en puntenjager", "Ik speel elke dag een uur en wil bovenaan staan.", ["Puzzels", "Snake"], dict(occupation="Redacteur", languages=["Nederlands", "Engels"], hobbies="Puzzels, lezen")),
        ("Speler", "Bordspellen en toernooien", "Ik zoek tegenstanders voor het wekelijkse toernooi.", ["Bordspellen", "Toernooien"], dict(occupation="Productmanager", languages=["Nederlands", "Engels"], hobbies="Spellen, festivals")),
        ("Speler", "Casual maar competitief", "Spelletjes zijn mijn ontspanning na yoga.", ["Casual", "Yoga"], dict(occupation="Yogadocent", languages=["Nederlands"], hobbies="Yoga, spellen")),
        ("Speler", "Strategie en schaken", "Ik hou van strategie en win graag in de laatste ronde.", ["Strategie", "Schaken"], dict(occupation="Ondernemer", languages=["Nederlands", "Engels", "Duits"], hobbies="Schaken, hardlopen")),
        ("Speler", "Designer en dobbelaar", "Ik ontwerp zelf spellen en test ze hier.", ["Design", "Dobbelen"], dict(occupation="Ontwerper", languages=["Nederlands", "Engels"], hobbies="Ontwerpen, films")),
        ("Speler", "Gamer sinds mijn zesde", "Mijn record in Snake is nog niet verbroken.", ["Retro", "Snake"], dict(occupation="Developer", languages=["Nederlands", "Engels"], hobbies="Gamen, fietsen")),
        ("Speler", "Reizen en raadsels", "Een goede puzzel op reis is alles wat ik nodig heb.", ["Raadsels", "Reizen"], dict(occupation="Vertaler", languages=["Nederlands", "Frans", "Engels"], hobbies="Reizen, talen")),
        ("Speler", "Gitaar en spelletjes", "Na een repetitie een potje boter-kaas-en-eieren.", ["Muziek", "Tic tac toe"], dict(occupation="Muziekdocent", languages=["Nederlands", "Engels"], hobbies="Muziek, bier")),
        ("Speler", "Kat op schoot, spel op scherm", "Ik speel in de avond met een kat op schoot.", ["Katten", "Puzzels"], dict(occupation="Dierenarts", languages=["Nederlands", "Engels"], hobbies="Dieren, koken")),
        ("Speler", "Geschiedenis en schaken", "Ik leer mijn leerlingen spelletjes uit alle eeuwen.", ["Geschiedenis", "Schaken"], dict(occupation="Docent", languages=["Nederlands", "Engels", "Duits"], hobbies="Geschiedenis, koken")),
        ("Speler", "Dansen op de ranglijst", "Reactiespellen zijn mijn favoriet: snel en spannend.", ["Reactie", "Dans"], dict(occupation="Student", languages=["Nederlands", "Spaans"], hobbies="Dansen, reizen")),
        ("Speler", "Klimmer en puzzelaar", "Ik los een puzzel op als een route op de muur.", ["Puzzels", "Klimmen"], dict(occupation="Fysiotherapeut", languages=["Nederlands", "Engels"], hobbies="Klimmen, kamperen")),
    ],
}
# installations without the plugin Community: the people have a picture and a function (customers, donors, colleagues ...)
SIMPLE = {
    "webshop": ("Klant", "Vaste klant van de webwinkel."), "standaard-website": ("Redacteur", "Schrijft mee aan de website."),
    "bedrijfswebsite": ("Medewerker", "Werkt mee aan de bedrijfswebsite."), "stichting": ("Donateur", "Steunt de stichting met een gift of maandelijks bedrag."),
}
# who does what with whom (index into the twelve people)
LIKES = [(0, 1), (1, 0), (2, 3), (3, 2), (4, 8), (8, 4), (5, 9), (6, 7), (7, 6), (10, 11), (11, 10), (9, 5), (0, 4), (3, 6)]
FAVORITES = [(0, 1), (1, 2), (2, 3), (4, 8), (6, 7), (9, 5), (10, 11)]
VISITS = {0: [1, 2, 3, 4], 1: [0, 5, 6], 2: [3, 7], 3: [2, 8, 9], 4: [8, 10], 6: [7, 11]}
FRIENDS = [(0, 1, "accepted", ""), (2, 3, "accepted", ""), (4, 8, "pending", "Hoi! Zullen we kennismaken?"), (6, 7, "accepted", "")]
CHATS = [(0, 1, "Hoi! Zin om volgende week af te spreken?"), (1, 0, "Zeker, donderdag past goed."), (2, 3, "Dank je voor de tip!"), (3, 2, "Graag gedaan 🙂"), (4, 8, "Heb je het bericht gezien?")]
THREADS = {
    "zakelijk-netwerk": [(0, 1, "Kennismaking", "Hoi Daan, ik zag dat je productmanager bent in de fintech. Heb je zin in een kop koffie om kennis te maken?"), (1, 0, "Re: Kennismaking", "Graag! Volgende week donderdag in Utrecht?"),
                         (3, 7, "Teamuitje", "Hoi Tim, kun jij een muziekworkshop voor ons team verzorgen? We zijn met veertig mensen."), (8, 4, "Samenwerken", "Fleur, laten we eens kijken of we samen een aanbieding kunnen maken voor de zorg.")],
    "sportclub": [(1, 2, "Welkom bij de club", "Hoi Lotte, leuk dat je er bent. Je kunt maandag om 19.00 uur meetrainen. Neem schoenen en water mee."), (2, 1, "Re: Welkom", "Dank je! Ik ben er. Waar kan ik me omkleden?"),
                  (3, 0, "Vrijwilligers gezocht", "Sophie, kunnen we je zaterdag in de kantine gebruiken? Je krijgt koffie en een broodje."), (5, 4, "Tip voor een toernooi", "Fleur, heb je zin om volgend weekend mee te doen aan het toernooi? We missen nog een speler.")],
    "marktplaats": [(1, 0, "Vraag over je jas", "Hoi Sophie, is de jas nog beschikbaar? Ik kan morgen ophalen in Utrecht."), (0, 1, "Re: Vraag over je jas", "Ja hoor, hij is nog te koop. Morgen na zes uur past goed."),
                    (5, 4, "Boeking yogales", "Hoi Lotte, ik wil graag een les boeken voor zaterdag. Is er nog plek?"), (2, 5, "Re: Boeking", "Zeker, er is nog plek. Ik bevestig je boeking direct.")],
    "spelletjessite": [(1, 0, "Uitdaging", "Hoi Sophie, ik heb jouw score in Snake gezien. Durf je een potje tegen mij?"), (0, 1, "Re: Uitdaging", "Haha, durf ik! Zaterdagavond in een kamer?"),
                       (5, 9, "Toernooi", "Bas, doe je mee aan het vrijdagtoernooi? We zijn nog een speler tekort."), (3, 2, "Tips", "Lotte, probeer eens de nieuwe puzzel. Eerst even de hoeken oplossen!")],
}


def active_key():
    from . import presets

    key = presets.active()
    return key if key in SETS or key in SIMPLE else None


def _users():
    U = get_user_model()
    out = {i: U.objects.filter(email=f"demo-{p[0].lower()}@example.com").first() for i, p in enumerate(POOL)}
    out["A"] = U.objects.filter(is_staff=True).order_by("id").first()
    return out


def make_people(key, n):
    from apps.plugins import facade

    from .management.commands import demo_content as dc

    Profile, ProfilePhoto = facade.models("community", "Profile", "ProfilePhoto")
    User, made = get_user_model(), 0
    sets = SETS.get(key)
    for k, (name, g, year, city, rgb) in enumerate(POOL):
        email = f"demo-{name.lower()}@example.com"
        if User.objects.filter(email=email).exists():
            continue
        cc, lat, lon = dd.CITIES[city]
        function, headline, bio, interests, fields = (sets[k] if sets else (SIMPLE[key][0], "", SIMPLE[key][1], [], {}))
        u = User(username=email, email=email, first_name=name, last_name="Demo", display_name=name, gender=g, birth_date=datetime.date(year, 1 + k % 12, 1 + (k * 5) % 27), is_active=True,
                 city=city, country=cc, function=function, short=headline or function, description=bio, phone=f"+316130000{k:02d}")
        u.set_unusable_password()
        u.save()
        try:
            u.image.save(f"{name.lower()}.jpg", ContentFile(dc.avatar(name, rgb)), save=True)  # a picture of the person also without a profile
        except Exception:  # noqa: BLE001
            logger.exception("Picture of demo person %s failed", email)
        made += 1
        if not sets or Profile is facade._NullModel:
            continue
        try:
            pr = Profile.objects.create(user=u, slug=f"{name.lower()}-demo", enabled=True, visibility="members", headline=headline, bio=bio, discover=True, gender=g, birth_date=u.birth_date, city=city, country=cc,
                                        interests=interests, accept_messages=True, accept_chat=True, searchable_local=True, data=fields, aim="friends", lat=lat, lon=lon, show_distance=True, available=[], looking_for_genders=[])
            for i in range(3):
                shade = tuple(min(255, max(0, c + (i - 1) * 28)) for c in rgb)
                ProfilePhoto(profile=pr, visibility=("public", "members", "members")[i], order=i, caption=("", "", "")[i]).image.save(f"{name.lower()}-{i}.jpg", ContentFile(dc.avatar(name, shade)), save=True)
        except Exception:  # noqa: BLE001
            logger.exception("Demo profile for %s failed", email)
    if sets:
        try:
            make_interactions(key)
        except Exception:  # noqa: BLE001
            logger.exception("Demo interactions failed")
    return made


def make_interactions(key):
    from datetime import timedelta

    from django.utils import timezone

    from apps.plugins import facade

    Like, Favorite, Visit, Block, Connection, Notification, Profile = facade.models("community", "Like", "Favorite", "ProfileVisit", "Block", "Connection", "Notification", "Profile")
    DirectMessage, ChatMessage = facade.models("community", "DirectMessage", "ChatMessage")
    if Like is facade._NullModel:
        return
    us, now = _users(), timezone.now()
    ok = lambda *ids: all(us.get(i) for i in ids)  # noqa: E731
    if DirectMessage.objects.filter(sender__email__startswith="demo-", sender__email__endswith="@example.com").exists():
        return
    done = set()
    for a, b in LIKES:
        if ok(a, b):
            Like.objects.get_or_create(from_user=us[a], to_user=us[b])
            done.add((a, b))
            Notification.objects.create(user=us[b], kind="match" if (b, a) in done else "like", from_user=us[a], text="Jullie hebben een match!" if (b, a) in done else "Iemand vindt jou leuk")
    for a, b in FAVORITES:
        if ok(a, b):
            Favorite.objects.get_or_create(user=us[a], target=us[b])
    for a, b, status, msg in FRIENDS:
        if ok(a, b):
            Connection.objects.get_or_create(from_user=us[a], to_user=us[b], kind="friend", defaults={"status": status, "message": msg, "decided_at": now if status != "pending" else None})
    for target, viewers in VISITS.items():
        pr = Profile.objects.filter(user=us[target]).first() if us.get(target) else None
        for v in viewers:
            if pr and us.get(v):
                Visit.objects.get_or_create(profile=pr, viewer=us[v])
    # the logged-in superadmin gets a visit, a like and a message too
    admin = us.get("A")
    if admin and us.get(0):
        pr = Profile.objects.filter(user=admin).first()
        if pr:
            Visit.objects.get_or_create(profile=pr, viewer=us[0])
        Like.objects.get_or_create(from_user=us[0], to_user=admin)
        Notification.objects.create(user=admin, kind="like", from_user=us[0], text="Iemand vindt jou leuk")
    for i, (a, b, subject, body) in enumerate(THREADS.get(key, [])):
        if ok(a, b):
            m = DirectMessage.objects.create(sender=us[a], recipient=us[b], subject=subject, body=body, read_at=now if i % 2 == 0 else None)
            DirectMessage.objects.filter(pk=m.pk).update(created_at=now - timedelta(hours=30 - i * 7))
    if admin and us.get(0):
        DirectMessage.objects.create(sender=us[0], recipient=admin, subject="Welkom!", body="Hoi, leuk dat je er bent. Laat het weten als je vragen hebt over de site.")
    for i, (a, b, body) in enumerate(CHATS):
        if ok(a, b):
            m = ChatMessage.objects.create(sender=us[a], recipient=us[b], body=body, read_at=now if i < 3 else None)
            ChatMessage.objects.filter(pk=m.pk).update(created_at=now - timedelta(minutes=(len(CHATS) - i) * 9))
