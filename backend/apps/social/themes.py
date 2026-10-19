"""Community themes: ready-made sets of profile fields (and which built-in fields are shown).
Everything here is only a starting point: admins edit fields, options and visibility on Admin -> Community (no code needed).

Field spec: key, label, type (text | textarea | number | select | multiselect | checkbox | date | url), options (select/multiselect),
unit (number), required, visibility (public | members | friends | hidden), card (show on member cards), filter (search filter), group.
"""

BUILTIN_KEYS = ["headline", "bio", "gender", "birth_date", "city", "interests", "aim"]
BUILTIN_LABELS = {
    "headline": "Kopregel", "bio": "Over mij", "gender": "Geslacht", "birth_date": "Leeftijd / geboortedatum", "city": "Plaats en land",
    "interests": "Interesses (tags)", "aim": "Wat zoek ik",
}
TYPES = ["text", "textarea", "number", "select", "multiselect", "checkbox", "date", "url"]
VISIBILITY = ["public", "members", "friends", "hidden"]


def f(key, label, type="text", options=None, **kw):
    return {"key": key, "label": label, "type": type, "options": options or [], "unit": kw.get("unit", ""), "required": kw.get("required", False),
            "visibility": kw.get("visibility", "members"), "card": kw.get("card", False), "filter": kw.get("filter", False), "group": kw.get("group", "")}


ORIENTATION_OPTIONS = ["Heteroseksueel", "Homoseksueel", "Biseksueel", "Panseksueel", "Anders", "Liever niet zeggen"]

