// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Builds the prompt that the user gives to an AI (ChatGPT, Claude, Gemini...) so that the AI makes a website that easy2edit can import
// (tab "HTML-bestand" or "ZIP-bestand" of Website ontwerpen). The prompt is in English on purpose: AIs follow it best; the language of the site itself is set in the form.
// The rules follow what the importer does: every html file becomes a page, the css and pictures are taken along, sections become full-width bands
// that are rebuilt with the blocks of the page editor (heading, text, image, button, spacer, line, code, faq), and modules are switched on by the content.

export const SITE_KINDS = [
  ["company", "Bedrijf / dienstverlener"], ["shop", "Webshop"], ["community", "Community / dating / ledensite"],
  ["agenda", "Evenementen / agenda"], ["blog", "Blog / nieuws"], ["portfolio", "Portfolio"], ["club", "Vereniging / sport"],
];

const KIND_HINT = {
  company: "a company or service provider: services, about us, contact",
  shop: "a web shop: product overview with prices (use .product cards), a product page, FAQ, delivery information",
  community: "a members community (profiles, search, messages): explain the benefits, how it works, safety, FAQ",
  agenda: "events and activities: an overview of upcoming events with dates and places",
  blog: "a blog or news site: an overview of articles and a few article pages",
  portfolio: "a portfolio: projects with large pictures, about me, contact",
  club: "a club or association: activities, schedule, membership, news, contact",
};

