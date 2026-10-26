# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo data for the standard installation Intranet: colleagues with a function and a department (the smoelenboek), a start page, an internal
knowledge base (FAQ), a few pages and some messages and chats. The documents (DMS) come from the plugin Documentbeheer and the agenda from the plugin Agenda.
Everything is recognisable (demo-…@example.com, source "demo", text keys "demo.intranet.…") and goes away with the demo data."""
import datetime
import logging

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# name, gender, birth year, city, function, department, short, bio, interests, colour
PEOPLE = [
    ("Sanne", "f", 1988, "Utrecht", "Directeur", "Directie", "Stuurt het team aan.", "Sinds 2014 directeur. Vragen over strategie of budget? Loop gerust binnen.", ["Strategie", "Hardlopen"], (200, 80, 90)),
    ("Bram", "m", 1985, "Amsterdam", "Teamleider Verkoop", "Verkoop", "Verkoop en klantrelaties.", "Verkoopt graag en luistert nog liever. Altijd in voor een goed gesprek bij de koffie.", ["Netwerken", "Tennis"], (70, 130, 210)),
    ("Priya", "f", 1991, "Rotterdam", "Financieel medewerker", "Financiën", "Facturen en declaraties.", "Zorgt dat alles klopt. Declaraties graag voor de 25e inleveren!", ["Cijfers", "Koken"], (240, 160, 70)),
    ("Jeroen", "m", 1983, "Den Haag", "ICT-beheerder", "ICT", "Laptops, wifi en accounts.", "Eerste aanspreekpunt voor alles met een stekker. Meld problemen via de interne helpdesk.", ["Gamen", "Elektronica"], (60, 160, 130)),
    ("Fatima", "f", 1993, "Eindhoven", "HR-adviseur", "HR", "Personeelszaken en verlof.", "Voor verlof, ziekmelding, onboarding en alles wat met werkplezier te maken heeft.", ["Mensen", "Yoga"], (160, 90, 190)),
    ("Lars", "m", 1990, "Groningen", "Marketeer", "Marketing", "Website, social en campagnes.", "Maakt de website en de nieuwsbrief. Ideeën voor de kanalen? Mail me.", ["Fotografie", "Fietsen"], (230, 110, 140)),
    ("Noor", "f", 1995, "Utrecht", "Projectleider", "Projecten", "Planning en voortgang.", "Houdt de planning in de gaten en bewaakt de deadlines, vriendelijk maar consequent.", ["Reizen", "Boeken"], (90, 170, 220)),
    ("Daan", "m", 1987, "Arnhem", "Ontwikkelaar", "ICT", "Bouwt aan onze systemen.", "Schrijft code en reviewt die van anderen. Houdt van een heldere afspraak.", ["Code", "Muziek"], (130, 120, 200)),
    ("Eva", "f", 1992, "Haarlem", "Office manager", "Facilitair", "Kantoor, post en vergaderzalen.", "Voor vergaderzalen, post, parkeren en de koffiemachine. De vrijdagmiddagborrel is ook van mij.", ["Organiseren", "Wijn"], (220, 140, 60)),
    ("Tim", "m", 1996, "Leiden", "Accountmanager", "Verkoop", "Bestaande klanten.", "Onderhoudt de relaties met onze vaste klanten en denkt graag mee over oplossingen.", ["Voetbal", "Koken"], (80, 150, 100)),
    ("Marit", "f", 1989, "Delft", "Juridisch adviseur", "Juridisch", "Contracten en privacy.", "Voor contracten, voorwaarden en privacyvragen. Graag vroeg betrekken, niet pas bij de handtekening.", ["Lezen", "Wandelen"], (170, 100, 90)),
    ("Hamza", "m", 1994, "Zwolle", "Inkoper", "Inkoop", "Leveranciers en bestellingen.", "Bestelt alles van pennen tot servers. Weet je iets nodig? Laat het me op tijd weten.", ["Schaken", "Fietsen"], (110, 140, 90)),
]

FAQ = [
    ("Hoe vraag ik verlof aan?", "Open je profiel of de agenda, kies Nieuwe afspraak en zet het type op Verlof. Je leidinggevende krijgt een melding en keurt het goed. Vragen? Stuur HR een bericht.",
     "How do I request leave?", "Open your profile or the agenda, choose New appointment and set the type to Leave. Your manager gets a notification and approves it. Questions? Send HR a message."),
    ("Wie helpt mij bij ICT-problemen?", "Stuur Jeroen van ICT een bericht of bel het interne nummer 100. Beschrijf wat je ziet en wat je al geprobeerd hebt; dat scheelt tijd.",
     "Who helps me with IT problems?", "Send Jeroen from IT a message or call internal number 100. Describe what you see and what you already tried; it saves time."),
    ("Waar vind ik de huisstijl en sjablonen?", "In het documentensysteem, map Marketing. Daar staan de huisstijlgids, het briefpapier en de presentatiesjabloon.",
     "Where do I find the house style and templates?", "In the document system, folder Marketing. It holds the style guide, the letterhead and the presentation template."),
    ("Hoe dien ik een declaratie in?", "Upload de bon in de map Financieel/Declaraties en stuur Priya een bericht met het bedrag. Voor de 25e van de maand wordt het meegenomen in de salarisrun.",
     "How do I submit an expense claim?", "Upload the receipt to the folder Finance/Claims and send Priya a message with the amount. Before the 25th of the month it goes into the payroll run."),
    ("Hoe reserveer ik een vergaderzaal?", "Maak in de agenda een afspraak en kies de zaal bij Locatie. Een zaal die al bezet is, kun je niet dubbel boeken.",
     "How do I book a meeting room?", "Create an appointment in the agenda and pick the room under Location. A room that is taken cannot be booked twice."),
    ("Wat doe ik bij ziekte?", "Meld je voor 9.00 uur telefonisch bij je leidinggevende en stuur HR een bericht. Beterschap!",
     "What do I do when I am ill?", "Report by phone to your manager before 9:00 and send HR a message. Get well soon!"),
]

PAGES = [("demo-handboek", "Medewerkershandboek", "Employee handbook"), ("demo-huisregels", "Huisregels en veiligheid", "House rules and safety"), ("demo-ict-hulp", "ICT-hulp", "IT help")]

HOME = {  # ContentBlock key → (nl, en)
    "demo.intranet.home.title": ("Welkom op het intranet", "Welcome to the intranet"),
    "demo.intranet.home.intro": ("Alles voor je werk op één plek: collega's, documenten, de agenda en de kennisbank. Deze website is alleen voor medewerkers.", "Everything for your work in one place: colleagues, documents, the agenda and the knowledge base. This website is for employees only."),
    "demo.intranet.home.news.title": ("Nieuws", "News"),
    "demo.intranet.home.news": ("Het nieuwe verlofproces staat in het medewerkershandboek. Vanaf maandag vraag je verlof aan via de agenda.\n\nDe vrijdagmiddagborrel is deze maand bij de koffiehoek, aanmelden bij Eva.", "The new leave process is in the employee handbook. From Monday you request leave via the agenda.\n\nFriday drinks are at the coffee corner this month, sign up with Eva."),
    "demo.intranet.home.links.title": ("Snel naar", "Quick links"),
    "demo.intranet.home.links": ("Smoelenboek: wie werkt waar?\nDocumenten: beleid, sjablonen en contracten\nAgenda: vergaderingen, verlof en evenementen\nKennisbank: antwoorden op veelgestelde vragen", "Staff directory: who works where?\nDocuments: policies, templates and contracts\nAgenda: meetings, leave and events\nKnowledge base: answers to common questions"),
    "demo.intranet.home.help.title": ("Hulp nodig?", "Need help?"),
    "demo.intranet.home.help": ("ICT: Jeroen, intern nummer 100.\nHR: Fatima, via een bericht.\nFacilitair: Eva, bij de receptie.", "IT: Jeroen, internal number 100.\nHR: Fatima, by message.\nFacilities: Eva, at reception."),
}

THREADS = [  # (from person index, to person index, subject, body)
    (4, 0, "Verlofproces", "Hoi Sanne, het nieuwe verlofproces is klaar. Wil je de tekst in het handboek nakijken voor we het maandag aankondigen?"),
    (0, 4, "Re: Verlofproces", "Ziet er goed uit, Fatima. Eén opmerking: noem ook wat er geldt bij verlof van meer dan twee weken."),
    (3, 6, "Nieuwe laptops", "Noor, de nieuwe laptops zijn binnen. Wanneer past het jouw team om ze op te halen?"),
    (2, 11, "Factuur leverancier", "Hamza, de factuur van de printerleverancier klopt niet met de bestelling. Kun jij het even navragen?"),
    (5, 1, "Nieuwsbrief", "Bram, heb je nog klantverhalen voor de nieuwsbrief van volgende maand? Een paar zinnen is genoeg."),
]
CHATS = [(1, 9, "Heb je het voorstel voor klant X al gezien?"), (9, 1, "Ja, ik stuur zo mijn opmerkingen."), (8, 6, "De vergaderzaal van 14.00 is geboekt voor jullie."), (6, 8, "Top, dank je Eva!")]


def active():
    from . import presets

    return presets.active() == "intranet"


def make_people(n):
    """The colleagues of the smoelenboek: a profile with function and department, in groups per department."""
    from apps.accounts.models import UserGroup
    from apps.plugins import facade

    from .management.commands import demo_content as dc

    Profile, ProfilePhoto = facade.models("community", "Profile", "ProfilePhoto")
    User, pal, made = get_user_model(), dc.palette(), 0
    groups = {}
    for k in range(len(PEOPLE)):  # always all the colleagues: a smoelenboek with a few faces looks empty
        name, g, year, city, function, dept, short, bio, interests, rgb = PEOPLE[k]
        email = f"demo-{name.lower()}@example.com"
        if User.objects.filter(email=email).exists():
            continue
        u = User(username=email, email=email, first_name=name, last_name="Demo", display_name=name, gender=g, birth_date=datetime.date(year, 1 + k % 12, 1 + k % 27), is_active=True,
                 city=city, country="NL", function=function, short=short, description=bio, phone=f"+31201234{k:03d}")
        u.set_unusable_password()
        u.save()
        grp = groups.get(dept) or groups.setdefault(dept, UserGroup.objects.get_or_create(slug=f"demo-afd-{dept.lower()}", defaults={"name": f"Afdeling {dept}", "description": "Voorbeeldafdeling (demo)"})[0])
        u.user_groups.add(grp)
        if Profile is facade._NullModel:
            made += 1
            continue
        try:
            pr = Profile.objects.create(user=u, slug=f"{name.lower()}-demo", enabled=True, visibility="members", headline=f"{function} · {dept}", bio=bio, discover=False, gender=g, birth_date=u.birth_date,
                                        city=city, country="NL", interests=interests, accept_messages=True, accept_chat=True, searchable_local=True, available=[], looking_for_genders=[])
            ProfilePhoto(profile=pr, visibility="members", order=0, caption="").image.save(f"{name.lower()}-0.jpg", ContentFile(dc.avatar(name, rgb)), save=True)
        except Exception:  # noqa: BLE001
            logger.exception("Intranet demo profile for %s failed", email)
        made += 1
    try:
        make_messages()
    except Exception:  # noqa: BLE001
        logger.exception("Intranet demo messages failed")
    return made


def make_messages():
    """A few mails and chats between the colleagues (they go with the people when those are removed)."""
    from apps.plugins import facade

    DirectMessage, ChatMessage = facade.models("community", "DirectMessage", "ChatMessage")
    User = get_user_model()
    people = {i: User.objects.filter(email=f"demo-{PEOPLE[i][0].lower()}@example.com").first() for i in range(len(PEOPLE))}
    if DirectMessage is facade._NullModel or DirectMessage.objects.filter(sender__email__startswith="demo-", sender__email__endswith="@example.com").exists():
        return
    for a, b, subject, body in THREADS:
        if people.get(a) and people.get(b):
            DirectMessage.objects.create(sender=people[a], recipient=people[b], subject=subject, body=body)
    for a, b, body in CHATS:
        if people.get(a) and people.get(b):
            ChatMessage.objects.create(sender=people[a], recipient=people[b], body=body)


def make_faq():
    from apps.plugins import facade

    FaqEntry = facade.models("faq", "FaqEntry")  # (the plugin FAQ: the rows are only made while it is on)

    return [FaqEntry.objects.create(question={"nl": qn, "en": qe}, answer={"nl": an, "en": ae}, order=900 + i) for i, (qn, an, qe, ae) in enumerate(FAQ)]


def make_pages():
    """The pages of the handbook and the one start page (only when the start page has not been designed yet)."""
    from apps.pages import layout as page_layout
    from apps.pages.models import Page, PageLayout

    from .models import ContentBlock

    n = 0
    for i, (key, nl, en) in enumerate(PAGES):
        if not Page.objects.filter(key=key).exists():
            Page.objects.create(key=key, kind="content", title={"nl": nl, "en": en}, enabled=True, in_menu=False, order=900 + i, source="demo")
            n += 1
    for key, (nl, en) in HOME.items():
        ContentBlock.objects.update_or_create(key=key, lang="nl", defaults={"text": nl})
        ContentBlock.objects.update_or_create(key=key, lang="en", defaults={"text": en})
    return n


def _mark_home():
    from . import demo

    obj = demo._store()
    data = dict(obj.data or {})
    data["demo_home"] = True
    obj.data = data
    obj.save()


def _home_is_demo():
    from . import demo

    return bool((demo._store().data or {}).get("demo_home"))


def remove_pages():
    """The start page and texts of the demo go; the start page is then the standard one again."""
    from apps.pages.models import PageLayout

    from . import demo
    from .models import ContentBlock

    ContentBlock.objects.filter(key__startswith="demo.intranet.").delete()
    if _home_is_demo():
        PageLayout.objects.filter(key="home").delete()
        obj = demo._store()
        data = dict(obj.data or {})
        data.pop("demo_home", None)
        obj.data = data
        obj.save()
        try:
            from . import presets

            presets.ensure_home_logo()
        except Exception:  # noqa: BLE001
            pass


def remove_people():
    from apps.accounts.models import UserGroup

    UserGroup.objects.filter(slug__startswith="demo-afd-").delete()
