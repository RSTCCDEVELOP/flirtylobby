// Tiles of the admin dashboards: one entry per admin page. `modules` decide access (see lib/perms.js).
const SEC = ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"];

export const TILES = [
  { href: "/dashboard/admin/users", title: "Users", big: "Accounts en openbare profielen", small: "Aanmaken, blokkeren, foto en rollen", modules: ["users"] },
  { href: "/dashboard/admin/groups", title: "User groups", big: "Groepen van users", small: "Rollen en module-toegang per groep", modules: ["users"] },
  { href: "/dashboard/admin/roles", title: "Rollen", big: "Rechten per rol", small: "Content manager, moderator, …", modules: ["roles"] },
  { href: "/dashboard/admin/languages", title: "Talen", big: "Talen & standaardtaal", small: "Welke talen de website aanbiedt", modules: ["languages"] },
  { href: "/dashboard/admin/communication", title: "Communicatie", big: "E-mail en mobiele nummers", small: "Afzenders, antwoordadressen en nummers", modules: ["communication"] },
  { href: "/dashboard/admin/integrations", title: "API keys", big: "Externe koppelingen", small: "Aan/uit, testen en beheren", modules: ["integrations"] },
  { href: "/dashboard/admin/products", title: "Producten", big: "Producten en productgroepen", small: "Prijzen, voorraad, foto's en beschrijving", modules: ["products"] },
  { href: "/dashboard/admin/orders", title: "Orders", big: "Bestellingen en webshop", small: "Status, klantgegevens en instellingen", modules: ["orders"] },
  { href: "/dashboard/admin/media", title: "Media", big: "Afbeeldingen & video's", small: "Lokaal of S3, per bestand", modules: ["media"] },
  { href: "/dashboard/admin/branding", title: "Logo's & beeld", big: "Logo, favicon, foto's", small: "Voor de website en onderhoudspagina", modules: ["branding"] },
  { href: "/dashboard/admin/community", title: "Community", big: "Profielen, berichten en chat", small: "Methode, opties en limieten", modules: ["profiles", "discover", "messages", "chat"] },
  { href: "/dashboard/admin/seo", title: "SEO", big: "Zoekmachines, bots en AI-agents", small: "robots.txt, sitemap, llms.txt, titels", modules: ["seo"] },
  { href: "/dashboard/admin/security", title: "Beveiliging", big: "Landen, 18+, cookies", small: "Toegang, popups en verboden woorden", modules: SEC },
  { href: "/dashboard/admin/subscriptions", title: "Abonnementen", big: "Toegang verkopen", small: "Abonnementen met een order per periode en toegang tot site, chat, video en meer", modules: ["subscriptions"] },
  { href: "/dashboard/admin/donations", title: "Donaties", big: "Giften aan de makers", small: "Acties met een schuifbalk van minimum tot maximum", modules: ["donations"] },
  { href: "/dashboard/admin/system", title: "Basisgegevens", big: "Naam, adressen en deployment", small: "Website- en API-adres, contact en controlelijst", modules: ["system"] },
  { href: "/dashboard/admin/storage", title: "Mappenstructuur", big: "Waar bestanden staan", small: "Mappen, lokaal of S3 en versleuteling per gebruiker", modules: ["storage"] },
  { href: "/dashboard/admin/sandbox", title: "Sandbox", big: "Testomgeving", small: "Betalingen, e-mail en sms simuleren", modules: ["sandbox"] },
  { href: "/dashboard/admin/pages", title: "Pagina's", big: "Pagina's en header-menu", small: "Overzicht, menu-editor, eigen pagina's en links", modules: ["pages"] },
  { href: "/dashboard/admin/siteimport", title: "Site importeren", big: "Een andere site inlezen", small: "Thema, pagina's, startpagina en afbeeldingen; weer te verwijderen", modules: ["siteimport"] },
  { href: "/dashboard/admin/theme", title: "Vormgeving", big: "Kleuren & lettertypen", small: "Stijl van de hele website", modules: ["theme"] },
];

export const LEVEL_LABEL = { 1: "Gebruik", 2: "Bewerken", 3: "Beheer" };