// modules: [{label, how}] the modules that the website uses; objects: [{slug, name, kind_label}] the system objects (live blocks of the system) that have to be placed on the pages.
// From the step plan (the design) it also gets: palette {primary, secondary, bg, card, text, dark, dbg, dcard, dtext} (exact colours; dbg/dcard/dtext are the dark mode), colorMode "light" | "dark" | "both", languages {main, extra: [{code, native, rtl}], switcher}, font (css stack), radius (px), theme (name of the chosen theme) and photos [{file, note}] that the user has uploaded.
export function buildPrompt({ name, kind, lang, pages, style, colors, extra, modules = [], objects = [], palette = null, font = "", radius = null, theme = "", photos = [], colorMode = "light", languages = null, rules = null, componentsText = "", organisation = "" }) {
  const RL = { max_pages: 12, max_images: 40, max_image_mb: 5, name_max: 40, ...(rules || {}) }; // the numbers of the importer (served by /sitecreator/catalog/)
  const mainLang = (languages && languages.main) || lang || "Dutch";
  const extraLangs = (languages && languages.extra) || [];
  const mainCode = (languages && languages.mainCode) || "nl"; // language code of the main language of the site
  const n = (name || "").trim() || "[name of the website]";
  const pg = (pages || "").trim() || "Home, About, Services, FAQ, Contact";
  const list = pg.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const files = list.map((p, i) => (i === 0 ? "index.html" : `${p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page" + (i + 1)}.html`));
  return `You are a senior web designer. Create a complete, professional website for "${n}" as plain static files that can be imported into the website system easy2edit. Follow every rule below exactly: the importer reads the html and css and rebuilds each page with the blocks of the easy2edit page editor, so a clean, predictable structure is more important than clever tricks.

## 1. The website
- Type: ${KIND_HINT[kind] || KIND_HINT.company}.${organisation ? `\n- About the organisation (the entity behind this website; use these real data for the texts, the tone, the contact page and the footer, and do not invent other data):\n${organisation}\n  Where the name, address, e-mail or phone of the organisation appears in a text you may write the variable {{organisatie.naam}}, {{organisatie.adres}}, {{organisatie.email}}, {{organisatie.telefoon}}, {{organisatie.website}}, {{organisatie.plaats}}, {{organisatie.kvk}}, {{organisatie.btw}}: the website fills them in. The person who looks at the page has variables too ({{user.naam}}, {{user.voornaam}}, {{user.achternaam}}, {{user.email}}, {{user.functie}}, {{user.bedrijf}}): they are only filled for a logged-in visitor, so use them only in text for logged-in people (a welcome line), never in the main text of a public page, and always inside a sentence, never as a block.` : ""}
- Language of all texts: ${lang || "Dutch"}. Write real, convincing copy (no "lorem ipsum"), with concrete headings, short paragraphs and clear calls to action.
- Pages (one html file each, in this order): ${list.map((p, i) => `${p} (${files[i]})`).join(", ")}.
- Style: ${(style || "").trim() || "modern, clean, lots of white space, friendly and professional"}.${theme ? `\n- Base the look on the theme "${theme}" of the easy2edit system: its colours and rounded corners are given below.` : ""}
- Colours: ${palette ? `use EXACTLY these as css variables on :root and nowhere else: ${[["primary", "--primary"], ["secondary", "--secondary"], ["bg", "--bg"], ["card", "--card"], ["text", "--text"], ["dark", "--dark-band"]].filter(([k]) => palette[k]).map(([k, v]) => `${v}: ${palette[k]}`).join("; ")}. --primary is the colour of buttons and links, --secondary the accent, --bg the page background, --card the background of cards, --text the text colour, --dark-band the background of the dark bands (hero, call to action, footer; text on it is light). Derive --line (borders) from --text. Keep text contrast at least 4.5:1.` : (colors || "").trim() || "choose one strong primary colour, one secondary colour, a light background and a dark text colour"}${palette ? `\n- Display: ${colorMode === "dark" ? `dark only: use --bg: ${palette.dbg}; --card: ${palette.dcard}; --text: ${palette.dtext} as the values on :root instead of the light ones.` : colorMode === "both" ? `light AND dark. The colours above are the light mode on :root. The dark mode: --bg: ${palette.dbg}; --card: ${palette.dcard}; --text: ${palette.dtext} (same --primary, --secondary and --dark-band) in :root[data-theme="dark"] { ... } and in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }. easy2edit adds its own light/dark switch.` : "light only."}` : ""}${languages && languages.extra.length ? `\n- Languages: main language ${languages.main || lang}. Other languages of the website: ${languages.extra.map((l) => `${l.native} (${l.code}${l.rtl ? ", right-to-left" : ""})`).join(", ")}. Write the pages in the main language only; the system translates them${languages.switcher ? " and adds the language switch to the header: leave room for it" : " (no language switch in the header)"}.` : ""}${font ? `\n- Font: ${font} (system fonts only).` : ""}${radius !== null && radius !== "" ? `\n- Corners: cards ${radius}px, buttons ${Math.max(0, radius - 4)}px, pictures ${Math.max(0, radius - 4)}px.` : ""}${photos.length ? `\n- PHOTOS that I already have (use them, they are the real pictures of this website): reference each as img/<file> in <img> tags and as url(img/<file>) in the css, with a fitting alt text, width and height; put the best ones in the hero and in the sections where their description fits. Do NOT create, copy or include these files in the ZIP: the system adds them when the ZIP is imported.\n${photos.map((p) => `  - ${p.file}: ${p.note || "no description"}`).join("\n")}` : ""}${extra && extra.trim() ? `\n- Extra wishes: ${extra.trim()}` : ""}

## 2. Files and folders (deliver exactly this)
- Files: one html file per page (${files.join(", ")}; the start page is index.html), at most ${RL.max_pages} pages, plus ONE shared style.css and a folder img/ with the pictures, packed in one ZIP (see the last sections). Both the html files and the css file are required: a ZIP with only html, or only css, is not accepted. Everything sits at the top level of the ZIP (or inside one single top-level folder): no other subfolders (never en/index.html).
- Every page must be reachable through a <nav>: the main menu in the header (at most 6 links) and, for the other pages, a <nav aria-label="Footer menu"> in the footer.
- Every html file is a complete document (<!doctype html>, <html lang="...">, <head> with <meta charset>, <meta name="viewport">, <title> and <link rel="stylesheet" href="style.css">, then <body>).
- ALL css goes into ONE separate css file, style.css, that every html file links with <link rel="stylesheet" href="style.css">. No <style> blocks inside the html files and no style="..." attributes (except where a value cannot be a class, e.g. a background image of one section). style.css must be complete: the html files without it would be unstyled. No css framework, no Tailwind, no Bootstrap, no CSS-in-JS, no @import of other files.
- PICTURES. Formats: jpg, png, webp or svg. At most ${RL.max_images} files in img/, each at most ${RL.max_image_mb} MB.
- File names: lowercase letters, digits, - and _ only, at most ${RL.name_max} characters before the extension (hero.jpg, team-anna.jpg, chart-costs.svg). The name in the html and css must match the file exactly.
- Reference pictures with relative paths only: <img src="img/x.jpg" alt="..." width="..." height="..."> and, for a background, background-image: url(img/x.jpg) on a <section> class in style.css, with an overlay so text stays readable. Every file in img/ is used at least once; no unused files. Every <img> has a useful alt text, width and height.
- svg files: plain shapes and text only, no scripts, no external links, no embedded bitmaps.
- No data: URLs, no hotlinks to other websites.
- SCREENSHOTS (strongly recommended): when you can render your pages (in your design canvas or with a headless browser), add a folder ${RL.screenshot_folder || "screenshots"}/ with ONE full-page desktop screenshot per page, 1440 px wide, named after the html file: index.png for index.html, over-ons.png for over-ons.html (png, jpg or webp, each at most 6 MB, at most ${RL.max_screenshots || 24}). Make them from the FINAL result, after you have corrected it. easy2edit uses them as the reference to rebuild the layout, backgrounds, colours and spacing as exactly as possible. No mobile screenshots are needed. If you cannot create image files yourself, use clearly named placeholders in img/ and add a list at the end: for every picture the file name, the size in pixels and a one-line description (or an image prompt) so I can add them myself.
- Do NOT use JavaScript for content or layout (no sliders, tabs or accordions built with scripts). No external fonts or scripts: use a system font stack (system-ui, -apple-system, "Segoe UI", Roboto, sans-serif), or one font that you describe in the notes. One html file at most 2 MB.
- Use relative links between the pages (href="about.html"), "#section-id" for links to a place on the same page, and normal https:// addresses for external links.

## 3. Structure of every page (this is what makes it editable in easy2edit)
- <body> contains, in this order: one <header> (logo/name, <nav> with links, optionally one button), one <main>, one <footer>. easy2edit uses its own header and footer, so keep these simple (the header logo must be an <img> file in img/: it becomes the logo of the site; no backdrop-filter or position:fixed inside the header): brand, 3-6 links, an optional button; footer with short text and links.
- <main> consists ONLY of full-width <section> elements, one per band of the page, each with a clear id ("hero", "services", "faq", "contact"). Never put a card or box around a whole section; the background colour of the band goes on the <section> itself, edge to edge.
- Inside a section put ONE centred container: <div class="container"> with max-width 1100px, margin 0 auto, padding 0 1.25rem. Use the same container on every page.
- Vertical rhythm: every section has padding 4rem 0 (hero 6rem 0), alternating light and tinted or dark background so the bands are easy to tell apart.
- Content inside a section is built from these elements only, because these map one to one to the blocks of the page editor: (columns, cards and the hero are described under "Design guidelines" below)
  - Headings: <h1> (once per page, in the hero), <h2> for a section title, <h3> for a card title. Never skip a level.
  - Light/dark mode: follow the "Display" line of section 1. easy2edit sets data-theme on <html> and shows its own light/dark switch: never build a switch and never use JavaScript for it. The colour rules are in the line "Every colour is a real value" below.
  - Languages: write every html page in the main language (${mainLang}) only. Never one html file per language and no language switch of your own: easy2edit adds the switch. Leave room at the right of the header for the language switch, let menu items and buttons grow with longer words (min-width, no fixed widths on text), and when a right-to-left language (ar, he, fa, ur) is among the languages use logical css properties (margin-inline, padding-inline, text-align: start, inset-inline) so the layout mirrors correctly.
  - Text: <p>, <ul>/<ol> with <li>, <strong>, <em>, <a>: this simple html formatting stays in the texts (they become editable rich text in the page editor). No <br> layout tricks.
  - Pictures: a plain <img> (optionally inside <figure>). Background pictures: only on a <section> via css (background-image: url(img/x.jpg)) with an overlay colour if text sits on it.
  - Buttons: <a class="btn btn-primary" href="..."> and <a class="btn btn-outline" href="...">. Never <button> without a link, never a <form> (contact goes to a mailto: link, a phone link or a link to the Contact page; forms are added later with the system's own modules).
  - Spacing and dividers: use margins/padding and <hr>.
  - Colour and quotes: every text, heading and quote can have its own colour (css color on that element, always a variable of the palette). A quote is ONE <blockquote> with the quotation, and the author in a <figcaption> or <cite>; easy2edit draws the two big quotation marks itself, in a colour that can be changed per quote: never type or draw quotation marks of your own around it.
  - Position of a block (every block of the page editor has the tabs Position, Uitlijnen and Lettertype, and the importer rebuilds what you write like this): a heading, paragraph or quote that is narrower than its column gets a max-width in % (10 to 100) or px on that element (a lead paragraph of 38rem or 60%) and sits left, centred (margin-inline: auto) or right (margin-left: auto) in its column; text-align left, center, right or justify says how its lines run; align-self / align-items start, center or end in a tall column puts a block at the top, in the middle or at the bottom of that column (a text next to a tall picture: centre it vertically). font-family is only the body or heading font of the theme, one serif stack (Georgia) or one monospace stack: never other fonts.
  - Animations and effects: no @keyframes, animation or scroll/hover scripts of your own. Every block of the page editor has a tab Animatie (effect when it appears, duration, delay, speed curve, mouse-over effect, a movement that goes on, parallax background) that the owner sets there. Plain css :hover on buttons and links is fine.
  - Map and route: never embed a map or an <iframe>. Write the address in a <p> under a heading such as Locatie; the page editor has a map block (Google Maps with zoom buttons, kind of map, a route search for the visitor and an Open in Google Maps button) that is added there.
  - Frequently asked questions: ONE section with id="faq" and for each question <details><summary>Question?</summary><p>Answer.</p></details>. They are moved into the FAQ module of the system.
  - Prices or products (webshop): <div class="product"> cards with picture, <h3> name, a <p class="price">€ 19,95</p> and a button. The importer then switches on the web shop module.
  - Events: <article class="event"> with <h3>, date, place and a short text (switches on the agenda module).
  - Icons: use simple inline <svg> only when needed, single colour (stroke="currentColor"), never emoji or coloured icons. The importer leaves icons and emoji out, so never let them carry the meaning: use words or numbers.
- Every colour is a real value. Define them once as css variables on :root (--primary, --secondary, --bg, --text, --card, --line) and use them everywhere; no hard-coded colours in rules (svg illustrations use currentColor or the variables), also not in the dark mode. Text on pictures and on dark bands has its own colour with a contrast of at least 4.5:1 in every mode.
- Typography in rem: body 1rem/1.6, h1 2.6-3.4rem, h2 1.8-2.2rem, h3 1.2-1.4rem. Buttons: padding .75rem 1.4rem, border-radius 10px, font-weight 600.
- Responsive and accessible: it must look right from 360 px to 1600 px wide; sufficient contrast; one <h1> per page; alt texts; descriptive link texts (no "click here").

## Design guidelines: what the easy2edit page editor can build
The importer turns every <section> into a BAND of the page editor and its content into the blocks below. Design with exactly these possibilities, then the page looks the same after the import and stays editable. Stay inside them; clever css that has no block ends up as a code block, which is harder to edit.
- Band (one <section>): full width, with its own background colour, or a background picture with an overlay (0-90 %) so text stays readable, a text colour for that band (when none is set, the editor shows white text on a solid dark background colour), padding top and bottom, optional rounded corners and an optional minimum height. Bands alternate (light, tinted, dark) and run edge to edge; the content sits in one centred container (max 1100px).
- Hero (the first band of a page): a full-width band with a background picture or a strong colour and an overlay. Give it a clear height in css only when you want one (min-height in vh/svh, for example 70svh); otherwise use padding (6rem 0). Content in this order: a small label above the heading (a text with its own background, like a pill), ONE <h1>, a short paragraph, one or two buttons, and small notes or trust lines below them. Choose one of two layouts: text centred in one column, or two cells (50/50 or 55/45) with the text left and a picture or a card right, both vertically centred. Every page has a hero or at least a heading band.
- Cells: a band holds 1 to 4 cells side by side (widths 25, 33, 50, 66 or 75 %). Each cell aligns its content left, centre or right and top, centre or bottom. More than 4 items: make a second row. Cells become one column on a phone.
- Cards: a cell can be a card with its own background, rounded corners, inner padding, a 1px border and/or a shadow. Use cards for services, steps, prices, plans, testimonials and preview boxes; every card in a row has the same height. Never put a card around a whole band.
- Blocks inside a cell (use only these): heading (size, weight 400-800, colour, alignment), text (p, ul, ol, li, strong, em, a, br; optionally as a label with its own background), image (width 100 %, 50 % or a fixed px width, rounded corners), button (primary, outline or ghost, with a link to a page, a #section or an https address), spacer (a height), line (a divider), FAQ (see below), system object (see below). Anything else (a progress bar, a list with check marks or icons, a mock-up, a table, a gradient shape, an inline svg) becomes a code block: use it sparingly and keep it self-contained (no script, no external files).
- HEADER WIDTH: the header is exactly as wide as the content (the same maximum width as the sections and the footer), never full screen, unless I ask for a wider header.
- ONE PHOTO, ONE PLACE: when there are several photos, never use the same photo twice (not in the hero and again lower down, not on two pages): every picture place gets a different photo that fits it, the rest goes together in a gallery (a row of pictures). Never put two large pictures directly under each other.
- Pictures: every picture is a plain <img> (or a section background); give a hero picture at least 1600 px width, cards 800 px, and every picture an alt text. Keep important content out of the picture itself.

## CSS vocabulary that easy2edit reads EXACTLY
Use these class names and this structure. A section that follows them is rebuilt directly from your css values (colours, sizes, margins, padding, columns, card style), so it looks exactly like your design and its spacing is the same. Anything outside it still works, but is rebuilt less exactly.
- Band: <section id="..." class="band-light"> (or band-dark, band-tint, band-card). The colours and the padding of the band (for example padding: 4rem 0, hero 6rem 0) are in the css rule of that class.
- Hero with a picture: class="band-dark hero-bg hero-<page>"; .hero-bg has the overlay (a linear-gradient layer over the picture) and .hero-<page> sets --hero-photo: url(img/x.jpg). The picture can be anywhere in the css rule: easy2edit finds it.
- One <div class="container"> in every band (max-width 1100px, margin 0 auto, padding 0 1.25rem). Optional: <div class="intro"> around the label, heading and lead of the band.
- Content elements, directly in the container, the intro or a card: .label (a small pill text), h1, h2, h3, p, p.lead, ul, ol, a.btn.btn-primary, a.btn.btn-outline, img (with alt), hr, and <div data-sysobject="slug"></div>.
- Columns: <div class="grid grid-2"> (grid-3, grid-4) with display: grid; grid-template-columns: repeat(N, minmax(0, 1fr)); gap: 1.5rem. Its children are <div class="card"> (a background, a 1px border and/or a shadow, border-radius, padding) or plain elements.
- Spacing: put it in the css as margin-bottom on headings and paragraphs and as padding on bands and cards, never with empty elements, <br> stacks or inline styles. easy2edit copies these values.
- Colours only through css variables (:root); never colours inside the html.
- Not read exactly (they are rebuilt with more guessing): accordions (<details>), tables, forms, inline svg drawings, iframes.

${extraLangs.length ? `## Translations (one file per extra language)
${extraLangs.map((l) => `- Add a translation file vertalingen-${l.code}.json at the top level of the ZIP with the ${l.native} translation of EVERY text of every page.`).join("\n")}
- Format of a translation file (UTF-8, valid JSON):
  {"formaat": "easy2edit-vertalingen/1", "bron": "${mainCode}", "doel": "<code>",
   "paginas": {"index.html": [{"element": "h1", "${mainCode}": "<text exactly as in the html>", "<code>": "<translation>"}, ...], ...}}
  The keys of an item are "element", the code of the main language (${mainCode}) and the code of the target language (the same as "doel"). "element" is one of: title, meta description, og:title, og:description, h1, h2, h3, p, li, summary, link, alt, aria-label.
- One item per text, in the order of the page: the <title>, the meta description, og:title, og:description, every h1, h2, h3, p, li, summary, every link and button text, every alt text and every aria-label. Copy the source text EXACTLY as it is in the html, including simple inline html (em, strong, a, br) and entities; keep that html in the same place in the translation. In a translation only p, ul, ol, li, strong, em, a and br are allowed as html. Translate naturally for the target audience; keep prices, numbers, product names and brand names, and use the number format of the target language (€ 30.95).

` : ""}${componentsText ? componentsText + "\n" : ""}## 4. SEO
- Every page has a unique <title> (max 60 characters) and <meta name="description"> (max 155 characters).
- Include an Open Graph image (og:image, img/og.jpg, 1200x630) on the start page.

${modules.length || objects.length ? `## 5. Modules and system objects of easy2edit
easy2edit has modules (webshop, FAQ, community, agenda, ...) and system objects: ready-made, LIVE blocks that the system fills with real data (a product overview, an agenda, a subscription plan, a donation button, ...). Design the pages so that they work with the modules below, and place the system objects exactly as explained.
${modules.length ? `
Modules this website uses (what the pages must do for each):
${modules.map((m) => `- ${m.label}: ${m.how}`).join("\n")}
` : ""}${objects.length ? `
System objects to place on the pages. A system object is an EMPTY element on its own line, written exactly like this (SLUG as given):
  <div data-sysobject="SLUG"></div>
Rules for placing them:
- Put it directly inside the <div class="container"> of the section where it belongs, after the section heading and a short intro text. Give that section an id and make it a normal full-width band.
- Never put it inside <p>, <a>, <details>, a card or a column that has other items; never give it content, classes or styling: easy2edit fills it with the live content (the importer turns it into a system-object block of the page editor).
- Do not imitate or redraw what the object shows (no own product cards, no own price table for a plan object): the object is that part of the page. Write only the heading, a short intro and, if useful, a button below it.
- Use each object once, on the page where it fits best (agenda objects on the home or agenda page, plans on a pricing section, product overviews on the shop section).
The objects:
${objects.map((o) => `- ${o.slug}: ${o.name} (${o.kind_label})`).join("\n")}
` : ""}
Links of the system that you may use in the menu, buttons and footer: / (home), /login, /registreren, /dashboard, /faq, /producten, /winkelwagen, /privacy, /cookies. Never build your own login, registration, cart or checkout forms.

` : ""}## ${modules.length || objects.length ? 6 : 5}. Check and adjust in your design canvas BEFORE you deliver
Do not deliver blind. Use the design canvas of your client (Claude Design / Canvas, an artifact or any live preview) to look at the website and to adjust it, and only package the ZIP when every page is right.
- Show every page in the canvas (put the css of style.css into the page for the preview if needed) and look at the real result, not only at the code. If your client has no canvas or preview, render the pages in a headless browser and look at the screenshots.
- Check each page at 1440 px (computer), 820 px (iPad) and 390 px (phone) wide: no horizontal scrolling, nothing overlapping or cut off, columns become one column on the phone, the menu and buttons still fit.
- Check the structure rules: one centred container per section, full-width bands, one <h1> per page, cards of equal height, the header and footer identical on every page.
${colorMode !== "light" ? "- Check the dark mode as well: set data-theme=\"dark\" on <html> in the canvas and look at every page again; text and illustrations stay readable (contrast at least 4.5:1).\n" : ""}- Check that every page is linked from a <nav>, every image reference resolves to a file in img/ with the exact same name, no file name is longer than ${RL.name_max} characters, and there are at most ${RL.max_images} pictures.${extraLangs.length ? " Every translation file is valid JSON and contains an item for every text of every page (none missing, none empty)." : ""}
- Check that every link between the pages works, the texts are real (no placeholder text) and the colours are exactly the given variables.
${photos.length ? "- The photos listed above are not in the ZIP, so they will not show in your canvas: that is expected. Look at the layout with temporary grey boxes of the same size and do NOT put those boxes in the files.\n" : ""}${objects.length ? "- The system objects (<div data-sysobject=\"...\"></div>) stay empty and show nothing in the canvas: check that the space around them (heading, intro, band) still looks right without them.\n" : ""}- Adjust in the canvas: fix every problem you see (spacing, contrast, alignment, overflow, text that is too long), look again, and repeat until all pages are right. Then write the files and make the ZIP.
- In your final message tell me in a few lines what you checked and what you changed because of it.

## ${modules.length || objects.length ? 7 : 6}. What to deliver: ONE ZIP file
- The end result MUST be a single downloadable ZIP file, named "${n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website"}.zip", that I can upload directly in easy2edit (Website ontwerpen, tab ZIP-bestand). Do not give me loose code blocks as the final answer.
- The ZIP MUST contain, at the top level: the html files ${files.join(", ")} (all of them) AND style.css (the css file, never missing and never empty), ${extraLangs.length ? `the translation files ${extraLangs.map((l) => `vertalingen-${l.code}.json`).join(", ")}, ` : ""}and the folder img/ with the pictures that you made, and the folder ${RL.screenshot_folder || "screenshots"}/ with a screenshot per page${photos.length ? " (not the photos listed in section 1)" : ""}. index.html MUST be at the top level of the ZIP (or inside one single top-level folder), never deeper, and every path in the html and css must be relative to it so the site works when you open index.html straight from the unzipped folder.
- Create the actual files and the ZIP yourself with your code/file tools (for example Python zipfile) and give me the download link. Generate or fetch the pictures as real files in img/ when you can (royalty-free or generated images, each at most 5 MB). Test the ZIP before you hand it over: unzip it, check that all the html files and style.css are in it, that every html file links style.css, that index.html exists, that every html file, link and image reference resolves, and that there are no missing files.
- If you cannot create a ZIP or files, then give every file complete in its own code block with the file name above it (style.css first, then ${files.join(", then ")}), plus a short Python or shell script that builds the ZIP from those files, and the list of pictures I still have to add (file name, size in pixels, one-line description). Never shorten or write "the rest is the same".
- Finish with one short line per page saying what it is for, and the list of modules the site needs (web shop, FAQ, agenda, ...) if any.

${completeness(modules.length || objects.length ? 8 : 7)}
## ${modules.length || objects.length ? 9 : 8}. How I will use it
I upload the ZIP in easy2edit at Website ontwerpen (tab ZIP-bestand). easy2edit takes the colours and shapes as a theme, puts the pictures in the media library, turns every section into editable rows and blocks of the page editor (the system objects become live blocks), and switches on the modules the content needs. Nothing else is needed from you.`;
}



