# Writes the manual of Easy2edit (MANUAL_LANG=en or nl) with the AI (chapter by chapter, from facts of the system) and makes manuals/pdf/manual_en.pdf and manuals/html/en/.
#   cd backend && python manage.py shell -c "exec(open('../manuals/tools/make_manual.py').read())"          (MANUAL_REUSE=1: use the texts of manuals/src/chapters_en.json, no AI)
# The screenshots (manuals/html/en/images, made by manuals/tools/screenshots.mjs from manuals/tools/shots.json) are placed in the chapters, spread over the sections.
import io, json, os, re, sys
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from apps.core import modules
from apps.integrations import ai

ROOT = Path(settings.BASE_DIR).parent
LANG = os.environ.get("MANUAL_LANG", "en")
OTHER = "nl" if LANG == "en" else "en"
UI = {
    "en": {"manual": "Manual", "title": "Easy2edit manual", "contents": "Contents", "version": "Version", "build": "build", "figure": "Figure", "on_page": "On this page", "prev": "Previous", "next": "Next", "search": "Search chapters",
           "chapter": "Chapter", "lang_name": "English", "hero": "Everything you need to build, manage and grow your website, shop or community with Easy2edit. Pick a chapter, or use the search above.", "video": "Video",
           "voice": "English voice-over", "also": "also in", "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], "permalink": "Link to this section"},
    "nl": {"manual": "Handleiding", "title": "Easy2edit handleiding", "contents": "Inhoud", "version": "Versie", "build": "build", "figure": "Afbeelding", "on_page": "Op deze pagina", "prev": "Vorige", "next": "Volgende", "search": "Zoek in hoofdstukken",
           "chapter": "Hoofdstuk", "lang_name": "Nederlands", "hero": "Alles wat je nodig hebt om je website, webwinkel of community met Easy2edit te bouwen, te beheren en te laten groeien. Kies een hoofdstuk, of gebruik de zoekbalk hierboven.", "video": "Video",
           "voice": "Nederlandse voice-over", "also": "ook in", "months": ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"], "permalink": "Link naar dit onderdeel"},
}[LANG]
IMG = ROOT / "manuals" / "html" / LANG / "images"
SHOTS = json.loads((ROOT / "manuals" / "tools" / "shots.json").read_text())
CAPN = ROOT / "manuals" / "src" / "captions_nl.json"
CAPS_NL = json.loads(CAPN.read_text()) if CAPN.is_file() else {}


def chapter_shots(n):
    """The screenshots of chapter n that exist, in the order of shots.json: [(file, caption)]."""
    return [(s["file"], (CAPS_NL.get(s["id"]) or s["caption"]) if LANG == "nl" else s["caption"]) for s in SHOTS if s.get("chapter") == n and (IMG / f"{s['file']}.jpg").is_file()]


_UI_EN = ({"videos": "Videos", "vsearch": "Search the manual and the videos", "vhero": "Short instruction videos with voice-over. Search by title or by what is said in the video.", "vnone": "No video found.", "tochapter": "Read chapter"})
_UI_NL = ({"videos": "Video's", "vsearch": "Zoek in handleiding en video's", "vhero": "Korte instructievideo's met voice-over. Zoek op titel of op wat er in de video wordt gezegd.", "vnone": "Geen video gevonden.", "tochapter": "Lees hoofdstuk"})
UI.update(_UI_NL if LANG == "nl" else _UI_EN)
VIDEOS = json.loads((ROOT / "manuals" / "tools" / "video" / "videos.json").read_text()) if (ROOT / "manuals" / "tools" / "video" / "videos.json").is_file() else []
VID = ROOT / "manuals" / "video"


def chapter_videos(n):
    """The instruction videos of chapter n that have been made: [(id, title in English, title in Dutch, has Dutch)]."""
    return [(v["id"], v["title"]["en"], v["title"]["nl"], (VID / "nl" / f"{v['id']}.mp4").is_file()) for v in VIDEOS if v.get("chapter") == n and (VID / "en" / f"{v['id']}.mp4").is_file()]


def split_sections(text):
    """[(heading or "", body)]: the text before the first ## and then every section."""
    parts = re.split(r"(?m)^## (.*)$", text.strip())
    out = [("", parts[0].strip())]
    for i in range(1, len(parts), 2):
        out.append((parts[i].strip(), parts[i + 1].strip()))
    return out


def spread(n_sections, n_images):
    """After which section each image comes (spread over the sections; the rest after the last one)."""
    return [min(i, n_sections - 1) for i in range(n_images)]
BUILD = (ROOT / "backend" / "BUILD").read_text().strip()
VERSION = (ROOT / "backend" / "VERSION").read_text().strip() if (ROOT / "backend" / "VERSION").is_file() else "1.0.0"

mods = [m for m in modules.MODULES]
def mod_lines(keys=None, groups=None):
    return "\n".join(f"- {m['label']} ({m['key']}): {m['desc']}" for m in mods if (not keys or m['key'] in keys) and (not groups or m['group'] in groups))
plug = {}
for p in sorted((ROOT / "plugins").glob("*/plugin.json")):
    d = json.loads(p.read_text())
    plug[d["name"]] = f"- {d.get('title')}: {d.get('description','')}"
def plugs(*names): return "\n".join(plug[n] for n in names if n in plug)

CHAPTERS = [
 ("Introduction", """Easy2edit is a simple, modular management system (CMS) for portals, websites, webshops and communities. A Django (REST) backend and a Next.js frontend. You build a website from blocks and switch modules and plugins on or off.
Three kinds of people: users (visitors with an account), admins (manage parts of the site; their rights come from roles), and superadmins (the owner/reseller: everything, including system settings, modules, plugins, prices, licence).
The dashboard has the areas Dashboard (own profile, notifications, own AI credit), Admin (management) and Super admin (system). Modules are parts of the system that can be switched on or off (Super admin > Modules); plugins are signed extension packages (Admin > Plugins) that bring their own pages and modules.
Standard installations: one click sets the modules, plugins and theme for a type of website (standard website, web shop, company website, business network, intranet, dating platform, sports club, foundation, marketplace, game hall). Each installation has a small tile with a settings pop-up (visible in the admin, offered at first installation, AI credit settings, modules, demo data).
The header shows the language switcher, the edit-mode switch (pencil), light/dark mode and the user menu.
Help: on every page of the Admin and Super admin areas there is a Help button (question mark icon, next to the back button) that opens this manual in a pop-up at the chapter that belongs to the page. On the Admin start page, under About Easy2edit, two big buttons give the HTML manual (open it in a pop-up or in a new tab) and the PDF download. The manual is in English."""),
 ("Getting started", f"""First login: log in as superadmin. When the site runs on your own computer (localhost) the very first question is whether to switch the sandbox on (payments, e-mail, sms and the tests of the API links are then only simulated, so nothing real is sent or charged, even with live keys); the answer is remembered and the sandbox can be changed later at Admin > Sandbox. Then, if nothing is installed yet, a pop-up offers a standard installation with two tabs: Installation, and Filling with AI (explains that the website can be filled with AI: import a website, translate, improve with an instruction; shows whether an AI link exists). After an installation has been set, the system asks whether you want to use AI to fill the site; choosing yes goes straight to buying AI credit. A welcome pop-up explains the AI credit and lets the superadmin put the credit settings in place (see the AI chapter).
Set the basics at Admin > System (site name, company data, contact data, addresses). Choose a standard installation (Super admin overview or Admin > Standard installations). Choose a theme and logos at Admin > Theme / Logos & images. Choose the languages at Admin > Languages. Create users and roles at Admin > Users and Roles.
Modules (all): 
{mod_lines()}"""),
 ("Pages, menu and edit mode", """Pages and menu (Admin > Pages): system pages (Home, products, ...), own pages (text pages at /p/<key>), links and menu items. Per page: names per language (with AI translation to all languages), address per language, who may see it (everybody, logged-in users, guests, or specific users/groups), show in the header menu, open in new tab, devices (desktop/tablet/mobile), page-specific theme/header/footer, SEO per language and a background (image or video).
Edit mode: switch on the pencil in the header. Pages are built from rows (blocks); each row has cells (1 to 4 columns) with items. Items: heading, text (rich), image, button, spacer, line, system objects, ready-made parts (contact data, social media, map, video, quote, figures, logo, opening hours) and the part 'HTML / CSS code'.
Row settings (the gear in the corner): background colour/image/video, overlay, padding, width (column, wide, full screen), hero height, text colour, rounded corners, space above. Cell settings: width, alignment, card style (background, border, radius, shadow). Texts: style, size, colour, font, padding, background (label/pill). Buttons: label per language, link, style (primary/outline/ghost), colours, size, icon.
The part 'HTML / CSS code': a large pop-up with three tabs (Visual, HTML, CSS). In Visual you click in the text and type (what you see is what you get) with a toolbar (bold, italic, underline, list, link, clear formatting) and a light/dark background switch. The code runs in a sandboxed frame without any rights on the site.
System objects (Admin > System objects, module must be on): donation buttons, subscriptions, media views, plugin parts and (superadmin) AI dashboard blocks; they can be placed in edit mode under + Add > System objects.
Pages that were taken over 1 to 1 from an HTML file (see Site import) show a pencil at every text and button in edit mode: click, then change the text in an editor that shows it as on the page (with bold/italic/underline/link) and the link of a button; Save writes it in the page."""),
 ("Importing a website (Site import)", """Admin > Imported (the button is called 'Site import' until a site has been imported, then 'Imported'). Drop one or more HTML files (or give an address, folder or ZIP). The AI reads them and makes a proposal: theme (colours, fonts, radius, content width), pages, content, icons and images (put in the media library with tag 'import') and which modules are needed (for example the FAQ module for question lists). Nothing is created before you approve.
After approval the theme is installed and put to use. Then 'Apply': a pop-up/panel with tabs Pages, Links, Buttons, Header, Footer, Theme.
Pages: drag and drop two columns (pages from the file on the left, pages of your website on the right) to link a file to an existing page (for example Home) or leave it as own page. Choose the view: 'Exact' (the page looks exactly like the HTML file; texts and buttons can still be edited with the pencil in edit mode) or 'Editable' (the AI rebuilds the page with the blocks of the page builder; cards, label pills, band colours, rows and hero are rebuilt; things the blocks cannot make (progress bar, check lists, preview cards) become an 'HTML / CSS code' block). Give an optional instruction for the AI (for example 'make the headings bigger'). Choose what happens with the content already on the page (clear first, replace the blocks of this import only, or add below) and whether the pages are translated to the other languages.
Links and Buttons: link links and buttons of the file to pages or parts of your website (drag and drop). Header: switch the header of the system to the header of the file (bigger menu with the links and buttons of the file). Footer: show the footer of the system under the pages. Theme: adjust colours, default mode, content width and roundings.
Progress is shown in a pop-up with percentage; when ready a button 'Go to page' appears. The original HTML is kept so you can apply again with a new instruction. Each import shows a status (Pending / Active). The list of pages of an import has per page: name, in menu, visible, view. In Pages > page settings an imported page has a tab 'Import': an instruction for the AI and a button to rebuild only this page from the original.
Removing an import puts back the theme and the content that was on the pages (or advises to re-install via the superadmin), and removes what the import made. The standard home page (logo, title, text, photos) is always empty and overwritten by an import so it never shows behind the imported page."""),
 ("Media, theme, languages and branding", f"""{mod_lines(['media','branding','theme','languages'])}
Media library: all images and videos, local or on S3, with tags; pictures can be chosen in every pop-up. Theme (Admin > Theme): colours for light and dark mode, fonts, roundings, content width, header layout (including the editorial layout with side menu), pop-up style, theme packs that you switch with one click, and export/import of themes. Logos & images: logo (light/dark), favicon, app icon and the photos of the home page. Languages: choose the languages the website offers, the default language, and translate texts with the AI. Texts of the system itself exist in 44 languages."""),
 ("Users, roles and security", f"""{mod_lines(['users','roles','dashboard','security_basic','geo','age_gate','gambling','cookies','word_filter'])}
Users: accounts, profile photo, blocking, roles. User groups: groups of users with roles and module access. Roles: sets of rights (for example 'Content manager', 'Moderator', 'View AI use of users'); superadmins have all rights. Rights open parts of the admin area; a module can also be given per user or group (Super admin > Modules, the person icon).
Security: login lock, session time, password rules, security headers, two-step verification, country control (IP), age check and gambling pop-up, cookie banner and policy, forbidden words."""),
 ("Shop, orders, payments, subscriptions and donations", f"""{plugs('webshop','orders','finance','subscriptions')}
Webshop: products and groups, variants (colour, size) with own prices, shipping methods, discount codes, layouts (standard, editorial with filter side panel and large product photo, 'shop the look'), styles and presets. Orders: order management, VAT, order status, documents (packing slip, invoice, return slip, credit invoice). Finance: payment methods and terms, links to Stripe and Mollie, company data and document layout. Payments are made through Stripe or Mollie; the sandbox simulates them. Subscriptions give access to parts of the site (pages, content, chat, video, likes, services), once or repeated, with an order per period; donations are gifts with a slider from a minimum to a maximum."""),
 ("Community, marketplace, agenda, documents and games", f"""{plugs('community','profile-themes','marketplace','agenda','documents','games','age-gates')}
{mod_lines(groups=['Community'])}"""),
 ("SEO, FAQ and statistics", f"""{plugs('seo','faq','statistics')}
SEO: robots.txt, sitemap, llms.txt, page titles, descriptions and structured data, also for AI agents. FAQ: own questions and answers in all languages on /faq; questions found in an imported site are put in this module. Statistics: visitors, SEO, bots, AI calls and per module and plugin a section; widgets with charts."""),
 ("AI and AI credit", """The AI (Claude, Anthropic) is used for translating, writing page texts, importing websites, price research and more. Every call to the AI is monitored: who asked (user, admin, superadmin or the system), from which part of the system, which model, tokens in and out, duration, whether it worked, and what it cost.
The module 'AI' is a core module that is on as soon as an AI link (API key) is installed and enabled. AI links: Admin > API keys. A link can be marked 'Superadmin link': then only superadmins see and change it (for example the Easy2edit AI link and Stripe link of the reseller). AI calls of users and admins always run on an Easy2edit link of the superadmin when there is one.
Super admin > AI (dashboard) has the tabs Overview (key figures, cost over time per group, share per group, last calls), Where (where AI is used most, what costs most, tasks, models, busy hours and weekdays), Users (heavy users, highest costs, table per user with a PDF button per row), Costs (per month or week, per group and per user), Credit, Blocks and Settings. Filters: period, month (this month and the twelve before) and group; the PDF button makes a summary or, with 'Detailed', a complete list of every call with tokens in and out, duration and costs.
Costs: purchase prices per million tokens per model (tabs Claude, OpenAI, Gemini, with the models that are active in the API; 'Refresh models' also looks up the prices with the AI) in the purchase currency (for example USD); sale prices in the selling currency (for example EUR) with a rate that can be updated with a button using the AI. Three margins (in percent, separately for tokens in and tokens out): users, admins and reseller/superadmin. A switch says whether the use of superadmins and the system is also charged to the customer: then it is booked on a group named after the website, with the reseller margin; otherwise it is a cost of the reseller without margin and shown separately. Prices, rate and margin are stored per call, so changes only count for new calls. Only superadmins change the AI settings of the system.
AI credit: users and admins must buy AI credit before they can use AI (the switch is on by default; superadmins and the system need none). Before every AI call the cost is estimated and checked against the credit; if it is not enough nothing is sent and a message says what is needed. After the call the real amount is deducted. A user with little credit gets a pop-up with a slider (minimum to 25, 50 or 100, based on the use of the last 30 days) and a suggestion. Paying always goes through Stripe with an Easy2edit link of the superadmin (never the Stripe of the website's own shop); the credit is added once the payment is paid (confirmed when the customer returns and again when the AI screen opens). The superadmin sets the amounts and can add or deduct credit per user (Super admin > AI > Credit). Every admin sees a welcome pop-up at the first login explaining all this. On a computer where the sandbox is on, AI credit is never paid with a real payment but through the simulated payment page. Each standard installation has an AI tab with: AI belongs to this installation, credit required, and the smallest and biggest top-up amount.
Admins: Admin > AI shows the use of users and admins (no purchase prices, no margin, no costs of the reseller), a block 'AI use' on the Admin start page with own credit, a table per user and a PDF per user (a report without purchase prices). An admin needs the right 'View AI use of users' (Roles). An admin who has his own AI link (Anthropic) and his own Stripe link, both not marked as superadmin links, can switch on his own credit system for his users (Admin > AI > Credit for users): his users then use his AI, pay through his Stripe and the margin is his; he sets the credit rules, the amounts and the margin and can add credit per user.
AI blocks: parts of the AI dashboard (key figures, costs over time, use per group, where AI is used, heavy users, highest costs, models, busy hours) can be switched on as system objects (Super admin > AI > Blocks) and placed on a page in edit mode; only superadmins see the figures."""),
 ("Plugins, backups, licence and deployment", f"""{plugs('seo','siteimport','statistics')}
Plugins (Admin > Plugins): signed packages in /plugins; install from the library (resource/plugins), switch on/off, update. A plugin brings its own pages, modules, translations (44 languages) and admin screens. The module API keys is always on in every standard installation, and the links of the superadmin (AI, Stripe, mail, storage) are switched on when an installation is set, so they keep working; the secret keys themselves are never put in the installations file. A link marked Superadmin link is only seen and changed by superadmins. Resetting the system (Super admin > System > Reset) asks whether the AI data in the database must be removed too (all AI calls with costs, and the credit history and credit of the superadmins; the AI settings stay); the credit of normal users disappears with the users anyway. Backups (Admin > Backups): backups per day, week or month of pages, menus, texts, images, theme and the settings of modules and plugins; restore and download. The standard installations basis (installations.json) is part of the system; secret keys are never put in it.
Licence (Admin > Licence): costs and payment method of the licence (Stripe or invoice); the price follows the modules and plugins that are on. Super admin > Prices: the price list per month, quarter and year, quotations as PDF, marketing tiles, sales calculation. Deployment: Docker (development and production compose files), reverse proxy and certificates; the backend runs migrations on start. Each installation shows 'Easy2edit version 1.0.0 build X' from one central place (backend/BUILD)."""),
]

SYS = ("You write chapters of the user manual of Easy2edit, a modular CMS/portal system. Write clear, friendly, accurate English for administrators and website owners. "
       "Use ONLY the facts you are given; never invent screens, buttons or features. Use menu paths like 'Admin > Pages'. "
       "Format: plain text. Use '## ' for subheadings, normal paragraphs separated by blank lines, and '- ' for bullet lists, and '1. ' for steps. No markdown bold or tables, no emoji, no arrows (use '>'). Do not repeat the chapter title.")

def write(title, facts, n):
    prompt = f"Chapter {n}: {title}\n\nFacts:\n{facts}\n\nWrite the chapter (about 500 to 900 words), organised with subheadings, short paragraphs and lists, with practical steps where it helps."
    return ai.claude(SYS, prompt, max_tokens=3500, timeout=170)

def clean(t):
    t = t.replace("→", ">").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("•", "-").replace(" ", " ")
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"(?m)^# .*[\r\n]+", "", t)  # a chapter title that the AI repeated
    return t.encode("latin-1", "replace").decode("latin-1")

SRC = ROOT / "manuals" / "src" / f"chapters_{LANG}.json"
EN_SRC = ROOT / "manuals" / "src" / "chapters_en.json"

def glossary(text):
    """The names of the screens and buttons in the Dutch interface, for the words that stand in this English text (so the Dutch manual uses the real names)."""
    en = json.loads((ROOT / "frontend" / "public" / "locales" / "en.json").read_text(encoding="utf-8"))
    pairs = {}
    for nl_text, en_text in en.items():
        if 3 <= len(en_text) <= 40 and en_text != nl_text and re.search(r"\b" + re.escape(en_text) + r"\b", text) and not re.search(r"[{}]", nl_text):
            pairs[en_text] = nl_text
    return dict(sorted(pairs.items(), key=lambda kv: -len(kv[0]))[:140])

def translate(title, text, n):
    sysmsg = ("You translate a chapter of the user manual of Easy2edit from English to Dutch (natural, friendly, clear: je/jij form). Keep the structure EXACTLY: lines that start with '## ' (subheadings), '- ' (bullets), '1. ' (steps), blank lines between paragraphs. "
              "Keep product names (Easy2edit, Claude, Stripe, Mollie, Postmark, ElevenLabs, PDF, HTML, CSS, API). Menu paths like 'Admin > Pages' use the names of the DUTCH interface: use the glossary (English name -> Dutch name) for every screen, button and tab it covers. "
              "Answer in plain text, no JSON, no code fences: the first line is 'TITLE: <the Dutch chapter title>', then one blank line, then the translated chapter text.")
    prompt = json.dumps({"chapter": n, "title": title, "text": text, "glossary": glossary(title + "\n" + text)}, ensure_ascii=False)
    for attempt in range(3):
        try:
            r = ai.claude(sysmsg, prompt, max_tokens=7000, timeout=170).strip()
            r = re.sub(r"^```\w*\s*|\s*```$", "", r)
            m = re.match(r"TITLE:\s*(.+?)\s*\n+(.+)$", r, re.S)
            if m and len(m.group(2)) > len(text) * 0.4:
                return m.group(1).strip(), m.group(2).strip()
        except Exception as e:
            print("  retry", attempt + 1, e, flush=True)
    raise SystemExit(f"translation of chapter {n} failed")

if SRC.is_file() and os.environ.get("MANUAL_REUSE"):  # the texts of an earlier run (no AI call)
    out = [tuple(x) for x in json.loads(SRC.read_text())]
elif LANG == "nl":  # the Dutch manual is the English one, translated by the AI
    out = []
    for i, (title, text) in enumerate(json.loads(EN_SRC.read_text()), 1):
        print("translating", i, title, flush=True)
        t, x = translate(title, text, i)
        out.append((clean(t), clean(x)))
    SRC.parent.mkdir(parents=True, exist_ok=True)
    SRC.write_text(json.dumps(out, ensure_ascii=False, indent=1))
else:
    out = []
    for i, (title, facts) in enumerate(CHAPTERS, 1):
        print("writing", i, title, flush=True)
        out.append((title, clean(write(title, facts, i))))
    SRC.parent.mkdir(parents=True, exist_ok=True)
    SRC.write_text(json.dumps(out, ensure_ascii=False, indent=1))

if LANG == "nl" and not CAPN.is_file():
    from apps.core import themeimport
    caps = {x["id"]: x["caption"] for x in SHOTS}
    o = themeimport._parse_json(ai.claude("Translate these captions of screenshots of the Easy2edit manual from English to Dutch (je/jij form, short). Use the Dutch names of the interface: Pagina's, Gebruikers, Rollen, Beveiliging, Instellingen, Thema, Talen, Plugins, Back-ups, API keys, Tegoed. Keep the paths like 'Super admin > AI > Overview' but with the Dutch tab names (Overzicht, Waar, Gebruikers, Kosten, Tegoed, Blokken, Instellingen). Answer with ONE JSON object only: {\"captions\": {\"<id>\": \"<dutch caption>\"}}.", json.dumps(caps, ensure_ascii=False), max_tokens=5000, timeout=170), need=("captions",))
    CAPS_NL = {k: clean(v) for k, v in o["captions"].items()}
    CAPN.write_text(json.dumps(CAPS_NL, ensure_ascii=False, indent=1))

# ---- the name of the product is always written in small letters: easy2edit
def lc(o):
    if isinstance(o, str): return re.sub(r"Easy2[Ee]dit", "easy2edit", o)
    if isinstance(o, (list, tuple)): return type(o)(lc(x) for x in o)
    if isinstance(o, dict): return {k: lc(v) for k, v in o.items()}
    return o
out = lc(out); UI = lc(UI); SHOTS = lc(SHOTS); VIDEOS = lc(VIDEOS)
try: CAPS_NL = lc(CAPS_NL)
except NameError: pass

# ---- the PDF
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, ListFlowable, ListItem, Table, TableStyle
from reportlab.platypus.tableofcontents import TableOfContents

ORANGE, GREY, DARK = "#f2823f", "#939497", "#2b2b2d"
st = lambda **k: ParagraphStyle("x", fontName=k.pop("font", "Helvetica"), **k)
H1 = st(fontSize=22, leading=26, textColor=colors.HexColor(DARK), font="Helvetica-Bold", spaceAfter=10, spaceBefore=4)
H2 = st(fontSize=13, leading=17, textColor=colors.HexColor(ORANGE), font="Helvetica-Bold", spaceBefore=12, spaceAfter=4)
BODY = st(fontSize=10, leading=14.5, textColor=colors.HexColor(DARK), spaceAfter=6)
SMALL = st(fontSize=8.5, leading=11, textColor=colors.HexColor(GREY))
TITLE = st(fontSize=34, leading=40, textColor=colors.HexColor(DARK), font="Helvetica-Bold")

class Doc(BaseDocTemplate):
    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name == "chapter":
            self.notify("TOCEntry", (0, f.getPlainText(), self.page))

CH = ParagraphStyle("chapter", parent=H1)
buf = io.BytesIO()
doc = Doc(buf, pagesize=A4, leftMargin=22*mm, rightMargin=22*mm, topMargin=20*mm, bottomMargin=22*mm, title=UI["title"], author="easy2edit")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
def foot(canvas, d):
    canvas.saveState(); canvas.setFillColor(colors.HexColor(ORANGE)); canvas.rect(0, 0, A4[0], 4*mm, stroke=0, fill=1)
    canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.HexColor(GREY))
    canvas.drawString(22*mm, 10*mm, f"{UI['title']} - {UI['version'].lower()} {VERSION} {UI['build']} {BUILD}"); canvas.drawRightString(A4[0]-22*mm, 10*mm, str(d.page)); canvas.restoreState()
doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=foot)])

story = []
logo = ROOT / "frontend" / "public" / "logos" / "easy2edit" / "logo.png"
if logo.is_file(): story.append(Image(str(logo), width=70*mm, height=70*mm*162/461))
story += [Spacer(1, 50*mm), Paragraph("easy2edit", TITLE), Paragraph(UI["manual"], st(fontSize=26, leading=32, textColor=colors.HexColor(ORANGE), font="Helvetica-Bold")), Spacer(1, 8*mm),
          Paragraph(f"{UI['version']} {VERSION}, {UI['build']} {BUILD}<br/>{date.today().day} {UI['months'][date.today().month - 1]} {date.today().year}", st(fontSize=12, leading=18, textColor=colors.HexColor(GREY))), PageBreak()]
toc = TableOfContents(); toc.levelStyles = [st(fontSize=11, leading=18, textColor=colors.HexColor(DARK))]
story += [Paragraph(UI["contents"], H1), toc, PageBreak()]

def flow(text):
    items, bullets, steps = [], [], []
    first_no = [1]
    def flush():
        nonlocal bullets, steps
        if bullets: items.append(ListFlowable([ListItem(Paragraph(escape(b), BODY), leftIndent=14) for b in bullets], bulletType="bullet", start="-", leftIndent=14, bulletFontSize=9)); bullets = []
        if steps: items.append(ListFlowable([ListItem(Paragraph(escape(b), BODY), leftIndent=16) for b in steps], bulletType="1", start=first_no[0], leftIndent=16)); steps = []
    for blk in re.split(r"\n\s*\n", text.strip()):
        lines = [l.strip() for l in blk.split("\n") if l.strip()]  # (the AI indents nested lists: they become one flat list)
        para = []
        for l in lines:
            if l.startswith("## "): flush(); items.append(Paragraph(escape(l[3:].strip()), H2))
            elif re.match(r"^[-*] ", l): (flush() if steps else None); bullets.append(l[2:].strip())
            elif re.match(r"^\d+[.)] ", l):
                (flush() if bullets else None)
                if not steps: first_no[0] = int(re.match(r"^(\d+)", l).group(1))
                steps.append(re.sub(r"^\d+[.)] ", "", l).strip())
            else: flush(); para.append(l)
        flush()
        if para: items.append(Paragraph(escape(" ".join(para)), BODY))
    flush()
    return items