THEMES = {
    "normal": {
        "label": "Normaal", "desc": "Een eenvoudig ledenprofiel: kopregel, over mij, plaats en interesses.",
        "builtin": {"headline": True, "bio": True, "gender": True, "birth_date": True, "city": True, "interests": True, "aim": False},
        "fields": [
            f("occupation", "Beroep of bezigheid", "text", visibility="public", card=True, filter=True, group="Over mij"),
            f("languages", "Talen", "multiselect", ["Nederlands", "Engels", "Duits", "Frans", "Spaans", "Anders"], visibility="members", filter=True, group="Over mij"),
            f("education", "Opleiding", "select", ["MBO", "HBO", "WO", "Anders"], visibility="members", group="Over mij"),
            f("hobbies", "Hobby's", "text", visibility="members", group="Over mij"),
            f("website", "Website", "url", visibility="public", group="Links"),
            f("instagram", "Instagram", "url", visibility="members", group="Links"),
        ],
    },
    "sporters": {
        "label": "Sporters", "desc": "Sport, niveau, doelen en trainingsmaatjes.",
        "builtin": {"headline": True, "bio": True, "gender": True, "birth_date": True, "city": True, "interests": False, "aim": False},
        "fields": [
            f("sports", "Sporten", "multiselect", ["Hardlopen", "Wielrennen", "Zwemmen", "Triathlon", "Fitness", "Krachttraining", "Voetbal", "Tennis", "Padel", "Yoga", "Wandelen", "Klimmen", "Skaten", "Anders"], visibility="public", card=True, filter=True, group="Sport"),
            f("level", "Niveau", "select", ["Beginner", "Gemiddeld", "Gevorderd", "Wedstrijd", "Elite"], visibility="public", card=True, filter=True, group="Sport"),
            f("goals", "Doelen", "multiselect", ["Gezond blijven", "Afvallen", "Sterker worden", "Wedstrijd", "Plezier", "Trainingsmaatje vinden"], visibility="members", filter=True, group="Sport"),
            f("days", "Trainingsdagen", "multiselect", ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"], visibility="members", group="Training"),
            f("time", "Favoriete tijd", "select", ["Ochtend", "Middag", "Avond", "Wisselend"], visibility="members", filter=True, group="Training"),
            f("hours", "Trainingsuren per week", "number", unit="uur", visibility="members", group="Training"),
            f("club", "Club of team", "text", visibility="public", group="Sport"),
            f("pb", "Beste prestatie", "text", visibility="public", group="Sport"),
            f("events", "Evenementen of wedstrijden", "text", visibility="public", group="Sport"),
            f("travel", "Reisbereid voor trainen", "select", ["Alleen in de buurt", "Tot 25 km", "Tot 50 km", "Overal"], visibility="members", filter=True, group="Training"),
            f("buddy", "Ik zoek een trainingsmaatje", "checkbox", visibility="public", card=True, filter=True, group="Training"),
            f("pace", "Tempo of vermogen", "text", visibility="members", group="Sport"),
            f("coach", "Ik ben coach of trainer", "checkbox", visibility="public", filter=True, group="Sport"),
            f("injury", "Blessurehistorie of beperkingen", "text", visibility="friends", group="Training"),
        ],
    },
    "dating": {
        "label": "Dating", "desc": "Uiterlijk, leefstijl en relatiewensen voor een datingsite.",
        "builtin": {"headline": True, "bio": True, "gender": True, "birth_date": True, "city": True, "interests": True, "aim": True},
        "fields": [
            f("height", "Lengte", "number", unit="cm", visibility="members", filter=True, group="Uiterlijk"),
            f("body", "Postuur", "select", ["Slank", "Sportief", "Gemiddeld", "Extra kilo's", "Fors"], visibility="members", group="Uiterlijk"),
            f("smoking", "Roken", "select", ["Nee", "Soms", "Ja"], visibility="members", filter=True, group="Leefstijl"),
            f("drinking", "Alcohol", "select", ["Nooit", "Soms", "Regelmatig"], visibility="members", group="Leefstijl"),
            f("children", "Kinderen", "select", ["Geen", "Thuiswonend", "Uitwonend"], visibility="members", filter=True, group="Leefstijl"),
            f("wants_children", "Kinderwens", "select", ["Nee", "Misschien", "Ja"], visibility="members", group="Leefstijl"),
            f("status", "Relatiestatus", "select", ["Single", "Gescheiden", "Weduwe/weduwnaar", "Liever niet zeggen"], visibility="members", group="Over mij"),
            f("education", "Opleiding", "select", ["MBO", "HBO", "WO", "Anders"], visibility="members", group="Over mij"),
            f("job", "Beroep", "text", visibility="members", group="Over mij"),
            f("languages", "Talen", "multiselect", ["Nederlands", "Engels", "Duits", "Frans", "Spaans", "Anders"], visibility="members", filter=True, group="Over mij"),
            f("pets", "Huisdieren", "select", ["Geen", "Hond", "Kat", "Anders"], visibility="members", group="Leefstijl"),
            f("living", "Woonsituatie", "select", ["Alleen", "Samenwonend", "Bij ouders", "Woongroep"], visibility="members", group="Leefstijl"),
            f("diet", "Eetstijl", "select", ["Alles", "Vegetarisch", "Veganistisch", "Halal", "Koosjer", "Anders"], visibility="members", filter=True, group="Leefstijl"),
            f("exercise", "Sporten", "select", ["Nooit", "Soms", "Wekelijks", "Dagelijks"], visibility="members", group="Leefstijl"),
            f("music", "Muziek", "multiselect", ["Pop", "Rock", "Hiphop", "Dance", "Jazz", "Klassiek", "Latin", "Metal", "Nederlandstalig"], visibility="members", group="Interesses"),
            f("weekend", "Een perfect weekend", "multiselect", ["Uitgaan", "Thuis chillen", "Wandelen", "Reizen", "Sporten", "Cultuur", "Vrienden zien"], visibility="members", group="Interesses"),
            f("zodiac", "Sterrenbeeld", "select", ["Ram", "Stier", "Tweelingen", "Kreeft", "Leeuw", "Maagd", "Weegschaal", "Schorpioen", "Boogschutter", "Steenbok", "Waterman", "Vissen"], visibility="members", group="Over mij"),
            f("first_date", "Ideale eerste date", "select", ["Koffie of thee", "Wandeling", "Diner", "Drankje", "Activiteit", "Online"], visibility="members", filter=True, group="Daten"),
            f("orientation", "Seksuele geaardheid", "select", ORIENTATION_OPTIONS, visibility="members", filter=True, group="Over mij"),
            f("religion", "Geloof", "select", ["Geen", "Christelijk", "Islamitisch", "Joods", "Boeddhistisch", "Anders"], visibility="friends", group="Over mij"),
        ],
    },
    "business": {
        "label": "Business", "desc": "Netwerken: bedrijf, branche, expertise en wat je zoekt of biedt.",
        "builtin": {"headline": True, "bio": True, "gender": False, "birth_date": False, "city": True, "interests": False, "aim": False},
        "fields": [
            f("company", "Bedrijf", "text", visibility="public", card=True, filter=True, group="Bedrijf"),
            f("title", "Functie", "text", visibility="public", card=True, filter=True, group="Bedrijf"),
            f("industry", "Branche", "select", ["IT & software", "Zorg", "Financieel", "Bouw", "Handel", "Onderwijs", "Overheid", "Marketing & media", "Industrie", "Dienstverlening", "Anders"], visibility="public", filter=True, group="Bedrijf"),
            f("size", "Bedrijfsgrootte", "select", ["ZZP", "2-10", "11-50", "51-250", "250+"], visibility="members", filter=True, group="Bedrijf"),
            f("expertise", "Expertise", "multiselect", ["Strategie", "Verkoop", "Marketing", "Finance", "Techniek", "HR", "Juridisch", "Operations", "Design"], visibility="public", filter=True, group="Netwerk"),
            f("looking", "Ik zoek", "multiselect", ["Klanten", "Partners", "Investeerders", "Talent", "Mentor", "Opdrachten", "Baan"], visibility="public", filter=True, group="Netwerk"),
            f("offer", "Ik bied", "textarea", visibility="public", group="Netwerk"),
            f("open_to_work", "Open voor een baan of opdracht", "checkbox", visibility="public", card=True, filter=True, group="Werk zoeken"),
            f("wanted_role", "Gezochte functie", "text", visibility="public", filter=True, group="Werk zoeken"),
            f("employment", "Soort werk", "multiselect", ["Vast", "Tijdelijk", "Freelance / ZZP", "Stage", "Bijbaan"], visibility="public", filter=True, group="Werk zoeken"),
            f("work_mode", "Werkplek", "select", ["Op kantoor", "Hybride", "Remote"], visibility="public", filter=True, group="Werk zoeken"),
            f("experience", "Werkervaring", "number", unit="jaar", visibility="public", filter=True, group="Werk zoeken"),
            f("hiring", "Ik heb vacatures", "checkbox", visibility="public", card=True, filter=True, group="Werk zoeken"),
            f("website", "Website", "url", visibility="public", group="Contact"),
            f("linkedin", "LinkedIn", "url", visibility="members", group="Contact"),
            f("available", "Open voor netwerkgesprekken", "checkbox", visibility="public", card=True, filter=True, group="Netwerk"),
            f("seniority", "Niveau", "select", ["Student", "Junior", "Medior", "Senior", "Management", "Directie"], visibility="public", filter=True, group="Bedrijf"),
            f("skills", "Vaardigheden", "text", visibility="public", group="Netwerk"),
            f("languages", "Talen", "multiselect", ["Nederlands", "Engels", "Duits", "Frans", "Spaans", "Anders"], visibility="public", filter=True, group="Netwerk"),
            f("mentor", "Ik wil mentor zijn", "checkbox", visibility="public", filter=True, group="Netwerk"),
            f("speaker", "Beschikbaar als spreker of trainer", "checkbox", visibility="public", filter=True, group="Netwerk"),
            f("salary", "Salarisindicatie", "select", ["Tot 2.500", "2.500 - 3.500", "3.500 - 5.000", "5.000+", "In overleg"], visibility="members", group="Werk zoeken"),
            f("notice", "Beschikbaar per", "select", ["Direct", "Binnen 1 maand", "Binnen 3 maanden", "Later"], visibility="public", filter=True, group="Werk zoeken"),
            f("job_offer", "Mijn vacature (titel en korte tekst)", "textarea", visibility="public", group="Werk zoeken"),
        ],
    },
    "webshop": {
        "label": "Webshop", "desc": "Verkopers en winkels: winkelnaam, categorie, levering en betaling.",
        "builtin": {"headline": True, "bio": True, "gender": False, "birth_date": False, "city": True, "interests": False, "aim": False},
        "fields": [
            f("shop", "Winkelnaam", "text", visibility="public", card=True, required=True, group="Winkel"),
            f("category", "Categorie", "select", ["Mode", "Sport", "Wonen", "Elektronica", "Eten & drinken", "Gezondheid", "Hobby", "Kinderen", "Overig"], visibility="public", card=True, filter=True, group="Winkel"),
            f("website", "Website", "url", visibility="public", group="Winkel"),
            f("delivery", "Levertijd", "select", ["Dezelfde dag", "1-2 dagen", "3-5 dagen", "Langer"], visibility="public", filter=True, group="Levering"),
            f("region", "Levert in", "multiselect", ["Nederland", "België", "Duitsland", "Europa", "Wereldwijd"], visibility="public", filter=True, group="Levering"),
            f("payment", "Betaalmethoden", "multiselect", ["iDEAL", "Creditcard", "PayPal", "Achteraf", "Bankoverschrijving"], visibility="public", group="Betaling"),
            f("returns", "Retourbeleid", "textarea", visibility="public", group="Levering"),
            f("kvk", "KvK-nummer", "text", visibility="members", group="Winkel"),
        ],
    },
}


# Colour themes a member can give his profile page (Wijzig profiel -> Design). The colours live in the frontend (lib/profile-designs.js).
PROFILE_DESIGNS = ["ocean", "forest", "sunset", "midnight", "lavender", "mono", "rose", "rainbow", "trans", "bi", "lesbian", "nonbinary"]


# What members can look for ("Ik zoek"). The admin switches them on and off (Community -> Algemeen). Switching one on adds its profile fields
# (also as search filters); switching it off removes those fields again. "default" is the state of a new site.
AIM_OPTIONS = [
    {"key": "dating", "label": "Daten", "desc": "Kennismaken met het oog op een date.", "default": True, "fields": []},
    {"key": "relationship", "label": "Een relatie", "desc": "Op zoek naar een vaste partner.", "default": True, "fields": []},
    {"key": "friends", "label": "Vriendschap", "desc": "Nieuwe vrienden maken.", "default": True, "fields": []},
    {"key": "chat", "label": "Gewoon chatten", "desc": "Alleen een praatje, zonder verplichtingen.", "default": True, "fields": []},
    {"key": "appointments", "label": "Afspraakjes", "desc": "Vrijblijvend afspreken, zonder vaste relatie.", "default": False, "fields": [
        f("availability", "Wanneer kan ik afspreken", "multiselect", ["Overdag", "Avond", "Weekend", "Flexibel"], visibility="members", filter=True, group="Afspraken"),
        f("meet_place", "Waar spreek ik af", "multiselect", ["Bij mij thuis", "Bij jou thuis", "Neutrale plek", "Hotel"], visibility="members", group="Afspraken")]},
    {"key": "erotic", "label": "Erotiek", "desc": "Erotische contacten voor volwassenen (alleen 18+). Gevoelige gegevens: vermeld dit in je privacybeleid.", "default": False, "fields": [
        f("erotic_wish", "Wat zoek ik", "multiselect", ["Vrijblijvend", "Vaste afspraak", "Open relatie", "Swingen", "Fetisj / BDSM", "Anders"], visibility="members", filter=True, group="Erotiek"),
        f("erotic_limits", "Grenzen", "textarea", visibility="friends", group="Erotiek")]},
    {"key": "activities", "label": "Samen op pad", "desc": "Samen iets ondernemen: uit eten, wandelen, concerten.", "default": False, "fields": [
        f("activities", "Activiteiten", "multiselect", ["Uit eten", "Wandelen", "Concert", "Theater", "Sporten", "Uitgaan", "Cultuur"], visibility="members", filter=True, group="Samen op pad")]},
    {"key": "travel", "label": "Reisgenoot", "desc": "Samen op reis.", "default": False, "fields": [
        f("travel_style", "Reisstijl", "select", ["Stedentrip", "Strand", "Actief", "Rondreis", "Camping"], visibility="members", filter=True, group="Reizen"),
        f("travel_when", "Wanneer", "text", visibility="members", group="Reizen")]},
]
AIM_KEYS = [o["key"] for o in AIM_OPTIONS]


# How the search page looks per theme: which built-in filters show, and whether the swipe deck (like Tinder) is on by default.
SEARCH = {
    "normal": {"title": "Leden zoeken", "filters": ["q", "gender", "age", "city", "country", "interest", "distance", "sort", "online", "photo"], "swipe": False},
    "dating": {"title": "Zoeken & swipen", "filters": ["q", "gender", "age", "city", "distance", "aim", "interest", "sort", "online", "photo"], "swipe": True},
    "sporters": {"title": "Trainingsmaatjes zoeken", "filters": ["q", "gender", "age", "city", "distance", "interest", "sort", "online"], "swipe": False},
    "business": {"title": "Netwerk, functies en banen zoeken", "filters": ["q", "city", "country", "distance", "sort", "online"], "swipe": False},
    "webshop": {"title": "Winkels en verkopers zoeken", "filters": ["q", "city", "country", "sort"], "swipe": False},
}


def search_config(key):
    return SEARCH.get(key) or SEARCH["normal"]


def theme_payload(key):
    t = THEMES[key]
    return {"theme": key, "builtin": dict(t["builtin"]), "fields": [dict(x, options=list(x["options"])) for x in t["fields"]]}


def public_list():
    return [{"key": k, "label": t["label"], "desc": t["desc"], "fields": len(t["fields"])} for k, t in THEMES.items()]