// The rules that make an AI deliver EVERYTHING: the whole design, every page, every picture, the screenshots, with a list that proves it. Used by both prompts.
const completeness = (n) => `## ${n}. Deliver it COMPLETE
- Complete means: every page, every section, every text, every picture, the whole of style.css, the screenshots and the translation files (if asked). Nothing is left out, shortened, summarised or "left as an exercise". Never write "...", "etc.", "same as above", "the rest is similar" or a placeholder instead of real content. Copy the texts of the design word for word.
- Do not stop halfway and do not ask me whether to continue. If the work is too long for one answer, carry on in the next messages without me asking, and only give me the final ZIP when everything is in it. Work file by file and finish each file before you start the next.
- Before you build the ZIP make a checklist of everything that has to be in it: all pages (from the design and from the menus), all pictures that the html and css refer to, the screenshots, the translation files, the logo, the icons. Tick them off one by one against the real files, and fix what is missing.
- Include a file MANIFEST.txt at the top level of the ZIP: one line per file (name, what it is, size) plus the list of the live blocks (data-sysobject slugs) and where you placed them, and anything you could not do or had to assume. The importer ignores this file.
- After building: unzip your own ZIP, list its content and compare it with the checklist. Count the pages, the pictures and the screenshots. In your last message give me that list and the counts, and say clearly "complete" or name exactly what is missing and why. Do not claim it is complete when it is not.
- If a picture, font or file from my design is not available to you, do not drop it silently: keep the reference, use a neutral placeholder of the same size and list it in the last message.
`;

