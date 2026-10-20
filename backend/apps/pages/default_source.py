"""The Dutch source texts of the standard pages (everything else is translated from these into the other languages: data/default_texts.json)."""

# page titles (also the names in the menu): key -> Dutch
TITLES = {
    "games": "Spelletjes", "community": "Community", "search": "Zoeken & matchen", "cart": "Winkelwagen", "checkout": "Afrekenen", "payment": "Betalen & verzenden",
    "members": "Leden", "products": "Producten", "subscriptions": "Abonnementen", "donations": "Doneren",
    "product": "Product", "my-community": "Mijn community", "my-subscriptions": "Mijn abonnementen", "my-orders": "Mijn bestellingen", "my-donations": "Mijn donaties",
}

# texts of the content pages: id -> Dutch. "<page>.intro.<theme>" = the opening text per community theme; "<page>.card1..3" = a title, a line break and one sentence
TEXTS = {
    "community.intro.normal": "Ontmoet andere leden, deel verhalen en blijf met elkaar in contact.",
    "community.intro.dating": "Ontmoet nieuwe mensen, swipe door profielen, chat en maak een match.",
    "community.intro.business": "Bouw je netwerk: vind vakgenoten, vacatures en nieuwe samenwerkingen.",
    "community.intro.sporters": "Vind trainingsmaatjes, deel je doelen en beweeg samen.",
    "community.intro.webshop": "Ontmoet verkopers en winkels en blijf in contact met je favorieten.",
    "community.card1": "Maak een profiel\nVertel wie je bent en bepaal zelf wie je profiel ziet.",
    "community.card2": "Zoek en ontmoet\nVind leden die bij je passen en stuur een bericht.",
    "community.card3": "Chat en speel\nPraat live met elkaar of speel samen een spel.",
    "search.intro": "Vind leden die bij je passen. Log in om te zoeken, te swipen en een match te maken.",
    "search.card1": "Zoek gericht\nFilter op leeftijd, plaats, interesses en meer.",
    "search.card2": "Swipe door profielen\nGeef een hartje aan wie je leuk vindt.",
    "search.card3": "Maak een match\nAls jullie elkaar leuk vinden, kun je direct contact opnemen.",
    "payment.intro": "Hoe je betaalt, wanneer je bestelling bij je is en wat je doet als je iets wilt retourneren.",
    "payment.card1": "Betalen\nKies bij het afrekenen je betaalmethode. Je betaling is beveiligd.",
    "payment.card2": "Verzenden\nJe krijgt een e-mail zodra je bestelling onderweg is.",
    "payment.card3": "Retourneren\nNiet tevreden? Neem contact met ons op en we regelen het.",
    "cta.login": "Inloggen of aanmelden",
}

TEXTS.update({
    "members.intro": "Maak kennis met onze leden. Blader door de profielen en zoek iemand die bij je past.",
    "members.card1": "Ontdek profielen\nBekijk wie er is en waar iedereen voor staat.",
    "members.card2": "Veilig en eerlijk\nLeden bepalen zelf wie hun profiel ziet.",
    "members.card3": "Neem contact op\nStuur een bericht of start een chat.",
    "products.intro": "Ontdek ons aanbod. Kies wat je wilt en reken veilig af.",
    "products.card1": "Zorgvuldig gekozen\nElk product is met aandacht geselecteerd.",
    "products.card2": "Veilig betalen\nBetaal met de methode die jij het fijnst vindt.",
    "products.card3": "Snel geleverd\nJe krijgt een e-mail zodra je bestelling onderweg is.",
    "subscriptions.intro": "Kies het abonnement dat bij je past en krijg toegang tot meer.",
    "subscriptions.card1": "Eenmalig of herhaald\nBetaal per periode en zeg op wanneer je wilt.",
    "subscriptions.card2": "Direct toegang\nNa je betaling kun je meteen aan de slag.",
    "subscriptions.card3": "Alles in je account\nBekijk en beheer je abonnement in je dashboard.",
    "donations.intro": "Steun ons met een gift. Elk bedrag helpt, groot of klein.",
    "donations.card1": "Jij bepaalt het bedrag\nKies met de schuifbalk wat je wilt geven.",
    "donations.card2": "Veilig betalen\nJe donatie wordt beveiligd verwerkt.",
    "donations.card3": "Bedankt!\nJe krijgt een bevestiging en soms extra toegang als dank.",
    "games.intro": "Speel direct een spel, alleen of samen met anderen.",
    "games.card1": "Altijd een spel\nKies uit onze verzameling, van arcade tot bordspel.",
    "games.card2": "Samen spelen\nMaak een kamer en nodig anderen uit.",
    "games.card3": "Scores en ranglijst\nVerbeter je score en zie hoe je het doet.",
})