from PIL import Image as PILImage
from reportlab.platypus import KeepTogether

figno = [0]
def figure(file, caption):
    path = IMG / f"{file}.jpg"
    figno[0] += 1
    iw, ih = PILImage.open(path).size
    w = doc.width
    return KeepTogether([Spacer(1, 3 * mm), Image(str(path), width=w, height=w * ih / iw), Spacer(1, 1.5 * mm), Paragraph(f"<i>{UI['figure']} {figno[0]}. {escape(caption)}</i>", SMALL), Spacer(1, 4 * mm)])

for n, (title, text) in enumerate(out, 1):
    story.append(Paragraph(f"{n}. {escape(title)}", CH))
    secs, imgs = split_sections(text), chapter_shots(n)
    where = spread(len(secs), len(imgs))
    for k, (head, body) in enumerate(secs):
        if head: story.append(Paragraph(escape(head), H2))
        story += flow(body)
        story += [figure(f, c) for (f, c), w in zip(imgs, where) if w == k]
    if n < len(out): story.append(PageBreak())

doc.multiBuild(story)
dest = ROOT / "manuals" / "pdf" / f"manual_{LANG}.pdf"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_bytes(buf.getvalue())
print("manual written", dest, len(buf.getvalue()), "bytes")


# ---- the HTML manual: manuals/html/en/ (one page per chapter; menu, search, "on this page", no external files)
import html as _h
HD = ROOT / "manuals" / "html" / LANG
HD.mkdir(parents=True, exist_ok=True)
for old in HD.glob("*.html"):
    old.unlink()

