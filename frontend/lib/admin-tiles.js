// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Tiles of the admin dashboards: one entry per admin page. `modules` decide access (see lib/perms.js).
const SEC = ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"];

export const TILES = [
  { href: "/dashboard/admin/users", title: "Users", big: "Accounts en openbare profielen", small: "Aanmaken, blokkeren, foto en rollen", modules: ["users"] },
  { href: "/dashboard/admin/ai", title: "AI", big: "AI-gebruik van je gebruikers", small: "Wat zij en jij gebruiken en wat het kost, met een rapport per gebruiker", modules: ["ai"] },
  { href: "/dashboard/admin/groups", title: "User groups", big: "Groepen van users", small: "Rollen en module-toegang per groep", modules: ["users"] },
  { href: "/dashboard/admin/roles", title: "Rollen", big: "Rechten per rol", small: "Content manager, moderator, …", modules: ["roles"] },
  { href: "/dashboard/admin/languages", title: "Talen", big: "Talen & standaardtaal", small: "Welke talen de website aanbiedt", modules: ["languages"] },
  { href: "/dashboard/admin/communication", title: "Communicatie", big: "E-mail en mobiele nummers", small: "Afzenders, antwoordadressen en nummers", modules: ["communication"] },
  { href: "/dashboard/admin/integrations", title: "API keys", big: "Externe koppelingen", small: "Aan/uit, testen en beheren", modules: ["integrations"] },
  { href: "/dashboard/admin/notifications", title: "Notificaties", big: "Meldingen aan gebruikers", small: "Weergave, soorten, e-mail en berichten sturen", modules: ["notifications"] },
  { href: "/dashboard/admin/faq", title: "FAQ", big: "Eigen veelgestelde vragen", small: "Maken, vertalen en ordenen voor de pagina /faq", modules: ["faq"] },
  { href: "/dashboard/admin/helptips", title: "Help-teksten", big: "Uitleg in de bewerkmodus", small: "Wijzig de uitleg van het vraagteken per taal", modules: ["pages"] },
  { href: "/dashboard/admin/media", title: "Media", big: "Afbeeldingen & video's", small: "Lokaal of S3, per bestand", modules: ["media"] },
  { href: "/dashboard/admin/community", title: "Community", big: "Profielen, berichten en chat", small: "Methode, opties en limieten", modules: ["profiles", "discover", "messages", "chat", "directconnect"] },
  { href: "/dashboard/admin/seo", title: "SEO", big: "Zoekmachines, bots en AI-agents", small: "robots.txt, sitemap, llms.txt, titels", modules: ["seo"] },
  { href: "/dashboard/admin/security", title: "Beveiliging", big: "Landen, 18+, cookies", small: "Toegang, popups en verboden woorden", modules: SEC },
  { href: "/dashboard/admin/subscriptions", title: "Abonnementen", big: "Toegang verkopen", small: "Abonnementen met een order per periode en toegang tot site, chat, video en meer", modules: ["subscriptions"] },
  { href: "/dashboard/admin/actions", title: "Actions", big: "Wat kost iets of vraagt een donatie", small: "Alle onderdelen met voorwaarden: abonnement, donatie, lidmaatschap en meer", modules: ["subscriptions", "donations"] },
  { href: "/dashboard/admin/donations", title: "Donaties", big: "Giften aan de makers", small: "Acties met een schuifbalk van minimum tot maximum", modules: ["donations"] },
  { href: "/dashboard/admin/system", title: "Basisgegevens", big: "Naam, adressen en deployment", small: "Website- en API-adres, contact en controlelijst", modules: ["system"] },
  { href: "/dashboard/admin/storage", title: "Mappenstructuur", big: "Waar bestanden staan", small: "Mappen, lokaal of S3 en versleuteling per gebruiker", modules: ["storage"] },
  { href: "/dashboard/admin/license", title: "Licentie", big: "Kosten en betaalmethode", small: "Wat is in gebruik, wat het kost en hoe je betaalt", modules: ["system"] },
  { href: "/dashboard/admin/statistieken", title: "Statistieken", big: "Bezoekers, SEO, bots en gebruik", small: "Grafieken per module en plugin", modules: ["stats"] },
  { href: "/dashboard/admin/backups", title: "Backup", big: "Backups per dag, week of maand", small: "Maken, downloaden en terugzetten", modules: ["backups"] },
  { href: "/dashboard/admin/installaties", title: "Standaard installaties", big: "Alles in één keer instellen", small: "Modules, plugins en thema voor een soort website; de superadmin bepaalt welke je ziet", modules: ["system"] },
  { href: "/dashboard/admin/sandbox", title: "Sandbox", big: "Testomgeving", small: "Betalingen, e-mail en sms simuleren", modules: ["sandbox"] },
  { href: "/dashboard/admin/pages", title: "Pagina's", big: "Pagina's en header-menu", small: "Overzicht, menu-editor, eigen pagina's en links", modules: ["pages"] },
  { href: "/dashboard/admin/sysobjects", title: "Systeemobjecten", big: "Onderdelen voor op pagina's", small: "Donatieknoppen en abonnementen die je in bewerkmodus op een pagina zet", modules: ["sysobjects"] },
  { href: "/dashboard/admin/siteimport", title: "Site importeren", big: "Een andere site inlezen", small: "Thema, pagina's, startpagina en afbeeldingen; weer te verwijderen", modules: ["siteimport"] },
  { href: "/dashboard/admin/theme", title: "Thema", big: "Thema's, kleuren, logo's, e-mail", small: "De hele uitstraling van de website", modules: ["theme", "branding"] },
];

export const LEVEL_LABEL = { 1: "Gebruik", 2: "Bewerken", 3: "Beheer" };