// What the importer reads from a design, worked out from the files themselves: the colour variables (light and dark), the colours that are used most, the fonts, the corner radii, the widths,
// the meta data (theme-color, icons, og:image, language) and the pictures. files: [{name, text}] (html, css, svg). Used by the prompt that converts a design into an import ZIP.
const top = (arr, n) => { const m = {}; arr.forEach((x) => { m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n); };
export function analyseDesign(files) {
  const css = files.filter((f) => /\.css$/i.test(f.name)).map((f) => f.text).concat(files.filter((f) => /\.html?$/i.test(f.name)).flatMap((f) => [...f.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]))).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const html = files.filter((f) => /\.html?$/i.test(f.name));
  const vars = [];
  for (const m of css.matchAll(/([^{}]*(?::root|\.theme-dark|\.theme-light|\[data-theme[^\]]*\])[^{}]*)\{([^{}]*)\}/g)) {
    const decl = [...m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map((d) => `${d[1]}: ${d[2].trim()}`);
    if (decl.length) vars.push({ selector: m[1].replace(/\s+/g, " ").trim().slice(-120), decl });
  }
  const colors = top([...css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0].toLowerCase().replace(/\s+/g, "")), 24);
  const fonts = [...new Set([...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim()))].slice(0, 8);
  const faces = [...css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*([^;}]+)[^}]*\}/gi)].map((m) => m[1].trim().replace(/["']/g, ""));
  const webfonts = html.flatMap((f) => [...f.text.matchAll(/<link[^>]+href=["']([^"']*(?:fonts\.googleapis|fonts\.bunny|use\.typekit)[^"']*)["']/gi)].map((m) => m[1]));
  const radii = top([...css.matchAll(/border-radius\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim()), 6);
  const widths = top([...css.matchAll(/max-width\s*:\s*(\d+(?:\.\d+)?(?:px|rem))/gi)].map((m) => m[1]), 5);
  const sizes = top([...css.matchAll(/\b(h[1-3])\s*(?:,\s*h[1-3]\s*)*\{[^}]*font-size\s*:\s*([^;}]+)/gi)].map((m) => `${m[1]} ${m[2].trim()}`), 6);
  const meta = html.map((f) => ({
    name: f.name,
    lang: (f.text.match(/<html[^>]*\blang=["']([^"']+)/i) || [])[1] || "",
    title: ((f.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim(),
    themeColor: (f.text.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)/i) || [])[1] || "",
    icons: [...f.text.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/gi)].map((m) => m[1]),
    og: (f.text.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i) || [])[1] || "",
  }));
  const pics = [...new Set(files.flatMap((f) => [...f.text.matchAll(/(?:src|poster)=["']([^"']+\.(?:png|jpe?g|webp|gif|svg))["']|url\(["']?([^"')]+\.(?:png|jpe?g|webp|gif|svg))["']?\)/gi)].map((m) => m[1] || m[2])))].filter((x) => x && !/^(https?:|data:|\/\/)/.test(x));
  const remote = [...new Set(files.flatMap((f) => [...f.text.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi)].map((m) => m[1])))].slice(0, 20);
  const dark = vars.some((v) => /dark/.test(v.selector)) || /prefers-color-scheme\s*:\s*dark/.test(css);
  return { vars, colors, fonts, faces, webfonts, radii, widths, sizes, meta, pics, remote, dark };
}

const MAX_DESIGN = 700000; // characters of design files that go into the prompt
function designSection(files, a) {
  const rows = [];
  rows.push(`Files: ${files.map((f) => f.name).join(", ")}.`);
  if (a.vars.length) rows.push(`Colour variables (the theme; keep these exact values and names):\n${a.vars.map((v) => `  ${v.selector} { ${v.decl.join("; ")} }`).join("\n")}`);
  rows.push(`${a.dark ? "The design HAS a dark mode: keep it (see the dark rules above)." : "The design has no dark mode: do not invent one."}`);
  if (a.colors.length) rows.push(`Colours used in the css, most used first: ${a.colors.map(([c, n]) => `${c} (${n}x)`).join(", ")}. Turn every colour that is used more than once into a variable.`);
  if (a.fonts.length || a.faces.length || a.webfonts.length) rows.push(`Fonts: ${a.fonts.join(" | ") || "(none set)"}${a.faces.length ? `; @font-face: ${a.faces.join(", ")}` : ""}${a.webfonts.length ? `; loaded from the web: ${a.webfonts.join(", ")}` : ""}. Keep the same look: easy2edit takes the main font family from font-family. If a font is loaded from the web or by @font-face, keep its name FIRST in the font-family stack and end the stack with a system font; do not link external font files.`);
  if (a.radii.length) rows.push(`Corner radii (most used first): ${a.radii.map(([r, n]) => `${r} (${n}x)`).join(", ")}. easy2edit sets the corner radius of the theme, buttons and popups from these.`);
  if (a.widths.length) rows.push(`Content widths: ${a.widths.map(([w, n]) => `${w} (${n}x)`).join(", ")} (the container becomes the content width of the site).`);
  if (a.sizes.length) rows.push(`Heading sizes: ${a.sizes.map(([x]) => x).join("; ")}.`);
  const mt = a.meta.filter((m) => m.themeColor || m.icons.length || m.og || m.lang);
  if (mt.length) rows.push(`Meta data per page:\n${mt.map((m) => `  ${m.name}: lang=${m.lang || "-"}; title="${m.title}"; theme-color=${m.themeColor || "-"}; icons=${m.icons.join(", ") || "-"}; og:image=${m.og || "-"}`).join("\n")}`);
  if (a.pics.length) rows.push(`Pictures that the files refer to: ${a.pics.join(", ")}. Every one of them MUST be in img/ of the ZIP under exactly the name used in the html/css (take them from my files; if I did not give the picture, say so in your last message).`);
  if (a.remote.length) rows.push(`Pictures linked from other websites (hotlinks): ${a.remote.join(", ")}. Download them into img/ and change the references to img/<name>.`);
  const per = Math.max(20000, Math.floor(MAX_DESIGN / Math.max(1, files.length)));
  const body = files.map((f) => `=== FILE: ${f.name} ===\n${f.text.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]{200,}/g, "data:...(removed: make it a file in img/)").slice(0, per)}${f.text.length > per ? "\n...(cut off: this file is longer; ask me for the rest)" : ""}`).join("\n\n");
  return `## 0. The design to convert (read ALL of it before you start)\nWhat the importer will read from it, worked out from the files:\n${rows.map((r) => `- ${r}`).join("\n")}\n\nThe complete files:\n\n${body}\n\n=== END OF FILES ===\n`;
}

// The prompt for an AI that gets a finished HTML design (one or more html files, with or without css and pictures) and turns it into ONE ZIP that easy2edit imports
// (Website ontwerpen > ZIP-bestand) with the modules and live system objects linked. objects: [{slug, name, kind_label}] from /sitecreator/catalog/; rules: the numbers of the importer.
export function buildConvertPrompt({ objects = [], rules = null, languages = [], mainCode = "nl", files = [], componentsText = "", brief = "", themeBrief = null, compsetName = "" } = {}) {
  const RL = { max_pages: 12, max_images: 40, max_image_mb: 5, name_max: 40, ...(rules || {}) };
  const live = objects || [];
  const extra = (languages || []).filter((l) => l.enabled && !l.default);
  const has = files.length > 0;
  const fromBrief = !has && !!brief;  // no design files, only the answers of the wizard: the AI designs the website itself
  const briefSection = brief ? `\n## 0b. The brief: what the owner told about the website\nThese are the answers of the owner. Follow them exactly (name, goal, audience, tone, pages and what is on them, colours, style, imagery, modules, languages, contact details). Where something is not filled in, make a good choice yourself and say so in your last message.\n\n${brief}\n` : "";
  // the conditions of a chosen theme and component set (only when the owner chose them)
  const T = themeBrief;
  const themeSection = T ? `\n## 0c. The chosen easy2edit theme (MANDATORY)\nThe owner chose the theme "${T.name}" (${T.mode}). This theme has priority over every colour, font and corner rule below. The website MUST use exactly this theme:\n- Put this block at the top of style.css, unchanged. You may ADD variables, but never change these values; use ONLY these variables for every colour (no other hard-coded colours, except white/black in overlays):\n\n\`\`\`css\n${T.css}\n\`\`\`\n\n- Fonts: headings use var(--font-heading) (${T.font_heading}), body text var(--font-body) (${T.font_body}), heading weight ${T.heading_weight}, base size ${T.base_size}px, line height ${T.line_height}. easy2edit loads the theme fonts itself${T.fonts_url ? ` (Google Fonts: ${T.fonts_url})` : ""}: write font-family: var(--font-heading) / var(--font-body) and do NOT add @import or <link> for fonts. This overrides the rule about system fonts only.\n- Corners: cards and containers use var(--radius) (${T.radius}px), buttons and fields var(--btn-radius) (${T.btn_radius}px). Shadows: ${T.shadow}.\n- ${T.mode === "light" ? "The theme has a light mode only." : "Build the light and the dark mode with exactly these two sets of variables (see the block); never swap colours by hand in the dark mode."}\n` : "";
  const compsetSection = compsetName ? `\n## 0d. The chosen component set (MANDATORY)\nThe owner chose the component set "${compsetName}". Build the pages with its components wherever they fit (hero, cards, pricing, FAQ, forms, tables, charts, lists and more): copy the markup of the component with its easy2edit_tag attribute (data-easy2edit-tag="...") and its e2e- classes unchanged, and put the text and images of this website in it. easy2edit draws the components in the colours, fonts and corners of the theme. The list of components is further down in this prompt.\n` : "";
  const intro = fromBrief ? `You are a senior web designer and front-end engineer. I give you a brief about a website (section 0b below). Design the COMPLETE website yourself (all pages with real texts, a consistent look and the pictures as svg or placeholders), and deliver it as ONE ZIP file that the website system easy2edit imports (Website ontwerpen > ZIP-bestand). easy2edit reads the html AND the css and rebuilds every page exactly with its page editor (bands, cells, cards, headings, texts, images, buttons), takes the colours as a theme, puts the pictures in the media library and links the live modules. A predictable structure matters more than clever tricks: follow the rules below.` : `You are a senior front-end engineer. I give you an existing HTML design (${has ? "all its files are in section 0 below" : "one or more html files, maybe with css, pictures and screenshots; they come with this prompt"}). Convert it, WITHOUT changing how it looks, into ONE ZIP file that the website system easy2edit imports (Website ontwerpen > ZIP-bestand). easy2edit reads the html AND the css and rebuilds every page exactly with its page editor (bands, cells, cards, headings, texts, images, buttons), takes the colours as a theme, puts the pictures in the media library and links the live modules. A predictable structure matters more than clever tricks: keep the look, change the markup where the rules below need it.`;
  return `${intro}
${briefSection}${themeSection}${compsetSection}
${has ? designSection(files, analyseDesign(files)) : ""}
## 1. What you deliver
- ONE downloadable ZIP, top level (or inside one single top-level folder): every page as an html file (the start page MUST be index.html; at most ${RL.max_pages} pages), ONE shared style.css, a folder img/ with all pictures${extra.length ? `, the translation files vertalingen-<code>.json` : ""} and a folder ${RL.screenshot_folder || "screenshots"}/ with one full-page desktop screenshot (1440 px wide, png/jpg/webp, named after the html file: index.png for index.html) per page, made from the FINAL result. No other subfolders.
- Make the ZIP yourself with your file tools and give me the download link. Do not give loose code as the answer; only if you cannot create files, give every file complete in its own code block plus a script that builds the ZIP. Never write "the rest is the same".
- Pictures: jpg, png, webp or svg; at most ${RL.max_images} files, each at most ${RL.max_image_mb} MB; file names lowercase letters, digits, - and _ only, at most ${RL.name_max} characters before the extension; every file used at least once; relative paths only (img/x.jpg) in html and css; no data: URLs, no hotlinks. Convert pictures that are embedded as data: URLs or linked from the web into real files in img/. svg: shapes and text only, no scripts.

## 2. Structure of every page
- <body>: one <header> (logo as <a class="logo"><img src="img/logo.png" alt="..."></a>: the logo MUST be an image file (png/svg in img/) inside the header, never inline svg or only text, because that picture becomes the logo of the site; a separate dark-mode version is img/logo-dark.png, one <nav> with at most 6 links, optionally ONE <a class="btn btn-primary"> as call to action), one <main>, one <footer> with short text and a <nav aria-label="Footer menu">. Every page is linked from a nav. Use relative links between pages (about.html), #id for places on the same page, https:// for external. Rename a link target if the page is renamed.
- Header: its background is var(--card) (so it follows the light/dark theme), its links var(--text). The header is turned into the easy2edit menu: keep it simple and the same on every page. Leave room at the right for the language switch and the light/dark switch of easy2edit; do not build your own.
- <main> consists ONLY of full-width <section id="..."> bands. Background colour/picture of the band goes on the <section>; never a box around a whole section. Inside: ONE <div class="container"> (max-width 1100px; margin 0 auto; padding 0 1.25rem). Vertical rhythm through padding on the section (4rem 0, hero 6rem 0), alternating light / tinted / dark bands.
- Elements inside the container: .label (small pill text above a heading), h1 (once per page, in the hero), h2, h3, p, p.lead, ul/ol/li, strong/em/a, a.btn.btn-primary, a.btn.btn-outline, img (with alt, width, height), hr, <div class="intro"> around label+heading+lead, <div class="grid grid-2|grid-3|grid-4"> (display:grid; grid-template-columns: repeat(N, minmax(0,1fr)); gap) with children <div class="card"> (background, 1px border and/or shadow, border-radius, padding; cards in one row have equal height) and <div data-sysobject="..."></div>.
- A heading with a coloured word: <h1>Plain <em>coloured</em> words</h1> with h1 em { font-style: normal; color: var(--primary); }.
- Round number badges, pills, check lists, mock-ups: build them as simple elements with classes in style.css (border-radius: 50% with equal width and height for a round badge). Icons: single-colour inline <svg stroke="currentColor"> only; never emoji or coloured icons, and never let an icon carry the meaning.
- Spacing ONLY through css margins/padding (margin-bottom on headings and paragraphs, padding on bands and cards): no empty elements, <br> stacks, &nbsp; or inline styles. easy2edit copies these values, so the page looks the same after the import.
- FAQ: ONE section id="faq" with <details><summary>Question?</summary><p>Answer.</p></details> per question (they are moved into the FAQ module).
- No JavaScript for content or layout (no sliders, tabs, accordions by script), no <form>, no <button> without a link, no external fonts or scripts, no css framework, no @import. Use system fonts (system-ui, -apple-system, "Segoe UI", Roboto, sans-serif). Contact goes to a mailto:/tel: link or a link to the contact page.

## 3. style.css: theme and exact values
- ALL css in ONE style.css linked by every html file (<link rel="stylesheet" href="style.css">); no <style> blocks, no style="" attributes (except a background-image of one section that cannot be a class).
- Colours only as variables on :root, used everywhere (no hard-coded colours in rules, also not in dark mode): --primary (buttons, links), --secondary (accent), --bg (page), --card (cards and header), --text, --dark-band (dark bands: hero, call to action, footer; text on it is light, e.g. --on-dark), --line (derived from --text). easy2edit takes these as the theme.
- If the design has a dark mode: put the dark values of --bg, --card and --text in :root[data-theme="dark"] { } AND in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { } }. easy2edit sets data-theme on <html>; never build a switch. Keep text contrast at least 4.5:1 in both modes.
- Band classes: <section class="band-light">, band-dark, band-tint, band-card. A hero with a picture: class="band-dark hero-bg hero-<page>" where .hero-bg holds the overlay (a linear-gradient layer over the picture) and .hero-<page> sets --hero-photo: url(img/x.jpg). easy2edit reads background pictures, overlays, padding, min-height, border-radius, shadows, widths and gaps straight from these rules: keep the real values in the css, never in the html.
- Icons and meta: keep <link rel="icon"> / apple-touch-icon (files in img/), <meta name="theme-color"> and og:image; the logo in the header is read as the logo of the site (a separate dark-mode logo: name it logo-dark.png). Typography in rem (body 1rem/1.6; h1 2.6-3.4rem; h2 1.8-2.2rem; h3 1.2-1.4rem); buttons padding .75rem 1.4rem, border-radius 10px, weight 600. Square corners stay square: write border-radius: 0 where the design has none.
- Responsive from 360 px to 1600 px; columns become one column on a phone.

## 4. Modules and live system objects of easy2edit
easy2edit has modules (showcase, webshop, FAQ, agenda, documents, marketplace, games, ...) with ready-made LIVE blocks that the system fills with real data. Where the design shows a part that such a block can do (a project overview, a product overview, a cart, a checkout, an agenda, a document list, ...), replace the made-up content with the block, written EXACTLY as an empty element on its own line directly inside the container, after the heading and a short intro:
  <div data-sysobject="SLUG"></div>
- Never inside <p>, <a>, <details>, a card or a column with other items; no content, classes or styling. Use each block once, where it fits best. Do not redraw what the block shows.
- ALSO keep the design of that part, so the live block gets the same look: directly after the live element add
  <div class="showcase-design" data-sysobject-design="SLUG" data-layout="scroller"> ... the made-up example ... </div>
  (class name: showcase-design, webshop-design, ... any). The importer uses it as the DESIGN of the live block and drops its content; style it in style.css like the live block should look. Put a comment before it: <!-- design of SLUG, not content -->.
- Showcase example cards become REAL projects: inside the design element give every example a <div class="card pc"> with <div class="pimg"><img src="img/x.jpg" alt="..."><span class="st st-active"><i></i>Online</span></div> (status class st-active, st-development or st-offline) and <div class="pb"><h3>Title</h3><p>Short text</p><div class="meta"><span>Group</span><span>5 weeks</span></div><div class="tags"><span class="tg">Tag</span></div></div>. Use real, fitting pictures from img/ (also listed in the ZIP) for these cards.
- Modules without example content are filled with demo content by the importer, so never make up fake data outside a design element.
${live.length ? `The blocks that exist in this system now (slug: name, kind):\n${live.map((o) => `- ${o.slug}: ${o.name} (${o.kind_label})`).join("\n")}\n` : "Use the slugs that easy2edit shows under Website ontwerpen > AI creator > Systeemobjecten."}
Links of the system you may use: / (home), /login, /registreren, /dashboard, /faq, /producten, /winkelwagen, /privacy, /cookies. Never build your own login, registration, cart or checkout.
${componentsText ? "\n" + componentsText : ""}

## 5. SEO
Every page: a unique <title> (max 60 characters) and <meta name="description"> (max 155), <html lang="...">, one <h1>, alt texts on every picture; the start page has og:image (img/og.jpg, 1200x630).

${extra.length ? `## 6. Translations
Write the pages in the main language (${mainCode}) only; easy2edit translates. If you can, add per extra language (${extra.map((l) => `${l.native || l.name} (${l.code})`).join(", ")}) a file vertalingen-<code>.json: {"formaat": "easy2edit-vertalingen/1", "bron": "${mainCode}", "doel": "<code>", "paginas": {"index.html": [{"element": "h1", "${mainCode}": "<text exactly as in the html>", "<code>": "<translation>"}, ...]}}. element is one of title, meta description, og:title, og:description, h1, h2, h3, p, li, summary, link, alt, aria-label; one item per text in page order; copy source text exactly, keep inline html (em, strong, a, br) in place.

` : ""}${completeness(extra.length ? 7 : 6)}
## ${extra.length ? 8 : 7}. Check BEFORE you deliver
- Render every page (canvas, preview or headless browser) at 1440, 820 and 390 px and compare it with the original: same colours, sizes, spacing, rounded and square corners, shadows, round badges, heading colours. Fix every difference, look again, repeat.
- Check: one container per section, one h1 per page, header/footer identical on every page, every nav link and image reference resolves to a file with the exact same name, style.css linked in every html file, no unused files, no placeholders, no inline styles, dark mode readable.
- Unzip the ZIP and test it: index.html at the top level, all html files, style.css, img/ and screenshots/ present, opening index.html straight from the folder works.
- In your last message tell me in a few lines what you changed to make it importable, which live blocks (data-sysobject) you placed where, and anything you could not convert.

## ${extra.length ? 9 : 8}. How I use it
I upload the ZIP at Website ontwerpen (tab ZIP-bestand). easy2edit rebuilds the pages, sets the theme and the menu from the header, puts the pictures in the media library, turns the data-sysobject elements into live blocks, creates real showcase projects from the example cards and demo content for empty modules.`;
}