CSS = """
:root{--bg:#fff;--fg:#1f1f24;--mut:#6b6b76;--acc:#d9631a;--acc2:#fff3ea;--line:#e6e6ea;--side:#f7f7f9;--card:#fff;--shadow:0 1px 2px rgba(20,20,30,.06),0 8px 24px rgba(20,20,30,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#14111a;--fg:#eceaf2;--mut:#a09cad;--acc:#ff9a55;--acc2:#2a1f1a;--line:#2b2635;--side:#1a1621;--card:#1c1823;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg);-webkit-font-smoothing:antialiased}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
.top{position:sticky;top:0;z-index:20;height:60px;display:flex;align-items:center;gap:1rem;padding:0 1.25rem;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top .brand{font-weight:800;font-size:1.2rem;letter-spacing:-.01em;color:var(--fg)}.top .brand b{color:var(--acc)}
.top .ver{color:var(--mut);font-size:.85rem;border-left:1px solid var(--line);padding-left:1rem}
.top .sp{flex:1}.top input{width:min(280px,34vw);padding:.5rem .8rem;border:1px solid var(--line);border-radius:999px;background:var(--side);color:var(--fg);font:inherit;font-size:.9rem}
.top input:focus{outline:2px solid var(--acc);outline-offset:1px}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .95rem;border-radius:999px;background:var(--acc);color:#fff;font-weight:600;font-size:.88rem;text-decoration:none!important}
.btn:hover{filter:brightness(1.07)}.menu{display:none;background:none;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:.4rem .6rem;font-size:1rem;cursor:pointer}
.wrap{display:grid;grid-template-columns:272px minmax(0,1fr) 220px;max-width:1380px;margin:0 auto}
nav.side{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:1.25rem .9rem 2rem;border-right:1px solid var(--line)}
nav.side h4{margin:.4rem .6rem .5rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
nav.side a{display:flex;gap:.6rem;align-items:baseline;padding:.5rem .65rem;border-radius:9px;color:var(--fg);font-size:.93rem;line-height:1.35}
nav.side a span{color:var(--mut);font-variant-numeric:tabular-nums;min-width:1.4em}nav.side a:hover{background:var(--side);text-decoration:none}
nav.side a.on{background:var(--acc2);color:var(--acc);font-weight:600}nav.side a.on span{color:var(--acc)}nav.side a.hide{display:none}
main{padding:2.4rem clamp(1.2rem,4vw,3.2rem) 4rem;min-width:0}article{max-width:760px}
.crumb{color:var(--mut);font-size:.85rem;margin-bottom:.6rem}.crumb a{color:var(--mut)}
h1{font-size:clamp(1.9rem,3.2vw,2.5rem);line-height:1.15;letter-spacing:-.02em;margin:0 0 1.2rem}
h2{font-size:1.35rem;line-height:1.3;margin:2.4rem 0 .7rem;padding-top:1.2rem;border-top:1px solid var(--line);letter-spacing:-.01em}h2 a{color:inherit}h2 a:hover{text-decoration:none}h2 .anc{opacity:0;margin-left:.4rem;color:var(--acc);font-weight:400}h2:hover .anc{opacity:1}
p{margin:.8rem 0}p.lead{font-size:1.15rem;line-height:1.65;color:var(--mut)}ul,ol{padding-left:1.5rem;margin:.8rem 0}li{margin:.4rem 0}li::marker{color:var(--acc)}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:3.5rem}.pager a{display:block;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg)}
.pager a:hover{border-color:var(--acc);text-decoration:none}.pager small{display:block;color:var(--mut);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.pager .nx{text-align:right}.pager strong{color:var(--acc)}
aside.toc{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:2.6rem 1rem 2rem 0;font-size:.85rem}aside.toc h4{margin:0 0 .6rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
aside.toc a{display:block;padding:.28rem 0 .28rem .8rem;border-left:2px solid var(--line);color:var(--mut);line-height:1.35}aside.toc a:hover{color:var(--acc);border-color:var(--acc);text-decoration:none}
.hero{padding:1rem 0 2rem}.hero p{font-size:1.2rem;color:var(--mut);max-width:620px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-top:1.6rem}
.card{display:block;padding:1.2rem 1.25rem;border:1px solid var(--line);border-radius:14px;background:var(--card);box-shadow:var(--shadow);color:var(--fg);transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--acc);text-decoration:none}.card .n{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--acc2);color:var(--acc);font-weight:700;font-size:.9rem;margin-bottom:.6rem}
.card h3{margin:0 0 .35rem;font-size:1.05rem}.card p{margin:0;color:var(--mut);font-size:.9rem;line-height:1.5}
.video{margin:1.6rem 0}.video video{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);background:#000;box-shadow:var(--shadow)}.video p{margin:.55rem 0 0;color:var(--mut);font-size:.88rem;text-align:center}.video p span{opacity:.85}.langsw{display:inline-flex;gap:.1rem;border:1px solid var(--line);border-radius:999px;padding:.15rem;font-size:.78rem;font-weight:700}.langsw b,.langsw a{padding:.28rem .6rem;border-radius:999px}.langsw b{background:var(--acc);color:#fff}.langsw a{color:var(--mut)}.langsw a:hover{text-decoration:none;color:var(--fg)}
.tabs{display:flex;gap:.25rem;margin-left:.5rem}.tabs a{padding:.4rem .9rem;border-radius:999px;color:var(--mut);font-weight:600;font-size:.92rem;text-decoration:none}.tabs a:hover{color:var(--fg)}.tabs a.on{background:var(--acc);color:#fff}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.4rem;margin-top:1.4rem}.vcard{border:1px solid var(--line);border-radius:14px;padding:.9rem;background:var(--side)}.vcard.hide{display:none}.vcard .video{margin:0}.vcard h3{margin:.8rem 0 .2rem;font-size:1.05rem}.vcard .go{font-size:.88rem}.vnone{display:none;color:var(--mut);margin-top:1.4rem}.vnone.show{display:block}
figure{margin:1.6rem 0;padding:0}figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);background:var(--side)}figcaption{margin-top:.55rem;color:var(--mut);font-size:.85rem;text-align:center}
footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid var(--line);color:var(--mut);font-size:.82rem}
@media(max-width:1180px){.wrap{grid-template-columns:272px minmax(0,1fr)}aside.toc{display:none}}
@media(max-width:820px){.wrap{display:block}.menu{display:inline-block}nav.side{display:none;position:fixed;inset:60px 0 0 0;z-index:15;height:auto;background:var(--bg);border-right:0}body.open nav.side{display:block}.top .ver{display:none}.top input{width:100%;flex:1}.pager{grid-template-columns:1fr}}
@media print{.top,nav.side,aside.toc,.pager{display:none}.wrap{display:block}main{padding:0}}
"""

