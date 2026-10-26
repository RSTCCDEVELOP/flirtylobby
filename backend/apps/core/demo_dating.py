# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo data for the standard installation Datingplatform: 24 members with a full profile (fields of the dating theme, three photos, design, who they look for),
and what happens between them: likes, matches, favourites, visits, passes, friend requests, a block, mails, chats and notices. The logged-in superadmin gets
likes, visits and messages too, so the dashboard is not empty. Everything is recognisable (demo-…@example.com) and goes away with the demo data."""
import datetime
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone

logger = logging.getLogger(__name__)

CITIES = {  # city: (country, lat, lon), rounded like the system does
    "Amsterdam": ("NL", 52.37, 4.90), "Utrecht": ("NL", 52.09, 5.12), "Rotterdam": ("NL", 51.92, 4.48), "Den Haag": ("NL", 52.08, 4.31), "Eindhoven": ("NL", 51.44, 5.48),
    "Groningen": ("NL", 53.22, 6.57), "Haarlem": ("NL", 52.38, 4.64), "Leiden": ("NL", 52.16, 4.49), "Arnhem": ("NL", 51.98, 5.91), "Nijmegen": ("NL", 51.84, 5.85),
    "Breda": ("NL", 51.59, 4.78), "Tilburg": ("NL", 51.56, 5.09), "Antwerpen": ("BE", 51.22, 4.40), "Gent": ("BE", 51.05, 3.72),
}


def P(name, g, year, city, aim, rgb, headline, bio, interests, looking="", design="", **f):
    return dict(name=name, g=g, year=year, city=city, aim=aim, rgb=rgb, headline=headline, bio=bio, interests=interests, looking=looking, design=design, fields=f)


PEOPLE = [
    P("Sophie", "f", 1996, "Utrecht", "relationship", (230, 110, 140), "Koffie, boeken en een lange wandeling", "Dol op koffie, boeken en lange wandelingen door het bos. Ik zoek iemand om mee te lachen en mee te zwijgen.", ["Wandelen", "Lezen", "Koffie"], "m", "rose",
      height=168, body="Slank", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="HBO", job="Redacteur", languages=["Nederlands", "Engels"], pets="Kat", living="Alleen", diet="Vegetarisch", exercise="Wekelijks", music=["Pop", "Jazz"], weekend=["Wandelen", "Cultuur"], zodiac="Maagd", first_date="Koffie of thee", orientation="Heteroseksueel"),
    P("Daan", "m", 1992, "Amsterdam", "friends", (70, 130, 210), "Festivals en een goede bak koffie", "Zoek een maatje voor festivals, concerten en spontane trips. Altijd in voor een goed gesprek.", ["Muziek", "Festivals", "Reizen"], "", "ocean",
      height=183, body="Sportief", smoking="Nee", drinking="Regelmatig", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Productmanager", languages=["Nederlands", "Engels", "Spaans"], pets="Geen", living="Samenwonend", diet="Alles", exercise="Wekelijks", music=["Dance", "Rock"], weekend=["Uitgaan", "Reizen"], zodiac="Boogschutter", first_date="Drankje", orientation="Heteroseksueel"),
    P("Lotte", "f", 1999, "Rotterdam", "dating", (240, 160, 70), "Yoga, sushi en zonsondergangen", "Yogalerares met een zwak voor sushi. Op zoek naar iemand die ook van rust en avontuur houdt.", ["Yoga", "Sushi", "Fotografie"], "m", "sunset",
      height=172, body="Sportief", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="HBO", job="Yogadocent", languages=["Nederlands", "Engels"], pets="Geen", living="Alleen", diet="Vegetarisch", exercise="Dagelijks", music=["Pop", "Latin"], weekend=["Sporten", "Reizen"], zodiac="Leeuw", first_date="Wandeling", orientation="Biseksueel"),
    P("Milan", "m", 1989, "Den Haag", "relationship", (60, 160, 130), "Ondernemer, hardloper en hobbykok", "Eigen bedrijf, drie keer per week hardlopen en in het weekend koken voor vrienden. Ik zoek een vaste partner.", ["Hardlopen", "Koken", "Zeilen"], "f", "forest",
      height=187, body="Sportief", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="WO", job="Ondernemer", languages=["Nederlands", "Engels", "Duits"], pets="Hond", living="Alleen", diet="Alles", exercise="Dagelijks", music=["Jazz", "Rock"], weekend=["Sporten", "Vrienden zien"], zodiac="Steenbok", first_date="Diner", orientation="Heteroseksueel"),
    P("Fleur", "f", 1994, "Eindhoven", "dating", (160, 90, 190), "Ontwerpster met een kat", "Ontwerpster. Mijn kat vindt jou vast ook leuk. Houd van musea, films en lange diners.", ["Design", "Katten", "Films"], "", "lavender",
      height=165, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Interieurontwerper", languages=["Nederlands", "Engels", "Frans"], pets="Kat", living="Alleen", diet="Alles", exercise="Soms", music=["Pop", "Klassiek"], weekend=["Cultuur", "Thuis chillen"], zodiac="Waterman", first_date="Activiteit", orientation="Panseksueel"),
    P("Jesper", "m", 1997, "Groningen", "chat", (200, 90, 70), "Gamer, fietser, spelletjesfan", "Gamer, fietser en altijd in voor een spelletje. Eerst even kletsen, dan zien we wel.", ["Gamen", "Fietsen", "Spelletjes"], "", "midnight",
      height=179, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Softwareontwikkelaar", languages=["Nederlands", "Engels"], pets="Geen", living="Woongroep", diet="Alles", exercise="Wekelijks", music=["Metal", "Hiphop"], weekend=["Thuis chillen", "Vrienden zien"], zodiac="Tweelingen", first_date="Online", orientation="Heteroseksueel"),
    P("Amira", "f", 1991, "Antwerpen", "friends", (50, 150, 170), "Reislustig en gek op street food", "Reislustig, nieuwsgierig en gek op street food. Zoek vrienden om samen nieuwe plekken te ontdekken.", ["Reizen", "Eten", "Talen"], "", "ocean",
      height=170, body="Gemiddeld", smoking="Nee", drinking="Nooit", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Vertaler", languages=["Nederlands", "Engels", "Frans", "Anders"], pets="Geen", living="Alleen", diet="Halal", exercise="Wekelijks", music=["Pop", "Latin"], weekend=["Reizen", "Cultuur"], zodiac="Schorpioen", first_date="Koffie of thee", orientation="Heteroseksueel"),
    P("Tim", "m", 1995, "Gent", "dating", (110, 110, 200), "Muzikant zoekt duet", "Muzikant. Zoekt iemand om mee te duetten, in het echt of op een terras.", ["Gitaar", "Concerten", "Bier"], "f", "sunset",
      height=181, body="Slank", smoking="Soms", drinking="Regelmatig", children="Geen", wants_children="Misschien", status="Single", education="MBO", job="Muziekleraar", languages=["Nederlands", "Engels"], pets="Hond", living="Samenwonend", diet="Alles", exercise="Soms", music=["Rock", "Jazz", "Nederlandstalig"], weekend=["Uitgaan", "Cultuur"], zodiac="Vissen", first_date="Drankje", orientation="Heteroseksueel"),
    P("Noor", "f", 1993, "Haarlem", "relationship", (200, 120, 150), "Dierenarts met een groot hart", "Dierenarts. Twee honden, één tuin en veel liefde te geven. Mijn ideale zondag: strand en soep.", ["Honden", "Strand", "Koken"], "m", "forest",
      height=174, body="Sportief", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="WO", job="Dierenarts", languages=["Nederlands", "Engels"], pets="Hond", living="Alleen", diet="Alles", exercise="Wekelijks", music=["Pop", "Nederlandstalig"], weekend=["Wandelen", "Vrienden zien"], zodiac="Kreeft", first_date="Wandeling", orientation="Heteroseksueel"),
    P("Bas", "m", 1986, "Leiden", "relationship", (90, 120, 160), "Docent geschiedenis, kok in de maak", "Leraar geschiedenis, hobbykok, vader van een dochter van zeven. Zoek warmte en humor.", ["Geschiedenis", "Koken", "Fietsen"], "f", "mono",
      height=185, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Thuiswonend", wants_children="Misschien", status="Gescheiden", education="WO", job="Docent", languages=["Nederlands", "Engels", "Duits"], pets="Geen", living="Alleen", diet="Alles", exercise="Wekelijks", music=["Klassiek", "Jazz"], weekend=["Cultuur", "Thuis chillen"], zodiac="Stier", first_date="Diner", orientation="Heteroseksueel"),
    P("Yara", "f", 1998, "Arnhem", "dating", (230, 90, 110), "Student, danser, nachtbraker", "Studeer communicatie en dans in mijn vrije tijd. Zin in spontane avonden en lange gesprekken.", ["Dansen", "Reizen", "Muziek"], "", "rainbow",
      height=169, body="Slank", smoking="Soms", drinking="Regelmatig", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Student", languages=["Nederlands", "Engels", "Spaans"], pets="Geen", living="Woongroep", diet="Alles", exercise="Wekelijks", music=["Latin", "Dance", "Hiphop"], weekend=["Uitgaan", "Vrienden zien"], zodiac="Boogschutter", first_date="Drankje", orientation="Biseksueel"),
    P("Rik", "m", 1990, "Nijmegen", "friends", (80, 150, 100), "Klimmen, kamperen, kletsen", "Klimmer en kampeerder. Zoek maatjes voor weekendjes weg en een biertje na afloop.", ["Klimmen", "Kamperen", "Bier"], "", "forest",
      height=182, body="Sportief", smoking="Nee", drinking="Regelmatig", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Fysiotherapeut", languages=["Nederlands", "Engels"], pets="Hond", living="Samenwonend", diet="Alles", exercise="Dagelijks", music=["Rock", "Pop"], weekend=["Sporten", "Reizen"], zodiac="Ram", first_date="Activiteit", orientation="Heteroseksueel"),
    P("Esmee", "f", 1990, "Breda", "relationship", (220, 140, 60), "Verpleegkundige met humor", "Verpleegkundige, nuchter en lief. Lach graag, huil bij films en ben dol op gezelligheid.", ["Films", "Lachen", "Bakken"], "m", "sunset",
      height=166, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Uitwonend", wants_children="Nee", status="Gescheiden", education="HBO", job="Verpleegkundige", languages=["Nederlands", "Engels"], pets="Kat", living="Alleen", diet="Alles", exercise="Soms", music=["Pop", "Nederlandstalig"], weekend=["Thuis chillen", "Vrienden zien"], zodiac="Weegschaal", first_date="Koffie of thee", orientation="Heteroseksueel"),
    P("Kevin", "m", 1994, "Tilburg", "dating", (120, 100, 190), "Fotograaf met een camera in de tas", "Fotograaf. Ik zie mooie dingen in gewone momenten. Zin in een date die geen sollicitatiegesprek is.", ["Fotografie", "Reizen", "Koffie"], "", "midnight",
      height=178, body="Slank", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Fotograaf", languages=["Nederlands", "Engels"], pets="Geen", living="Alleen", diet="Vegetarisch", exercise="Soms", music=["Jazz", "Pop"], weekend=["Cultuur", "Wandelen"], zodiac="Waterman", first_date="Wandeling", orientation="Homoseksueel"),
    P("Sam", "x", 1995, "Amsterdam", "friends", (60, 170, 160), "Gewoon Sam", "Ik gebruik hen/hun. Schrijver, bordspelliefhebber en koffienerd. Zoek mensen die open staan voor alles.", ["Schrijven", "Bordspellen", "Koffie"], "", "nonbinary",
      height=176, body="Slank", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Schrijver", languages=["Nederlands", "Engels", "Duits"], pets="Kat", living="Alleen", diet="Veganistisch", exercise="Soms", music=["Jazz", "Klassiek"], weekend=["Thuis chillen", "Cultuur"], zodiac="Tweelingen", first_date="Koffie of thee", orientation="Panseksueel"),
    P("Anouk", "f", 1988, "Utrecht", "relationship", (200, 100, 120), "Juriste die ook kan dansen", "Overdag juriste, 's avonds salsa. Ik zoek iemand die met beide voeten in het leven staat.", ["Salsa", "Reizen", "Wijn"], "m", "rose",
      height=171, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="WO", job="Juriste", languages=["Nederlands", "Engels", "Spaans"], pets="Geen", living="Alleen", diet="Alles", exercise="Wekelijks", music=["Latin", "Pop"], weekend=["Uitgaan", "Reizen"], zodiac="Maagd", first_date="Diner", orientation="Heteroseksueel"),
    P("Thijs", "m", 1993, "Rotterdam", "dating", (70, 110, 180), "Architect, havenliefhebber", "Architect met een zwak voor oude havens en nieuwe cafés. Laten we samen de stad ontdekken.", ["Architectuur", "Fietsen", "Bier"], "", "ocean",
      height=184, body="Gemiddeld", smoking="Nee", drinking="Regelmatig", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Architect", languages=["Nederlands", "Engels"], pets="Geen", living="Samenwonend", diet="Alles", exercise="Wekelijks", music=["Rock", "Dance"], weekend=["Uitgaan", "Cultuur"], zodiac="Stier", first_date="Drankje", orientation="Heteroseksueel"),
    P("Maaike", "f", 2000, "Groningen", "chat", (240, 130, 150), "Studente met veel meningen", "Studeer psychologie. Praat graag over alles wat ertoe doet én over onzin. Eerst chatten, dan kijken.", ["Psychologie", "Series", "Hardlopen"], "", "lavender",
      height=164, body="Slank", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Student", languages=["Nederlands", "Engels"], pets="Geen", living="Woongroep", diet="Vegetarisch", exercise="Wekelijks", music=["Pop", "Hiphop"], weekend=["Thuis chillen", "Vrienden zien"], zodiac="Vissen", first_date="Online", orientation="Biseksueel"),
    P("Joost", "m", 1984, "Den Haag", "relationship", (100, 110, 120), "Eerlijk, nuchter, huisvader", "Vader van twee, om de week. Nuchter, handig en graag thuis. Op zoek naar een maatje voor het leven.", ["Klussen", "Koken", "Voetbal"], "f", "mono",
      height=186, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Thuiswonend", wants_children="Nee", status="Gescheiden", education="MBO", job="Aannemer", languages=["Nederlands", "Engels"], pets="Hond", living="Alleen", diet="Alles", exercise="Soms", music=["Rock", "Nederlandstalig"], weekend=["Thuis chillen", "Sporten"], zodiac="Kreeft", first_date="Diner", orientation="Heteroseksueel"),
    P("Imane", "f", 1992, "Antwerpen", "dating", (190, 100, 80), "Chef met pit", "Chef-kok met pit. Ik kook voor je als je me aan het lachen maakt.", ["Koken", "Muziek", "Reizen"], "", "sunset",
      height=167, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Geen", wants_children="Ja", status="Single", education="MBO", job="Chef-kok", languages=["Nederlands", "Frans", "Engels", "Anders"], pets="Geen", living="Alleen", diet="Halal", exercise="Soms", music=["Pop", "Latin"], weekend=["Uitgaan", "Vrienden zien"], zodiac="Leeuw", first_date="Diner", orientation="Heteroseksueel"),
    P("Lars", "m", 1999, "Gent", "chat", (110, 150, 200), "Gewoon een praatje", "Eerst een praatje, de rest komt vanzelf. Houd van muziek, memes en laat-op-de-avond-gesprekken.", ["Muziek", "Gamen", "Series"], "", "midnight",
      height=177, body="Slank", smoking="Soms", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Webdesigner", languages=["Nederlands", "Engels"], pets="Kat", living="Bij ouders", diet="Alles", exercise="Nooit", music=["Hiphop", "Dance"], weekend=["Thuis chillen", "Uitgaan"], zodiac="Ram", first_date="Online", orientation="Heteroseksueel"),
    P("Femke", "f", 1987, "Tilburg", "relationship", (180, 90, 110), "Moeder, collega, vriendin", "Alleenstaande moeder van een zoon van acht. Ik zoek rust, humor en een beetje avontuur.", ["Fietsen", "Tuinieren", "Koken"], "m", "forest",
      height=170, body="Gemiddeld", smoking="Nee", drinking="Soms", children="Thuiswonend", wants_children="Nee", status="Gescheiden", education="HBO", job="Docent", languages=["Nederlands", "Engels"], pets="Hond", living="Alleen", diet="Alles", exercise="Wekelijks", music=["Pop", "Jazz"], weekend=["Wandelen", "Thuis chillen"], zodiac="Weegschaal", first_date="Wandeling", orientation="Heteroseksueel"),
    P("Ruben", "m", 1991, "Haarlem", "dating", (60, 140, 120), "Zeiler, schaker, sterrenkijker", "Zeiler in de zomer, schaker in de winter. Ik zoek iemand die me uitdaagt, op en naast het bord.", ["Zeilen", "Schaken", "Sterrenkunde"], "", "ocean",
      height=180, body="Slank", smoking="Nee", drinking="Soms", children="Geen", wants_children="Misschien", status="Single", education="WO", job="Data-analist", languages=["Nederlands", "Engels", "Duits"], pets="Geen", living="Alleen", diet="Alles", exercise="Wekelijks", music=["Klassiek", "Rock"], weekend=["Reizen", "Cultuur"], zodiac="Schorpioen", first_date="Koffie of thee", orientation="Homoseksueel"),
    P("Zoë", "f", 1996, "Leiden", "friends", (150, 120, 200), "Boekhandelaar met stapel boeken", "Werk in een boekhandel en lees er nog veel meer thuis. Zoek vrienden met wie ik kan wandelen en praten.", ["Boeken", "Wandelen", "Thee"], "", "lavender",
      height=162, body="Slank", smoking="Nee", drinking="Nooit", children="Geen", wants_children="Misschien", status="Single", education="HBO", job="Boekhandelaar", languages=["Nederlands", "Engels"], pets="Kat", living="Alleen", diet="Vegetarisch", exercise="Soms", music=["Klassiek", "Pop"], weekend=["Wandelen", "Thuis chillen"], zodiac="Maagd", first_date="Koffie of thee", orientation="Anders"),
]

# (a likes b): mutual pairs are matches. Index 0.. into PEOPLE; "A" is the superadmin who is logged in.
LIKES = [(0, 3), (3, 0), (2, 3), (3, 7), (7, 3), (1, 10), (10, 1), (4, 13), (13, 4), (5, 15), (15, 5), (8, 11), (11, 8), (12, 17), (17, 12), (6, 14), (14, 6), (9, 21), (21, 9),
         (16, 18), (18, 16), (20, 22), (22, 20), (19, 2), (23, 6), (7, 8), (13, 0), (17, 3), (12, 4), (21, 11), ("A", 3), (3, "A"), (0, "A"), (13, "A"), (7, "A"), ("A", 8), ("A", 11)]
FAVORITES = [(0, 3), (3, 0), (2, 7), (1, 10), (4, 12), (8, 9), (15, 5), (22, 20), ("A", 3), ("A", 0), (13, "A"), (7, "A")]
PASSES = [(0, 1), (3, 5), (5, 3), (9, 4), (14, 1), (10, 13), ("A", 5), ("A", 15)]
BLOCKS = [(17, 19)]
FRIENDS = [(1, 6, "accepted", "Laten we vrienden zijn, we houden van dezelfde plekken."), (10, 20, "pending", "Hoi! Ik zag dat jij ook van boeken houdt."), (12, 15, "accepted", ""), ("A", 13, "pending", "Hoi, leuk profiel!"), (7, "A", "pending", "Zullen we vrienden worden?")]
VISITS = {"A": [3, 0, 13, 7, 8, 11, 12, 4], 3: [0, 2, 7, 13, 17, 21], 0: [3, 13, 5, 9], 13: [4, 0, 7], 7: [3, 8, 12], 1: [10, 6, 2], 12: [17, 4, 11]}

THREADS = [  # (from, to, subject, body)
    (3, 0, "Hoi Sophie!", "Hoi Sophie, leuk dat we een match zijn. Ik zag dat je ook van lange wandelingen houdt. Welk bos is jouw favoriet?"),
    (0, 3, "Re: Hoi Sophie!", "Hoi Milan! Het Amelisweerd bij Utrecht, vooral in de herfst. En jij, loop je daar ook?"),
    (3, 0, "Re: Hoi Sophie!", "Zeker! Zaterdag ben ik vrij. Zullen we daar een kop koffie drinken na afloop?"),
    (10, 1, "Festival-maatje", "Hey Daan, ik zag dat je naar Best Kept Secret gaat. Heb jij nog een tent over? Ik regel de snacks."),
    (4, 13, "Dag Fleur", "Dag Fleur, je kat is geweldig! Heeft hij ook een naam? Ik ben benieuwd naar je ontwerpen."),
    (13, 4, "Re: Dag Fleur", "Haha, dank je! Hij heet Pixel. Ik stuur je straks wat werk, dan hoor ik graag wat je ervan vindt."),
    (11, 8, "Een hond en een leraar", "Hoi Bas, ik zag je dochter op de foto, wat een schatje. Wat is jouw favoriete gerecht om te koken?"),
    (17, 12, "Sushi?", "Imane, jij maakt vast betere sushi dan ik. Zullen we ruilen: jouw recept, mijn playlist?"),
    (21, 9, "Klimmen", "Hoi Rik, heb jij al eens in de Ardennen geklommen? Ik zoek nog iemand voor het weekend."),
    ("A", 3, "Welkom bij de site", "Hoi, leuk dat je er bent! Laat het me weten als je vragen hebt over je profiel."),
    (3, "A", "Re: Welkom", "Dank je wel! Het ziet er mooi uit. Hoe kan ik mijn foto's privé maken?"),
    (13, "A", "Even een vraag", "Hallo! Ik zag dat je profiel bijna compleet is. Mag ik je volgen? Ik ben nieuw hier."),
    (7, "A", "Hoi!", "Ik zag dat je mijn profiel bezocht hebt. Leuk! Zin om een keer te praten?"),
]
CHATS = [(3, 0, "Hé, ben je al thuis?"), (0, 3, "Net binnen. Zin in zaterdag!"), (3, 0, "Ik ook. Neem je paraplu mee, het wordt nat."), (10, 1, "Heb je de line-up al gezien?"), (1, 10, "Ja! Zaterdag is de beste dag."),
         (4, 13, "Ik heb je ontwerpen bekeken: wauw."), (13, 4, "Dankjewel, dat betekent veel!"), (8, 11, "Mijn dochter vroeg of jij ook van pannenkoeken houdt 😄"), ("A", 3, "Welkom! Hoe bevalt het tot nu toe?"), (3, "A", "Heel goed, dank je!")]


def active():
    from . import presets

    return presets.active() == "datingplatform"


def _users():
    U = get_user_model()
    out = {i: U.objects.filter(email=f"demo-{p['name'].lower()}@example.com").first() for i, p in enumerate(PEOPLE)}
    out["A"] = U.objects.filter(is_staff=True).order_by("id").first()
    return out


def _age_range(year):
    age = datetime.date.today().year - year
    return max(18, age - 8), min(99, age + 10)


def make_people(n):
    """The members of the demo with a profile, fields, three photos and a design, and then what happens between them."""
    from apps.plugins import facade

    from .management.commands import demo_content as dc

    Profile, ProfilePhoto = facade.models("community", "Profile", "ProfilePhoto")
    User, made = get_user_model(), 0
    now = timezone.now()
    for k, p in enumerate(PEOPLE):
        name = p["name"]
        email = f"demo-{name.lower()}@example.com"
        if User.objects.filter(email=email).exists():
            continue
        cc, lat, lon = CITIES[p["city"]]
        u = User(username=email, email=email, first_name=name, last_name="Demo", display_name=name, gender=p["g"], birth_date=datetime.date(p["year"], 1 + k % 12, 1 + (k * 3) % 27), is_active=True,
                 city=p["city"], country=cc, function=p["fields"].get("job", ""), short=p["headline"], description=p["bio"], phone=f"+316120000{k:02d}")
        u.set_unusable_password()
        u.save()
        if Profile is facade._NullModel:
            made += 1
            continue
        try:
            lo, hi = _age_range(p["year"])
            pr = Profile.objects.create(user=u, slug=f"{name.lower()}-demo", enabled=True, visibility="members" if k % 7 == 6 else "public", headline=p["headline"], bio=p["bio"], discover=True, gender=p["g"], birth_date=u.birth_date,
                                        city=p["city"], country=cc, interests=p["interests"], accept_messages=True, accept_chat=k % 5 != 4, searchable_local=True, searchable_public=k % 3 == 0, design=p["design"], data=p["fields"],
                                        looking_for_genders=[x for x in p["looking"]] if p["looking"] else [], aim=p["aim"], age_min=lo, age_max=hi, lat=lat, lon=lon, show_distance=True, show_age=True, show_city=k % 9 != 8,
                                        available=[])
            for i in range(3):
                rgb = tuple(min(255, max(0, c + (i - 1) * 28)) for c in p["rgb"])
                ph = ProfilePhoto(profile=pr, visibility=("public", "members", "members")[i], order=i, caption=("", "Op vakantie", "Met vrienden")[i])
                ph.image.save(f"{name.lower()}-{i}.jpg", ContentFile(dc.avatar(name, rgb)), save=True)
        except Exception:  # noqa: BLE001
            logger.exception("Dating demo profile for %s failed", email)
        made += 1
    try:
        make_interactions(now)
    except Exception:  # noqa: BLE001
        logger.exception("Dating demo interactions failed")
    return made


def make_interactions(now):
    from apps.plugins import facade

    Like, Favorite, Visit, Pass, Block, Connection, Notification, Profile = facade.models("community", "Like", "Favorite", "ProfileVisit", "Pass", "Block", "Connection", "Notification", "Profile")
    DirectMessage, ChatMessage = facade.models("community", "DirectMessage", "ChatMessage")
    if Like is facade._NullModel:
        return
    us = _users()
    ok = lambda *ids: all(us.get(i) for i in ids)  # noqa: E731
    if Like.objects.filter(from_user__email__startswith="demo-", from_user__email__endswith="@example.com").exists():
        return
    liked = set()
    for n, (a, b) in enumerate(LIKES):
        if not ok(a, b):
            continue
        Like.objects.create(from_user=us[a], to_user=us[b], seen=a != "A" and b != "A" and n % 2 == 0)
        liked.add((a, b))
        mutual = (b, a) in liked
        if b == "A" or mutual:
            Notification.objects.create(user=us[b], kind="match" if mutual else "like", from_user=us[a], text="Jullie hebben een match!" if mutual else "Iemand vindt jou leuk", seen=False)
        if mutual and a != "A":
            Notification.objects.create(user=us[a], kind="match", from_user=us[b], text="Jullie hebben een match!", seen=True)
    for a, b in FAVORITES:
        if ok(a, b):
            Favorite.objects.get_or_create(user=us[a], target=us[b])
    for a, b in PASSES:
        if ok(a, b):
            Pass.objects.get_or_create(from_user=us[a], to_user=us[b])
    for a, b in BLOCKS:
        if ok(a, b):
            Block.objects.get_or_create(blocker=us[a], blocked=us[b])
    for a, b, status, msg in FRIENDS:
        if ok(a, b):
            Connection.objects.get_or_create(from_user=us[a], to_user=us[b], kind="friend", defaults={"status": status, "message": msg, "decided_at": now if status != "pending" else None})
    for target, viewers in VISITS.items():
        pr = Profile.objects.filter(user=us.get(target)).first() if us.get(target) else None
        for v in viewers:
            if pr and us.get(v) and us[v].pk != pr.user_id:
                Visit.objects.get_or_create(profile=pr, viewer=us[v])
    if DirectMessage is not facade._NullModel:
        for i, (a, b, subject, body) in enumerate(THREADS):
            if ok(a, b):
                m = DirectMessage.objects.create(sender=us[a], recipient=us[b], subject=subject, body=body, read_at=now if i % 3 == 0 else None)
                DirectMessage.objects.filter(pk=m.pk).update(created_at=now - timedelta(hours=len(THREADS) * 5 - i * 5))
                if b == "A" or i % 3:
                    Notification.objects.create(user=us[b], kind="message", from_user=us[a], text=subject[:100])
    if ChatMessage is not facade._NullModel:
        for i, (a, b, body) in enumerate(CHATS):
            if ok(a, b):
                m = ChatMessage.objects.create(sender=us[a], recipient=us[b], body=body, read_at=now if i < 6 else None)
                ChatMessage.objects.filter(pk=m.pk).update(created_at=now - timedelta(minutes=(len(CHATS) - i) * 7))


def remove_people():
    """Everything between the demo members (and with the superadmin) goes first: the tables of the plugin are not cleaned by deleting the users."""
    from apps.accounts.models import UserGroup
    from django.db.models import Q

    from apps.plugins import facade

    U = get_user_model()
    demo = U.objects.filter(email__startswith="demo-", email__endswith="@example.com")
    ids = list(demo.values_list("id", flat=True))
    if not ids:
        return
    Like, Favorite, Visit, Pass, Block, Connection, Notification, Profile = facade.models("community", "Like", "Favorite", "ProfileVisit", "Pass", "Block", "Connection", "Notification", "Profile")
    DirectMessage, ChatMessage, Allow = facade.models("community", "DirectMessage", "ChatMessage", "ProfileAllow")
    for model, q in ((Like, Q(from_user__in=ids) | Q(to_user__in=ids)), (Favorite, Q(user__in=ids) | Q(target__in=ids)), (Pass, Q(from_user__in=ids) | Q(to_user__in=ids)),
                     (Block, Q(blocker__in=ids) | Q(blocked__in=ids)), (Connection, Q(from_user__in=ids) | Q(to_user__in=ids)), (Notification, Q(user__in=ids) | Q(from_user__in=ids)),
                     (DirectMessage, Q(sender__in=ids) | Q(recipient__in=ids)), (ChatMessage, Q(sender__in=ids) | Q(recipient__in=ids)), (Visit, Q(viewer__in=ids) | Q(profile__user__in=ids)),
                     (Allow, Q(user__in=ids) | Q(profile__user__in=ids))):
        if model is not facade._NullModel:
            model.objects.filter(q).delete()


# ── pictures: a fake hero and illustrations for the pages (drawn here, no files needed) ──
def _gradient(w, h, top, bottom):
    from PIL import Image

    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = row
    return im


def _bokeh(im, colours, count, seed):
    """Soft glowing circles (like lights out of focus)."""
    import random

    from PIL import Image, ImageDraw, ImageFilter

    rnd = random.Random(seed)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        r = rnd.randint(im.size[1] // 22, im.size[1] // 7)
        x, y = rnd.randint(0, im.size[0]), rnd.randint(0, im.size[1])
        c = rnd.choice(colours)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*c, rnd.randint(40, 110)))
    layer = layer.filter(ImageFilter.GaussianBlur(3))
    im.paste(layer, (0, 0), layer)
    return im


def _heart(d, cx, cy, size, fill, outline=None, width=0):
    import math

    pts = []
    for i in range(0, 360, 4):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 18, cy - y * size / 18))
    d.polygon(pts, fill=fill, outline=outline, width=width)


def _person(d, cx, base, h, skin, shirt):
    """A simple figure: head, neck and shoulders."""
    r = h // 6
    d.ellipse((cx - r, base - h, cx + r, base - h + 2 * r), fill=skin)
    d.rounded_rectangle((cx - int(r * 1.9), base - h + int(r * 2.1), cx + int(r * 1.9), base + h // 3), radius=r, fill=shirt)


def _jpeg(im, quality=88):
    from io import BytesIO

    out = BytesIO()
    im.convert("RGB").save(out, "JPEG", quality=quality)
    return out.getvalue()


def _hero_picture(kind, w=1920, h=800):
    from PIL import ImageDraw, ImageFilter

    skies = {"roze": ((255, 200, 215), (210, 90, 140)), "zonsondergang": ((255, 190, 120), (150, 60, 140)), "nacht": ((60, 50, 130), (20, 20, 60))}
    top, bottom = skies[kind]
    im = _gradient(w, h, top, bottom)
    im = _bokeh(im, [(255, 255, 255), (255, 220, 235), (255, 200, 150)] if kind != "nacht" else [(255, 230, 160), (180, 170, 255), (255, 255, 255)], 26, hash(kind) % 997)
    d = ImageDraw.Draw(im, "RGBA")
    for i, (x, y, s, a) in enumerate([(w * 0.62, h * 0.42, 260, 120), (w * 0.72, h * 0.55, 190, 150), (w * 0.82, h * 0.36, 120, 90)]):
        _heart(d, x, y, s, (255, 255, 255, a))
    # two people close to each other at the bottom right
    base = h + 40
    _person(d, int(w * 0.68), base, 470, (240, 200, 170), (40, 40, 70, 235))
    _person(d, int(w * 0.78), base, 430, (200, 150, 120), (210, 70, 110, 235))
    for x, y, sz in [(0.73, 0.22, 90), (0.6, 0.3, 50), (0.86, 0.3, 60)]:
        _heart(d, w * x, h * y, sz, (255, 255, 255, 200))
    return _jpeg(im.filter(ImageFilter.GaussianBlur(0.6)))


def _scene(kind, w=1200, h=800):
    from PIL import ImageDraw

    palettes = {"wandelen": ((200, 235, 210), (70, 140, 100)), "koffie": ((250, 225, 200), (150, 90, 60)), "diner": ((70, 40, 80), (20, 15, 40)),
                "profiel": ((255, 215, 225), (230, 120, 160)), "zoeken": ((205, 225, 255), (90, 120, 210)), "chat": ((215, 250, 235), (60, 170, 140)), "veilig": ((220, 215, 255), (110, 90, 200))}
    top, bottom = palettes[kind]
    im = _gradient(w, h, top, bottom)
    im = _bokeh(im, [(255, 255, 255), top], 14, hash(kind) % 991)
    d = ImageDraw.Draw(im, "RGBA")
    if kind in ("wandelen", "koffie", "diner"):
        if kind == "wandelen":
            for x in range(80, w, 190):  # trees
                d.rectangle((x, h * 0.45, x + 22, h * 0.8), fill=(90, 60, 40, 255))
                d.ellipse((x - 70, h * 0.18, x + 92, h * 0.55), fill=(50, 120, 80, 255))
            d.polygon([(0, h), (w, h), (w, h * 0.82), (0, h * 0.86)], fill=(120, 90, 60, 255))
        elif kind == "koffie":
            d.rectangle((0, h * 0.7, w, h), fill=(120, 75, 50, 255))
            for cx in (w * 0.42, w * 0.58):
                d.rounded_rectangle((cx - 60, h * 0.6, cx + 60, h * 0.72), radius=18, fill=(255, 250, 245, 255))
                d.ellipse((cx + 50, h * 0.63, cx + 95, h * 0.69), outline=(255, 250, 245, 255), width=8)
        else:
            d.rectangle((0, h * 0.72, w, h), fill=(50, 30, 50, 255))
            for cx in (w * 0.35, w * 0.65):
                d.ellipse((cx - 8, h * 0.28, cx + 8, h * 0.36), fill=(255, 220, 120, 255))
                d.polygon([(cx - 6, h * 0.36), (cx + 6, h * 0.36), (cx + 30, h * 0.72), (cx - 30, h * 0.72)], fill=(255, 230, 150, 70))
        _person(d, int(w * 0.43), int(h * 1.02), 400, (240, 200, 170), (50, 60, 110, 255))
        _person(d, int(w * 0.57), int(h * 1.02), 380, (205, 155, 125), (200, 70, 110, 255))
        _heart(d, w * 0.5, h * 0.22, 90, (255, 255, 255, 190))
    elif kind == "profiel":
        d.rounded_rectangle((w * 0.3, h * 0.12, w * 0.7, h * 0.88), radius=40, fill=(255, 255, 255, 235))
        d.ellipse((w * 0.42, h * 0.2, w * 0.58, h * 0.2 + w * 0.16), fill=(240, 190, 170, 255))
        for i in range(4):
            d.rounded_rectangle((w * 0.36, h * (0.55 + i * 0.08), w * (0.64 - i * 0.04), h * (0.58 + i * 0.08)), radius=10, fill=(230, 120, 160, 200 - i * 30))
        _heart(d, w * 0.66, h * 0.18, 70, (230, 70, 120, 255))
    elif kind == "zoeken":
        for i, (x, y) in enumerate([(0.25, 0.35), (0.5, 0.25), (0.72, 0.4), (0.4, 0.65), (0.65, 0.7)]):
            d.ellipse((w * x - 55, h * y - 55, w * x + 55, h * y + 55), fill=(255, 255, 255, 235))
            d.ellipse((w * x - 22, h * y - 38, w * x + 22, h * y + 6), fill=(240, 195, 170, 255))
        cx, cy, r = w * 0.5, h * 0.5, 190
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(40, 60, 140, 255), width=24)
        d.line((cx + r * 0.7, cy + r * 0.7, cx + r * 1.4, cy + r * 1.4), fill=(40, 60, 140, 255), width=34)
    elif kind == "chat":
        d.rounded_rectangle((w * 0.12, h * 0.18, w * 0.62, h * 0.5), radius=50, fill=(255, 255, 255, 240))
        d.polygon([(w * 0.2, h * 0.5), (w * 0.28, h * 0.5), (w * 0.2, h * 0.6)], fill=(255, 255, 255, 240))
        d.rounded_rectangle((w * 0.38, h * 0.42, w * 0.88, h * 0.76), radius=50, fill=(60, 150, 130, 245))
        d.polygon([(w * 0.8, h * 0.76), (w * 0.72, h * 0.76), (w * 0.82, h * 0.86)], fill=(60, 150, 130, 245))
        for x in (0.24, 0.32, 0.4):
            d.ellipse((w * x - 12, h * 0.32 - 12, w * x + 12, h * 0.32 + 12), fill=(70, 70, 90, 255))
        _heart(d, w * 0.63, h * 0.59, 56, (255, 255, 255, 255))
    else:  # veilig: a shield with a check mark
        cx, cy = w * 0.5, h * 0.5
        d.polygon([(cx, cy - 250), (cx + 200, cy - 180), (cx + 200, cy + 20), (cx, cy + 250), (cx - 200, cy + 20), (cx - 200, cy - 180)], fill=(255, 255, 255, 240))
        d.line([(cx - 90, cy), (cx - 20, cy + 70), (cx + 100, cy - 70)], fill=(90, 70, 190, 255), width=36, joint="curve")
    return _jpeg(im)


HERO_KINDS = [("Roze", "roze"), ("Zonsondergang", "zonsondergang"), ("Nacht", "nacht")]
IMAGE_KINDS = [("Profiel", "profiel"), ("Zoeken", "zoeken"), ("Chat", "chat"), ("Veilig", "veilig"), ("Wandelen", "wandelen"), ("Koffie", "koffie"), ("Diner", "diner")]


def _save(label, data, tags):
    from django.core.files.storage import default_storage
    from django.utils.text import slugify

    from apps.medialib import areas
    from apps.medialib.models import MediaItem

    key = default_storage.save(areas.site_path("library", f"media-demo/{slugify(label)}.jpg"), ContentFile(data))
    item = MediaItem.objects.get(key=key)
    item.name, item.source, item.tags = f"{label}.jpg", "media-demo", tags
    item.save(update_fields=["name", "source", "tags"])
    return item.id


def make_heroes():
    """Three fake banners (soft light, hearts and two people) for the start page. Part "heroes" of the demo data: found by the name "Hero …"."""
    from apps.medialib.models import MediaItem

    have = set(MediaItem.objects.filter(source="media-demo").values_list("name", flat=True))
    ids = []
    for label, kind in HERO_KINDS:
        name = f"Hero Dating {label}"
        if f"{name}.jpg" not in have:
            ids.append(_save(name, _hero_picture(kind), ["demo", "hero", "achtergrond", "breed", "dating", kind]))
    return ids


def make_images():
    """Pictures for the pages: three steps, safety, three couples and four portraits of members. Part "media" of the demo data: found by the name "Dating …"."""
    from apps.medialib.models import MediaItem

    from .management.commands import demo_content as dc

    have = set(MediaItem.objects.filter(source="media-demo").values_list("name", flat=True))
    ids = []
    for p in PEOPLE[:4]:  # the portraits of the members on the start page ("Leden in jouw buurt")
        name = f"Dating Lid {p['name']}"
        if f"{name}.jpg" not in have:
            ids.append(_save(name, dc.avatar(p["name"], p["rgb"]), ["demo", "dating", "portret"]))
    for label, kind in IMAGE_KINDS:
        name = f"Dating {label}"
        if f"{name}.jpg" not in have:
            ids.append(_save(name, _scene(kind), ["demo", "dating", kind]))
    return ids


def make_faq():
    from apps.plugins import facade

    FaqEntry = facade.models("faq", "FaqEntry")  # (the plugin FAQ: the rows are only made while it is on)

    rows = [("Is aanmelden gratis?", "Ja. Aanmelden, een profiel maken en rondkijken is gratis. Met een abonnement kun je onbeperkt berichten sturen en zie je wie jou leuk vindt.", "Is signing up free?", "Yes. Signing up, creating a profile and looking around is free. With a subscription you can send unlimited messages and see who likes you."),
            ("Wie kan mijn foto's zien?", "Jij bepaalt het per foto: openbaar, alleen leden, privé of onzichtbaar. Bij privé-foto's zien anderen een wazige versie tot je toegang geeft.", "Who can see my photos?", "You decide per photo: public, members only, private or invisible. With private photos others see a blurred version until you give access."),
            ("Hoe werkt een match?", "Als jij iemand leuk vindt en die persoon jou ook, hebben jullie een match. Jullie krijgen allebei een melding en kunnen direct berichten sturen.", "How does a match work?", "When you like someone and that person likes you too, you have a match. You both get a notice and can send messages right away."),
            ("Hoe blokkeer of meld ik iemand?", "Open het profiel en kies Blokkeren of Melden. Een geblokkeerd lid kan je niet meer vinden, berichten of chatten.", "How do I block or report someone?", "Open the profile and choose Block or Report. A blocked member can no longer find, message or chat with you."),
            ("Kan ik videobellen?", "Ja, met een match kun je rechtstreeks videobellen, zonder dat je een telefoonnummer hoeft te delen.", "Can I video call?", "Yes, with a match you can video call directly, without having to share a phone number."),
            ("Hoe verwijder ik mijn account?", "Ga naar Mijn profiel → Beveiliging → Account verwijderen. Al je gegevens, foto's en berichten worden dan definitief gewist.", "How do I delete my account?", "Go to My profile → Security → Delete account. All your data, photos and messages are then erased for good.")]
    return [FaqEntry.objects.create(question={"nl": qn, "en": qe}, answer={"nl": an, "en": ae}, order=900 + i) for i, (qn, an, qe, ae) in enumerate(rows)]
