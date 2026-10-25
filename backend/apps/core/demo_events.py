# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo appointments of the agenda per standard installation (the plugin Agenda reads them when it makes its demo data).
(title, description, place, day of this week (0 = Monday, may be higher), hour, minutes, kind, colour, recurrence, all day, people (index of the demo people), calendar)
kind: public = event for everybody (open sign-up), appointment = with the people named, group = for a group."""

EVENTS = {
    "zakelijk-netwerk": [
        ("Netwerkborrel", "Maandelijkse borrel voor leden en hun gasten. Opgeven kan via de agenda.", "Het Huis, Utrecht", 3, 17, 150, "public", "orange", "", False, [], "Evenementen"),
        ("Kennissessie: online zichtbaar worden", "Een spreker en een case, met tijd voor vragen.", "Online", 1, 12, 60, "public", "blue", "", False, [], "Evenementen"),
        ("Online lunch", "Een kwartier kennismaken met een willekeurige collega.", "Online", 2, 12, 30, "public", "teal", "weekly", False, [], "Evenementen"),
        ("Ledenborrel regio Zuid", "Voor leden in Brabant en Limburg.", "Eindhoven", 9, 18, 120, "public", "purple", "", False, [], "Evenementen"),
        ("Kennismaking Sophie en Daan", "Koffie om te bespreken of we kunnen samenwerken.", "Koffiehuis, Utrecht", 3, 10, 45, "appointment", "green", "", False, [0, 1], ""),
        ("Adviesgesprek Milan en Fleur", "Interieur voor het nieuwe kantoor.", "Den Haag", 4, 14, 60, "appointment", "pink", "", False, [3, 4], ""),
        ("Jaarcongres", "De dag voor het hele netwerk: sprekers, workshops en een diner.", "Congrescentrum, Utrecht", 25, 9, 600, "public", "red", "", True, [], "Evenementen"),
    ],
    "sportclub": [
        ("Training senioren", "Conditie en technische oefeningen.", "Hoofdveld", 0, 19, 90, "group", "green", "weekly", False, [1, 2, 3], "Training"),
        ("Training jeugd", "Voor alle leeftijden tot 12 jaar.", "Kunstgras", 2, 17, 60, "group", "blue", "weekly", False, [0, 4, 5], "Training"),
        ("Wedstrijd thuis: Eerste elftal", "Kom supporteren, de kantine is open.", "Hoofdveld", 5, 14, 120, "public", "red", "", False, [], "Wedstrijden"),
        ("Toernooi voor de jeugd", "Alle teams doen mee, ouders zijn welkom.", "Sportpark", 12, 9, 360, "public", "orange", "", True, [], "Wedstrijden"),
        ("Algemene ledenvergadering", "Jaarverslag, begroting en bestuursverkiezing.", "Kantine", 8, 20, 120, "public", "purple", "", False, [], "Vereniging"),
        ("Kantinedienst zaterdag", "Hulp bij de bar en keuken gezocht.", "Kantine", 5, 11, 240, "group", "gray", "weekly", False, [6, 8], "Vereniging"),
        ("Clubfeest", "Muziek, hapjes en de uitreiking van de prijzen.", "Kantine", 19, 20, 240, "public", "pink", "", False, [], "Vereniging"),
    ],
    "stichting": [
        ("Benefietavond", "Een avond met muziek en veiling voor het goede doel.", "Stadsschouwburg", 11, 19, 180, "public", "pink", "", False, [], "Evenementen"),
        ("Vrijwilligersavond", "Kennismaken, uitleg over onze projecten en een hapje.", "Ons kantoor", 3, 19, 120, "public", "green", "", False, [], "Evenementen"),
        ("Inzamelactie in de wijk", "Help ons met een collectedoos langs de deuren.", "Centrum", 5, 10, 240, "public", "orange", "", False, [], "Evenementen"),
        ("Sponsorloop", "Loop mee voor kinderen die onze hulp nodig hebben.", "Park", 14, 10, 300, "public", "blue", "", True, [], "Evenementen"),
        ("Nieuwsbrief klaarmaken", "Teksten en foto's voor de maandelijkse nieuwsbrief.", "Online", 1, 14, 90, "group", "gray", "monthly", False, [0, 1], ""),
        ("Gesprek met een donateur", "Dank voor de jarenlange steun.", "Ons kantoor", 4, 11, 45, "appointment", "teal", "", False, [2, 3], ""),
    ],
    "marktplaats": [
        ("Rommelmarkt voor leden", "Zet je spullen op een kraam en verkoop ze zelf.", "Marktplein", 5, 9, 300, "public", "orange", "", True, [], "Evenementen"),
        ("Workshop: foto's maken van je spullen", "Tips voor foto's die verkopen.", "Online", 2, 20, 60, "public", "blue", "", False, [], "Evenementen"),
        ("Ruilavond", "Neem iets mee en ruil het voor iets anders.", "Buurthuis", 9, 19, 120, "public", "green", "", False, [], "Evenementen"),
        ("Yogales (geboekt)", "Boeking via de marktplaats.", "Studio, Rotterdam", 4, 18, 60, "appointment", "teal", "", False, [2, 5], ""),
        ("Ophalen jas", "Afspraak om een jas op te halen.", "Utrecht", 3, 18, 20, "appointment", "gray", "", False, [0, 1], ""),
    ],
}


def rows(kind_of_site):
    return EVENTS.get(kind_of_site)