JS = """
(function(){var q=document.getElementById('q'),links=[].slice.call(document.querySelectorAll('nav.side a[data-t]'));
var cards=[].slice.call(document.querySelectorAll('.vcard[data-t]')),none=document.getElementById('vnone');
if(q)q.addEventListener('input',function(){var v=q.value.toLowerCase().trim(),n=0;links.forEach(function(a){a.classList.toggle('hide',!!v&&a.getAttribute('data-t').indexOf(v)<0)});cards.forEach(function(c){var h=!!v&&c.getAttribute('data-t').indexOf(v)<0;c.classList.toggle('hide',h);if(!h)n++});if(none)none.classList.toggle('show',cards.length>0&&n===0)});
var m=document.getElementById('menu');if(m)m.addEventListener('click',function(){document.body.classList.toggle('open')});
try{if(window.self!==window.top){var ls=document.querySelector('.langsw');if(ls)ls.style.display='none';}}catch(e){}
var pdf=document.getElementById('pdf');if(pdf)pdf.setAttribute('href',location.pathname.indexOf('/api/manual/')>=0?'/api/manual/pdf/__LANG__/':'../../pdf/manual___LANG__.pdf');
var on=document.querySelector('nav.side a.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'});})();
"""

JS = JS.replace("__LANG__", LANG)


