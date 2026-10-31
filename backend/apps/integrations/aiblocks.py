# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""The parts of the AI dashboard that can be put on a page as a block (system objects of the kind "ai"). Only a superadmin sees the figures in them."""

BLOCKS = {
    "kpis": {"label": "Kengetallen", "desc": "Aanroepen, tokens, kosten, in rekening gebracht en marge."},
    "time": {"label": "Kosten in de tijd", "desc": "In rekening gebracht per dag, per groep."},
    "groups": {"label": "Gebruik per groep", "desc": "Gebruikers, admins en superadmins: aandeel en kosten."},
    "where": {"label": "Waar wordt AI gebruikt", "desc": "De onderdelen van het systeem met de meeste aanroepen."},
    "askers": {"label": "Veel vragers", "desc": "De gebruikers met de meeste aanroepen."},
    "cost_users": {"label": "Hoogste kosten per gebruiker", "desc": "Wie het meest kost, met de groep erbij."},
    "models": {"label": "Modellen", "desc": "Welke modellen worden gebruikt, met tokens en kosten."},
    "hours": {"label": "Drukte per uur", "desc": "Op welke uren van de dag de AI wordt gebruikt."},
}
