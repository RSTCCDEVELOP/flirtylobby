// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Tiles of the admin dashboards: one entry per admin page. `modules` decide access (see lib/perms.js).
const SEC = ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"];

export const TILES = [
  { href: "/dashboard/admin/admin-setup", title: "easy2edit admin setup", big: "De admin en de dashboards naar je hand", small: "Tegels of lijst, aantal per pagina, verborgen tegels, blokken van het dashboard, zijbalk en zoekveld", find: "admin setup instellingen dashboard tegels lijst zijbalk menu zoeken verbergen weergave", modules: ["system"], always: true },
  { href: "/dashboard/admin/entity", title: "Bedrijven", big: "Over je bedrijven", small: "Naam, adres, contact en registratie; ook als variabele in je teksten", modules: ["entities"] },  // the title follows the standard installation (see components/AdminTiles.js)
  { href: "/dashboard/admin/component-requests", title: "Componentverzoeken", big: "Componenten op verzoek", small: "Wat ontwerpen nodig hebben en de component set niet heeft: beoordelen en bouwen", modules: ["component_requests"] },
  { href: "/dashboard/admin/tags", title: "Tags", big: "Tags met een kleur", small: "Voor alle onderdelen: overal, per module of per plugin", modules: ["tags"] },
  { href: "/dashboard/admin/users", title: "Users", big: "Accounts en openbare profielen", small: "Aanmaken, blokkeren, foto en rollen", modules: ["users"] },
  { href: "/dashboard/admin/ai", title: "AI", big: "AI-gebruik van je gebruikers", small: "Wat zij en jij gebruiken en wat het kost, met een rapport per gebruiker", modules: ["ai"] },
  { href: "/dashboard/admin/ai-kosten", title: "AI-kosten", big: "Wat de AI kost", small: "Live per verzoek, overzichten per dag en maand en statistieken", modules: ["ai"] },
  { href: "/dashboard/admin/rights", title: "Rechten", big: "Wie mag wat", small: "Bekijken, bewerken en verwijderen voor users en groepen: modules, pagina's en records van plugins", modules: ["rights"], find: "rechten permissies toegang acl autorisatie bekijken bewerken verwijderen groepen pagina module plugin records" },
  { href: "/dashboard/admin/groups", title: "User groups", big: "Groepen van users", small: "Rollen en module-toegang per groep", modules: ["users"] },
  { href: "/dashboard/admin/roles", title: "Rollen", big: "Rechten per rol", small: "Content manager, moderator, …", modules: ["roles"] },
  { href: "/dashboard/admin/languages", title: "Talen", big: "Talen & standaardtaal", small: "Welke talen de website aanbiedt", modules: ["languages"] },
  { href: "/dashboard/admin/communication", title: "Communicatie", big: "E-mail en mobiele nummers", small: "Afzenders, antwoordadressen en nummers", modules: ["communication"] },
  { href: "/dashboard/admin/integrations", title: "API keys", big: "Externe koppelingen", small: "Aan/uit, testen en beheren", modules: ["integrations"] },
  { href: "/dashboard/admin/notifications", title: "Notificaties", big: "Meldingen aan gebruikers", small: "Weergave, soorten, e-mail en berichten sturen", modules: ["notifications"] },
  { href: "/dashboard/admin/faq", title: "FAQ", big: "Eigen veelgestelde vragen", small: "Maken, vertalen en ordenen voor de pagina /faq", modules: ["faq"] },
  { href: "/dashboard/admin/templates", title: "Templates", big: "Een complete website als start", small: "Kies een template met voorbeeldplaatjes en pas hem daarna zelf aan", modules: ["pages"] },
  { href: "/dashboard/admin/components", title: "Componenten", big: "Kant-en-klare onderdelen", small: "Hero, prijzen, agenda, kalender en meer in de kleuren van je thema", modules: ["pages"] },
  { href: "/dashboard/admin/helptips", title: "Help-teksten", big: "Uitleg in de bewerkmodus", small: "Wijzig de uitleg van het vraagteken per taal", modules: ["pages"] },
  { href: "/dashboard/admin/media", title: "Media", big: "Afbeeldingen & video's", small: "Lokaal of S3, per bestand", modules: ["media"] },
  { href: "/dashboard/admin/community", title: "Community", big: "Profielen, berichten en chat", small: "Methode, opties en limieten", modules: ["profiles", "discover", "messages", "chat", "directconnect"] },
  { href: "/dashboard/admin/seo", title: "SEO", big: "Zoekmachines, bots en AI-agents", small: "robots.txt, sitemap, llms.txt, titels", modules: ["seo"] },
  { href: "/dashboard/admin/security", title: "Beveiliging", big: "Landen, 18+, cookies", small: "Toegang, popups en verboden woorden", modules: SEC },
  { href: "/dashboard/admin/subscriptions", title: "Abonnementen", big: "Toegang verkopen", small: "Abonnementen met een order per periode en toegang tot site, chat, video en meer", modules: ["subscriptions"] },
  { href: "/dashboard/admin/actions", title: "Actions", big: "Wat kost iets of vraagt een donatie", small: "Alle onderdelen met voorwaarden: abonnement, donatie, lidmaatschap en meer", modules: ["subscriptions", "donations"] },
  { href: "/dashboard/admin/donations", title: "Donaties", big: "Giften aan de makers", small: "Acties met een schuifbalk van minimum tot maximum", modules: ["donations"] },
  { href: "/dashboard/admin/system", title: "Licentiegegevens", big: "Naam, adressen en deployment", small: "Website- en API-adres, contact en controlelijst", modules: ["system"] },
  { href: "/dashboard/admin/storage", title: "Mappenstructuur", big: "Waar bestanden staan", small: "Mappen, lokaal of S3 en versleuteling per gebruiker", modules: ["storage"] },
  { href: "/dashboard/admin/license", title: "Licentie", big: "Kosten en betaalmethode", small: "Wat is in gebruik, wat het kost en hoe je betaalt", modules: ["system"] },
  { href: "/dashboard/admin/statistieken", title: "Statistieken", big: "Bezoekers, SEO, bots en gebruik", small: "Grafieken per module en plugin", modules: ["stats"] },
  { href: "/dashboard/admin/onboarding", title: "Onboarding", big: "Licentie, hosting en gegevens", small: "Start de onboarding opnieuw: licentie upgraden, hosting wijzigen, naam en adres bijwerken (ook op de easy2edit server)", modules: ["system"] },
  { href: "/dashboard/admin/cache", title: "Cache en snelheid", big: "Sneller en groener", small: "De website bewaart antwoorden even: minder rekenwerk, minder stroom", modules: ["system"] },
  { href: "/dashboard/admin/bomen", title: "Bomen en giften", big: "Bomen planten voor je website", small: "Je eigen maandelijkse bijdrage en giften, met easy2edit", modules: ["ecologi_admin"], needs: "ecologi_admin" },  // only while the API Ecologi is on and the superadmin allowed it
  { href: "/dashboard/admin/energy", title: "Energie & uitstoot", big: "Paginagewicht en CO2 per bezoek", small: "Meting, weergaven voor op een pagina en een API voor andere websites", modules: ["energy"] },
  { href: "/dashboard/admin/backups", title: "Backup", big: "Backups per dag, week of maand", small: "Maken, downloaden en terugzetten", find: "restore remote herstel herstellen terug zetten terugzetten importeren upload back-up backup restore", modules: ["backups"] },
  { href: "/dashboard/admin/log", title: "Logboek", big: "Wie logde in en wat is er gedaan", small: "Inloggen, uitloggen en belangrijke gebeurtenissen; bewaartermijn instellen", find: "log logboek audit inloggen uitloggen historie geschiedenis gebeurtenissen", modules: ["log"] },
  { href: "/dashboard/admin/widgets", title: "Widgets", big: "Kleine onderdelen voor je pagina's", small: "Bibliotheek met voorbeelden: installeren en toevoegen in de paginabewerker", find: "widgets widget bibliotheek aftelklok klok teller lopende tekst voortgang installeren onderdelen", modules: ["theme"] },
  { href: "/dashboard/admin/installaties", title: "Standaard installaties", big: "Alles in één keer instellen", small: "Modules, plugins en thema voor een soort website; de superadmin bepaalt welke je ziet", modules: ["system"] },
  { href: "/dashboard/admin/sandbox", title: "Sandbox", big: "Testomgeving", small: "Betalingen, e-mail en sms simuleren", modules: ["sandbox"] },
  { href: "/dashboard/admin/pages", title: "Pagina's", big: "Pagina's en header-menu", small: "Overzicht, menu-editor, eigen pagina's en links", modules: ["pages"] },
  { href: "/dashboard/admin/sysobjects", title: "Systeemobjecten", big: "Onderdelen voor op pagina's", small: "Donatieknoppen en abonnementen die je in bewerkmodus op een pagina zet", modules: ["sysobjects"] },
  { href: "/dashboard/admin/siteimport", title: "Website ontwerpen", big: "Ontwerpen of een andere site inlezen", small: "Thema, pagina's, startpagina en afbeeldingen; weer te verwijderen", modules: ["siteimport"] },
  { href: "/dashboard/admin/theme", title: "Thema", big: "Thema's, kleuren, logo's, e-mail", small: "De hele uitstraling van de website", modules: ["theme", "branding"] },
];

// All the words of the tiles that belong to a module (title, big title, text): a module is found by the name of its tile too ("Sandbox" and "Testomgeving").
export const tileWords = (...keys) => TILES.filter((t) => (t.modules || []).some((m) => keys.includes(m))).map((t) => [t.title, t.big, t.small, t.find || ""]).flat().filter(Boolean);

export const LEVEL_LABEL = { 1: "Gebruik", 2: "Bewerken", 3: "Beheer" };