def slug(t): return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "section"

def body_html(text):
    out, heads, mode, first = [], [], None, True
    def close():
        nonlocal mode
        if mode: out.append(f"</{mode}>"); mode = None
    for blk in re.split(r"\n\s*\n", text.strip()):
        para = []
        for l in [x.strip() for x in blk.split("\n") if x.strip()]:
            if l.startswith("## "):
                close(); t = l[3:].strip(); sid = slug(t); heads.append((sid, t))
                out.append(f'<h2 id="{sid}">{_h.escape(t)}<a class="anc" href="#{sid}" aria-label="Link to this section">#</a></h2>')
            elif re.match(r"^[-*] ", l):
                if mode != "ul": close(); out.append("<ul>"); mode = "ul"
                out.append(f"<li>{_h.escape(l[2:].strip())}</li>")
            elif re.match(r"^\d+[.)] ", l):
                if mode != "ol": close(); out.append(f'<ol start="{int(re.match(r"^(\d+)", l).group(1))}">'); mode = "ol"
                out.append("<li>" + _h.escape(re.sub(r"^\d+[.)] ", "", l).strip()) + "</li>")
            else: close(); para.append(l)
        close()
        if para:
            out.append(f'<p class="{"lead" if first and not heads else ""}">{_h.escape(" ".join(para))}</p>'.replace(' class=""', "")); first = False
    close()
    return "\n".join(out), heads

