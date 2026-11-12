# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The layouts of the system object Energie: each is one block that can be put on a page (and is switched on/off in Admin → Energie)."""

LAYOUTS = {
    "kpis": {"label": "Kengetallen", "desc": "Paginagewicht, aantal verzoeken, uitstoot per paginabezoek en het totaal, in vier tegels."},
    "trend": {"label": "Verloop", "desc": "Het paginagewicht en de uitstoot per bezoek in de tijd, als lijngrafiek."},
    "pages": {"label": "Per pagina", "desc": "Het gewicht, de verzoeken en de uitstoot van elke pagina, met balken."},
    "compare": {"label": "Vergelijking", "desc": "Deze website naast een gemiddelde webpagina, met een label van A+ tot F."},
    "badge": {"label": "Label", "desc": "Een compact label: de klasse en de uitstoot per paginabezoek."},
    "overview": {"label": "Overzicht (gepubliceerde uitkomsten)", "desc": "Alles samen op één pagina: kengetallen, verloop, pagina's, vergelijking en uitleg van de berekening."},
    "network": {"label": "Alle websites samen", "desc": "Het totaalbeeld van alle gekoppelde websites (verzamelmodule): totalen, verloop en een regel per website."},
}