# the address of a page in every language (latin letters; zh and ar use the English one). One page, one address per language: they all lead to the same page.
SLUGS = {
    "community": {"nl": "community", "en": "community", "de": "gemeinschaft", "fr": "communaute", "es": "comunidad", "pt": "comunidade"},
    "search": {"nl": "zoeken", "en": "search", "de": "suche", "fr": "recherche", "es": "buscar", "pt": "pesquisar"},
    "payment": {"nl": "betalen", "en": "payment", "de": "zahlung", "fr": "paiement", "es": "pago", "pt": "pagamento"},
    "members": {"nl": "leden", "en": "members", "de": "mitglieder", "fr": "membres", "es": "miembros", "pt": "membros"},
    "products": {"nl": "producten", "en": "products", "de": "produkte", "fr": "produits", "es": "productos", "pt": "produtos"},
    "cart": {"nl": "winkelwagen", "en": "cart", "de": "warenkorb", "fr": "panier", "es": "carrito", "pt": "carrinho"},
    "checkout": {"nl": "afrekenen", "en": "checkout", "de": "kasse", "fr": "commande", "es": "finalizar-compra", "pt": "finalizar-compra"},
    "subscriptions": {"nl": "abonnementen", "en": "subscriptions", "de": "abos", "fr": "abonnements", "es": "suscripciones", "pt": "subscricoes"},
    "donations": {"nl": "doneren", "en": "donate", "de": "spenden", "fr": "don", "es": "donar", "pt": "doar"},
    "games": {"nl": "games", "en": "games", "de": "spiele", "fr": "jeux", "es": "juegos", "pt": "jogos"},
    "register": {"nl": "registreren", "en": "register", "de": "registrieren", "fr": "inscription", "es": "registro", "pt": "registo"},
    "privacy": {"nl": "privacy", "en": "privacy", "de": "datenschutz", "fr": "confidentialite", "es": "privacidad", "pt": "privacidade"},
}

# the opening text of the dashboard pages of a member ("Mijn ..."); "my-community" has one per community theme
TEXTS.update({
    "my-community.intro.normal": "Alles over je profiel, berichten en contacten op één plek.",
    "my-community.intro.dating": "Je matches, likes en berichten: alles om iemand leuks te ontmoeten.",
    "my-community.intro.business": "Je netwerk, berichten en contacten: bouw aan kansen en samenwerkingen.",
    "my-community.intro.sporters": "Je trainingsmaatjes, berichten en groepen: samen sta je sterker.",
    "my-community.intro.webshop": "Je contacten, berichten en favoriete verkopers en winkels.",
    "my-subscriptions.intro": "Je abonnementen, wat ze je geven en wanneer ze verlopen of verlengd worden.",
    "my-orders.intro": "Al je bestellingen en wat de status ervan is.",
    "my-donations.intro": "Je donaties en wat je daarvoor hebt gekregen. Bedankt voor je steun!",
})

TEXTS.update({
    "cart.intro": "Controleer je bestelling. Je kunt aantallen aanpassen of producten weghalen.",
    "checkout.intro": "Vul je gegevens in en kies hoe je wilt betalen. Je betaling is beveiligd.",
    "product.intro": "Heb je een vraag over dit product? Neem gerust contact met ons op.",
})