def first_sentence(text, n=150):
    t = re.sub(r"(?m)^## .*$", "", text).strip()
    t = re.sub(r"\s+", " ", t)
    m = re.match(r"(.{40,%d}?[.!?])\s" % n, t + " ")
    return (m.group(1) if m else t[:n].rstrip() + "...")

def vlist():
    """The videos that have been made, with the words that are said in them (for the search)."""
    res = []
    for v in VIDEOS:
        if not (VID / "en" / f"{v['id']}.mp4").is_file(): continue
        said = " ".join(st["say"].get(LANG, st["say"].get("en", "")) for st in v.get("steps", []))
        res.append((v, said))
    return res

def page(idx, title, inner, heads, prev, nxt):
    if idx == -1:  # the page with the videos
        nav = f'<h4>{UI["videos"]}</h4>' + "".join(
            f'<a href="#v-{v["id"]}" data-t="{_h.escape((v["title"][LANG] + " " + said).lower(), quote=True)}"><span>&#9654;</span>{_h.escape(v["title"][LANG])}</a>' for v, said in vlist())
    else:
      nav = f'<h4>{UI["manual"]}</h4><a href="index.html" data-t="{UI["contents"].lower()}" class="{"on" if idx == 0 else ""}"><span>&#9776;</span>{UI["contents"]}</a>' + "".join(
        f'<a href="chapter-{n}.html" data-t="{_h.escape((t + " " + txt[:400]).lower(), quote=True)}" class="{"on" if n == idx else ""}"><span>{n}</span>{_h.escape(t)}</a>' for n, (t, txt) in enumerate(out, 1))
    toc = ('<aside class="toc"><h4>' + UI["on_page"] + '</h4>' + "".join(f'<a href="#{i}">{_h.escape(t)}</a>' for i, t in heads) + "</aside>") if heads else '<aside class="toc"></aside>'
    pager = '<div class="pager">' + (f'<a href="chapter-{prev}.html"><small>{UI["prev"]}</small><strong>&larr; {_h.escape(out[prev-1][0])}</strong></a>' if prev else "<span></span>") + \
            (f'<a class="nx" href="chapter-{nxt}.html"><small>{UI["next"]}</small><strong>{_h.escape(out[nxt-1][0])} &rarr;</strong></a>' if nxt else "<span></span>") + "</div>"
    crumb = f'<div class="crumb"><a href="index.html">{UI["manual"]}</a>' + (f' / {UI["videos"]}' if idx == -1 else f' / {UI["chapter"]} {idx}' if idx else "") + "</div>"
    return (f'<!doctype html><html lang="{LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">'
            f'<title>{_h.escape(title)} - {UI["title"]}</title><style>{CSS}</style></head><body>'
            f'<header class="top"><button class="menu" id="menu" aria-label="Menu">&#9776;</button><a class="brand" href="index.html">easy2<b>edit</b></a><nav class="tabs"><a href="index.html" class="{"on" if idx >= 0 else ""}">{UI["manual"]}</a><a href="videos.html" class="{"on" if idx == -1 else ""}">{UI["videos"]}</a></nav><span class="ver">{UI["manual"]} &middot; {UI["version"].lower()} {VERSION} {UI["build"]} {BUILD}</span><span class="sp"></span>'
            f'<input id="q" type="search" placeholder="{UI["vsearch"] if idx == -1 else UI["search"]}" aria-label="{UI["search"]}"><span class="langsw"><b>{LANG.upper()}</b><a href="../{OTHER}/{"videos" if idx == -1 else "index" if idx == 0 else f"chapter-{idx}"}.html" hreflang="{OTHER}" title="{"Nederlands" if OTHER == "nl" else "English"}">{OTHER.upper()}</a></span><a class="btn" id="pdf" href="../../pdf/manual_{LANG}.pdf" download>PDF</a></header>'
            f'<div class="wrap"><nav class="side">{nav}</nav><main><article>{crumb}{inner}{pager}<footer>{UI["title"]} &middot; {UI["version"].lower()} {VERSION} {UI["build"]} {BUILD} &middot; {UI["lang_name"]}</footer></article></main>{toc}</div><script>{JS}</script></body></html>')

