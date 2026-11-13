// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Builds the prompt that the user gives to an AI (ChatGPT, Claude, Gemini...) so that the AI makes a website that Easy2edit can import
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
export function buildPrompt({ name, kind, lang, pages, style, colors, extra, modules = [], objects = [], palette = null, font = "", radius = null, theme = "", photos = [], colorMode = "light", languages = null, rules = null }) {
  const RL = { max_pages: 12, max_images: 40, max_image_mb: 5, name_max: 40, ...(rules || {}) }; // the numbers of the importer (served by /sitecreator/catalog/)
  const mainLang = (languages && languages.main) || lang || "Dutch";
  const extraLangs = (languages && languages.extra) || [];
  const mainCode = (languages && languages.mainCode) || "nl"; // language code of the main language of the site
  const n = (name || "").trim() || "[name of the website]";
  const pg = (pages || "").trim() || "Home, About, Services, FAQ, Contact";
  const list = pg.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const files = list.map((p, i) => (i === 0 ? "index.html" : `${p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page" + (i + 1)}.html`));
  return `You are a senior web designer. Create a complete, professional website for "${n}" as plain static files that can be imported into the website system Easy2edit. Follow every rule below exactly: the importer reads the html and css and rebuilds each page with the blocks of the Easy2edit page editor, so a clean, predictable structure is more important than clever tricks.

## 1. The website
- Type: ${KIND_HINT[kind] || KIND_HINT.company}.
- Language of all texts: ${lang || "Dutch"}. Write real, convincing copy (no "lorem ipsum"), with concrete headings, short paragraphs and clear calls to action.
- Pages (one html file each, in this order): ${list.map((p, i) => `${p} (${files[i]})`).join(", ")}.
- Style: ${(style || "").trim() || "modern, clean, lots of white space, friendly and professional"}.${theme ? `\n- Base the look on the theme "${theme}" of the Easy2edit system: its colours and rounded corners are given below.` : ""}
- Colours: ${palette ? `use EXACTLY these as css variables on :root and nowhere else: ${[["primary", "--primary"], ["secondary", "--secondary"], ["bg", "--bg"], ["card", "--card"], ["text", "--text"], ["dark", "--dark-band"]].filter(([k]) => palette[k]).map(([k, v]) => `${v}: ${palette[k]}`).join("; ")}. --primary is the colour of buttons and links, --secondary the accent, --bg the page background, --card the background of cards, --text the text colour, --dark-band the background of the dark bands (hero, call to action, footer; text on it is light). Derive --line (borders) from --text. Keep text contrast at least 4.5:1.` : (colors || "").trim() || "choose one strong primary colour, one secondary colour, a light background and a dark text colour"}${palette ? `\n- Display: ${colorMode === "dark" ? `dark only: use --bg: ${palette.dbg}; --card: ${palette.dcard}; --text: ${palette.dtext} as the values on :root instead of the light ones.` : colorMode === "both" ? `light AND dark. The colours above are the light mode on :root. The dark mode: --bg: ${palette.dbg}; --card: ${palette.dcard}; --text: ${palette.dtext} (same --primary, --secondary and --dark-band) in :root[data-theme="dark"] { ... } and in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }. Easy2edit adds its own light/dark switch.` : "light only."}` : ""}${languages && languages.extra.length ? `\n- Languages: main language ${languages.main || lang}. Other languages of the website: ${languages.extra.map((l) => `${l.native} (${l.code}${l.rtl ? ", right-to-left" : ""})`).join(", ")}. Write the pages in the main language only; the system translates them${languages.switcher ? " and adds the language switch to the header: leave room for it" : " (no language switch in the header)"}.` : ""}${font ? `\n- Font: ${font} (system fonts only).` : ""}${radius !== null && radius !== "" ? `\n- Corners: cards ${radius}px, buttons ${Math.max(0, radius - 4)}px, pictures ${Math.max(0, radius - 4)}px.` : ""}${photos.length ? `\n- PHOTOS that I already have (use them, they are the real pictures of this website): reference each as img/<file> in <img> tags and as url(img/<file>) in the css, with a fitting alt text, width and height; put the best ones in the hero and in the sections where their description fits. Do NOT create, copy or include these files in the ZIP: the system adds them when the ZIP is imported.\n${photos.map((p) => `  - ${p.file}: ${p.note || "no description"}`).join("\n")}` : ""}${extra && extra.trim() ? `\n- Extra wishes: ${extra.trim()}` : ""}

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
- SCREENSHOTS (strongly recommended): when you can render your pages (in your design canvas or with a headless browser), add a folder ${RL.screenshot_folder || "screenshots"}/ with ONE full-page desktop screenshot per page, 1440 px wide, named after the html file: index.png for index.html, over-ons.png for over-ons.html (png, jpg or webp, each at most 6 MB, at most ${RL.max_screenshots || 24}). Make them from the FINAL result, after you have corrected it. Easy2edit uses them as the reference to rebuild the layout, backgrounds, colours and spacing as exactly as possible. No mobile screenshots are needed. If you cannot create image files yourself, use clearly named placeholders in img/ and add a list at the end: for every picture the file name, the size in pixels and a one-line description (or an image prompt) so I can add them myself.
- Do NOT use JavaScript for content or layout (no sliders, tabs or accordions built with scripts). No external fonts or scripts: use a system font stack (system-ui, -apple-system, "Segoe UI", Roboto, sans-serif), or one font that you describe in the notes. One html file at most 2 MB.
- Use relative links between the pages (href="about.html"), "#section-id" for links to a place on the same page, and normal https:// addresses for external links.

## 3. Structure of every page (this is what makes it editable in Easy2edit)
- <body> contains, in this order: one <header> (logo/name, <nav> with links, optionally one button), one <main>, one <footer>. Easy2edit uses its own header and footer, so keep these simple: brand, 3-6 links, an optional button; footer with short text and links.
- <main> consists ONLY of full-width <section> elements, one per band of the page, each with a clear id ("hero", "services", "faq", "contact"). Never put a card or box around a whole section; the background colour of the band goes on the <section> itself, edge to edge.
- Inside a section put ONE centred container: <div class="container"> with max-width 1100px, margin 0 auto, padding 0 1.25rem. Use the same container on every page.
- Vertical rhythm: every section has padding 4rem 0 (hero 6rem 0), alternating light and tinted or dark background so the bands are easy to tell apart.
- Content inside a section is built from these elements only, because these map one to one to the blocks of the page editor: (columns, cards and the hero are described under "Design guidelines" below)
  - Headings: <h1> (once per page, in the hero), <h2> for a section title, <h3> for a card title. Never skip a level.
  - Light/dark mode: follow the "Display" line of section 1. Easy2edit sets data-theme on <html> and shows its own light/dark switch: never build a switch and never use JavaScript for it. The colour rules are in the line "Every colour is a real value" below.
  - Languages: write every html page in the main language (${mainLang}) only. Never one html file per language and no language switch of your own: Easy2edit adds the switch. Leave room at the right of the header for the language switch, let menu items and buttons grow with longer words (min-width, no fixed widths on text), and when a right-to-left language (ar, he, fa, ur) is among the languages use logical css properties (margin-inline, padding-inline, text-align: start, inset-inline) so the layout mirrors correctly.
  - Text: <p>, <ul>/<ol> with <li>, <strong>, <em>, <a>: this simple html formatting stays in the texts (they become editable rich text in the page editor). No <br> layout tricks.
  - Pictures: a plain <img> (optionally inside <figure>). Background pictures: only on a <section> via css (background-image: url(img/x.jpg)) with an overlay colour if text sits on it.
  - Buttons: <a class="btn btn-primary" href="..."> and <a class="btn btn-outline" href="...">. Never <button> without a link, never a <form> (contact goes to a mailto: link, a phone link or a link to the Contact page; forms are added later with the system's own modules).
  - Spacing and dividers: use margins/padding and <hr>.
  - Frequently asked questions: ONE section with id="faq" and for each question <details><summary>Question?</summary><p>Answer.</p></details>. They are moved into the FAQ module of the system.
  - Prices or products (webshop): <div class="product"> cards with picture, <h3> name, a <p class="price">€ 19,95</p> and a button. The importer then switches on the web shop module.
  - Events: <article class="event"> with <h3>, date, place and a short text (switches on the agenda module).
  - Icons: use simple inline <svg> only when needed, single colour (stroke="currentColor"), never emoji or coloured icons. The importer leaves icons and emoji out, so never let them carry the meaning: use words or numbers.
- Every colour is a real value. Define them once as css variables on :root (--primary, --secondary, --bg, --text, --card, --line) and use them everywhere; no hard-coded colours in rules (svg illustrations use currentColor or the variables), also not in the dark mode. Text on pictures and on dark bands has its own colour with a contrast of at least 4.5:1 in every mode.
- Typography in rem: body 1rem/1.6, h1 2.6-3.4rem, h2 1.8-2.2rem, h3 1.2-1.4rem. Buttons: padding .75rem 1.4rem, border-radius 10px, font-weight 600.
- Responsive and accessible: it must look right from 360 px to 1600 px wide; sufficient contrast; one <h1> per page; alt texts; descriptive link texts (no "click here").

## Design guidelines: what the Easy2edit page editor can build
The importer turns every <section> into a BAND of the page editor and its content into the blocks below. Design with exactly these possibilities, then the page looks the same after the import and stays editable. Stay inside them; clever css that has no block ends up as a code block, which is harder to edit.
- Band (one <section>): full width, with its own background colour, or a background picture with an overlay (0-90 %) so text stays readable, a text colour for that band, padding top and bottom, optional rounded corners and an optional minimum height. Bands alternate (light, tinted, dark) and run edge to edge; the content sits in one centred container (max 1100px).
- Hero (the first band of a page): a full-width band with a background picture or a strong colour and an overlay. Give it a clear height in css only when you want one (min-height in vh/svh, for example 70svh); otherwise use padding (6rem 0). Content in this order: a small label above the heading (a text with its own background, like a pill), ONE <h1>, a short paragraph, one or two buttons, and small notes or trust lines below them. Choose one of two layouts: text centred in one column, or two cells (50/50 or 55/45) with the text left and a picture or a card right, both vertically centred. Every page has a hero or at least a heading band.
- Cells: a band holds 1 to 4 cells side by side (widths 25, 33, 50, 66 or 75 %). Each cell aligns its content left, centre or right and top, centre or bottom. More than 4 items: make a second row. Cells become one column on a phone.
- Cards: a cell can be a card with its own background, rounded corners, inner padding, a 1px border and/or a shadow. Use cards for services, steps, prices, plans, testimonials and preview boxes; every card in a row has the same height. Never put a card around a whole band.
- Blocks inside a cell (use only these): heading (size, weight 400-800, colour, alignment), text (p, ul, ol, li, strong, em, a, br; optionally as a label with its own background), image (width 100 %, 50 % or a fixed px width, rounded corners), button (primary, outline or ghost, with a link to a page, a #section or an https address), spacer (a height), line (a divider), FAQ (see below), system object (see below). Anything else (a progress bar, a list with check marks or icons, a mock-up, a table, a gradient shape, an inline svg) becomes a code block: use it sparingly and keep it self-contained (no script, no external files).
- Pictures: every picture is a plain <img> (or a section background); give a hero picture at least 1600 px width, cards 800 px, and every picture an alt text. Keep important content out of the picture itself.

${extraLangs.length ? `## Translations (one file per extra language)
${extraLangs.map((l) => `- Add a translation file vertalingen-${l.code}.json at the top level of the ZIP with the ${l.native} translation of EVERY text of every page.`).join("\n")}
- Format of a translation file (UTF-8, valid JSON):
  {"formaat": "easy2edit-vertalingen/1", "bron": "${mainCode}", "doel": "<code>",
   "paginas": {"index.html": [{"element": "h1", "${mainCode}": "<text exactly as in the html>", "<code>": "<translation>"}, ...], ...}}
  The keys of an item are "element", the code of the main language (${mainCode}) and the code of the target language (the same as "doel"). "element" is one of: title, meta description, og:title, og:description, h1, h2, h3, p, li, summary, link, alt, aria-label.
- One item per text, in the order of the page: the <title>, the meta description, og:title, og:description, every h1, h2, h3, p, li, summary, every link and button text, every alt text and every aria-label. Copy the source text EXACTLY as it is in the html, including simple inline html (em, strong, a, br) and entities; keep that html in the same place in the translation. In a translation only p, ul, ol, li, strong, em, a and br are allowed as html. Translate naturally for the target audience; keep prices, numbers, product names and brand names, and use the number format of the target language (€ 30.95).

` : ""}## 4. SEO
- Every page has a unique <title> (max 60 characters) and <meta name="description"> (max 155 characters).
- Include an Open Graph image (og:image, img/og.jpg, 1200x630) on the start page.

${modules.length || objects.length ? `## 5. Modules and system objects of Easy2edit
Easy2edit has modules (webshop, FAQ, community, agenda, ...) and system objects: ready-made, LIVE blocks that the system fills with real data (a product overview, an agenda, a subscription plan, a donation button, ...). Design the pages so that they work with the modules below, and place the system objects exactly as explained.
${modules.length ? `
Modules this website uses (what the pages must do for each):
${modules.map((m) => `- ${m.label}: ${m.how}`).join("\n")}
` : ""}${objects.length ? `
System objects to place on the pages. A system object is an EMPTY element on its own line, written exactly like this (SLUG as given):
  <div data-sysobject="SLUG"></div>
Rules for placing them:
- Put it directly inside the <div class="container"> of the section where it belongs, after the section heading and a short intro text. Give that section an id and make it a normal full-width band.
- Never put it inside <p>, <a>, <details>, a card or a column that has other items; never give it content, classes or styling: Easy2edit fills it with the live content (the importer turns it into a system-object block of the page editor).
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
- The end result MUST be a single downloadable ZIP file, named "${n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website"}.zip", that I can upload directly in Easy2edit (Website ontwerpen, tab ZIP-bestand). Do not give me loose code blocks as the final answer.
- The ZIP MUST contain, at the top level: the html files ${files.join(", ")} (all of them) AND style.css (the css file, never missing and never empty), ${extraLangs.length ? `the translation files ${extraLangs.map((l) => `vertalingen-${l.code}.json`).join(", ")}, ` : ""}and the folder img/ with the pictures that you made, and the folder ${RL.screenshot_folder || "screenshots"}/ with a screenshot per page${photos.length ? " (not the photos listed in section 1)" : ""}. index.html MUST be at the top level of the ZIP (or inside one single top-level folder), never deeper, and every path in the html and css must be relative to it so the site works when you open index.html straight from the unzipped folder.
- Create the actual files and the ZIP yourself with your code/file tools (for example Python zipfile) and give me the download link. Generate or fetch the pictures as real files in img/ when you can (royalty-free or generated images, each at most 5 MB). Test the ZIP before you hand it over: unzip it, check that all the html files and style.css are in it, that every html file links style.css, that index.html exists, that every html file, link and image reference resolves, and that there are no missing files.
- If you cannot create a ZIP or files, then give every file complete in its own code block with the file name above it (style.css first, then ${files.join(", then ")}), plus a short Python or shell script that builds the ZIP from those files, and the list of pictures I still have to add (file name, size in pixels, one-line description). Never shorten or write "the rest is the same".
- Finish with one short line per page saying what it is for, and the list of modules the site needs (web shop, FAQ, agenda, ...) if any.

## ${modules.length || objects.length ? 8 : 7}. How I will use it
I upload the ZIP in Easy2edit at Website ontwerpen (tab ZIP-bestand). Easy2edit takes the colours and shapes as a theme, puts the pictures in the media library, turns every section into editable rows and blocks of the page editor (the system objects become live blocks), and switches on the modules the content needs. Nothing else is needed from you.`;
}