cards = "".join(f'<a class="card" href="chapter-{n}.html"><span class="n">{n}</span><h3>{_h.escape(t)}</h3><p>{_h.escape(first_sentence(txt))}</p></a>' for n, (t, txt) in enumerate(out, 1))
home = (f'<div class="hero"><h1>{UI["title"]}</h1><p>{UI["hero"]}</p></div><div class="cards">{cards}</div>')
(HD / "index.html").write_text(page(0, UI["contents"], home, [], 0, 1 if out else 0), encoding="utf-8")
def fig_html(file, caption, no):
    c = _h.escape(caption, quote=True)
    return f'<figure><a href="images/{file}.jpg" target="_blank" rel="noopener"><img src="images/{file}.jpg" alt="{c}" width="1440" height="900" loading="lazy"></a><figcaption>{UI["figure"]} {no}. {_h.escape(caption)}</figcaption></figure>'

def video_html(vid, title_en, title_nl, has_nl):
    """The video in the language of this manual (English or Dutch voice-over); a link to the other language when that one exists."""
    mine = LANG if (LANG == "en" or has_nl) else "en"
    other = "nl" if mine == "en" else "en"
    title = title_nl if mine == "nl" else title_en
    olink = f' {UI["also"]} <a href="../../video/{other}/{vid}.mp4" target="_blank" rel="noopener">{"Nederlands" if other == "nl" else "English"}</a>' if (other == "en" or has_nl) else ""
    voice = "Nederlandse voice-over" if mine == "nl" else "English voice-over"
    return (f'<div class="video"><video controls preload="metadata" poster="../../video/{mine}/{vid}.jpg" width="1280" height="800"><source src="../../video/{mine}/{vid}.mp4" type="video/mp4"></video>'
            f'<p>{UI["video"]}: {_h.escape(title)} <span>({voice}{olink})</span></p></div>')


def chapter_html(n, txt):
    secs, imgs = split_sections(txt), chapter_shots(n)
    where = spread(len(secs), len(imgs))
    parts, heads, no = [], [], 0
    for k, (head, body) in enumerate(secs):
        h, hs = body_html((f"## {head}\n\n" if head else "") + body)
        parts.append(h); heads += hs
        if k == 0:
            parts += [video_html(*v) for v in chapter_videos(n)]
        for (f, c), w in zip(imgs, where):
            if w == k:
                no += 1; parts.append(fig_html(f, c, no))
    return "\n".join(parts), heads

for n, (t, txt) in enumerate(out, 1):
    inner, heads = chapter_html(n, txt)
    (HD / f"chapter-{n}.html").write_text(page(n, t, f"<h1>{n}. {_h.escape(t)}</h1>\n" + inner, heads, n - 1, n + 1 if n < len(out) else 0), encoding="utf-8")
def videos_page():
    cs = []
    for v, said in vlist():
        n = v.get("chapter")
        mine = LANG if (LANG == "en" or (VID / "nl" / f"{v['id']}.mp4").is_file()) else "en"
        link = f'<a class="go" href="chapter-{n}.html">{UI["tochapter"]} {n}: {_h.escape(out[n-1][0])} &rarr;</a>' if n and n <= len(out) else ""
        blk = video_html(v["id"], v["title"]["en"], v["title"]["nl"], (VID / "nl" / f"{v['id']}.mp4").is_file())
        cs.append(f'<section class="vcard" id="v-{v["id"]}" data-t="{_h.escape((v["title"][LANG] + " " + said).lower(), quote=True)}"><h3>{_h.escape(v["title"][mine if mine in v["title"] else "en"])}</h3>{blk}{link}</section>')
    inner = f'<h1>{UI["videos"]}</h1><p class="lead">{UI["vhero"]}</p><div class="vgrid">{"".join(cs)}</div><p class="vnone" id="vnone">{UI["vnone"]}</p>'
    (HD / "videos.html").write_text(page(-1, UI["videos"], inner, [], 0, 0), encoding="utf-8")
videos_page()
print("html manual written", HD, len(out) + 1, "pages")
