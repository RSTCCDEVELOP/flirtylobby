# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import re

from apps.core import modules
from apps.core.models import Language

from .models import Page

# Built-in pages: key, titles, url, module that must be on, in the menu by default, audience
SYSTEM = [
    ("home", "/", "", True, "all", {"nl": "Home", "en": "Home", "de": "Startseite", "fr": "Accueil", "es": "Inicio", "pt": "Início", "zh": "首页", "ar": "الرئيسية"}),
    ("products", "/producten", "plugin:webshop", True, "all", {"nl": "Producten", "en": "Products", "de": "Produkte", "fr": "Produits", "es": "Productos", "pt": "Produtos", "zh": "产品", "ar": "المنتجات"}),
    ("members", "/leden", "profiles", True, "all", {"nl": "Leden", "en": "Members", "de": "Mitglieder", "fr": "Membres", "es": "Miembros", "pt": "Membros", "zh": "会员", "ar": "الأعضاء"}),
    ("subscriptions", "/abonnementen", "subscriptions", False, "all", {"nl": "Abonnementen", "en": "Subscriptions", "de": "Abonnements", "fr": "Abonnements", "es": "Suscripciones", "pt": "Subscrições", "zh": "订阅", "ar": "الاشتراكات"}),
    ("donations", "/doneren", "donations", False, "all", {"nl": "Doneren", "en": "Donate", "de": "Spenden", "fr": "Faire un don", "es": "Donar", "pt": "Doar", "zh": "捐赠", "ar": "تبرع"}),
    ("faq", "/faq", "faq", False, "all", {"nl": "FAQ", "en": "FAQ", "de": "FAQ", "fr": "FAQ", "es": "Preguntas frecuentes", "pt": "Perguntas frequentes", "zh": "常见问题", "ar": "الأسئلة الشائعة"}),
    ("register", "/registreren", "registration", False, "guests", {"nl": "Aanmelden", "en": "Sign up", "de": "Registrieren", "fr": "S’inscrire", "es": "Registrarse", "pt": "Registar", "zh": "注册", "ar": "إنشاء حساب"}),
    ("login", "/login", "", False, "guests", {"nl": "Inloggen", "en": "Log in", "de": "Anmelden", "fr": "Connexion", "es": "Iniciar sesión", "pt": "Entrar", "zh": "登录", "ar": "تسجيل الدخول"}),
    ("notfound", "/404", "", False, "all", {"nl": "Pagina niet gevonden (404)", "en": "Page not found (404)", "de": "Seite nicht gefunden (404)", "fr": "Page introuvable (404)", "es": "Página no encontrada (404)", "pt": "Página não encontrada (404)", "zh": "页面未找到 (404)", "ar": "الصفحة غير موجودة (404)"}),
    ("privacy", "/privacy", "privacy_pages", False, "all", {"nl": "Privacybeleid", "en": "Privacy policy", "de": "Datenschutz", "fr": "Confidentialité", "es": "Privacidad", "pt": "Privacidade", "zh": "隐私政策", "ar": "سياسة الخصوصية"}),
    ("cookies", "/cookies", "privacy_pages", False, "all", {"nl": "Cookiebeleid", "en": "Cookie policy", "de": "Cookie-Richtlinie", "fr": "Politique de cookies", "es": "Política de cookies", "pt": "Política de cookies", "zh": "Cookie 政策", "ar": "سياسة ملفات الارتباط"}),
]
BASE_LANGS = ("nl", "en", "de", "fr", "es", "pt", "zh", "ar")


def lang_codes():
    """Every language of the system, also the ones that are switched off (the data of a page is kept for all of them)."""
    try:
        codes = list(Language.objects.values_list("code", flat=True))
    except Exception:  # noqa: BLE001 (before the first migration)
        codes = []
    return tuple(codes) or BASE_LANGS
ALWAYS_ON = {"home", "login", "notfound"}  # cannot be switched off
# pages whose texts can be edited in edit mode (own pages always can)
EDITABLE = {"home", "login", "notfound"}


def ensure_defaults():
    """Create the built-in pages that do not exist yet (idempotent; new ones are added as the app grows)."""
    from . import defaults

    try:
        defaults.ensure_pages()  # the standard pages of games, community, webshop, subscriptions and donations
    except Exception:  # noqa: BLE001 - the menu must never break on this
        pass
    have = set(Page.objects.filter(kind="system").values_list("key", flat=True))
    n = Page.objects.count()
    for key, url, *_ in SYSTEM:  # built-in addresses are fixed: bring an older value in line
        Page.objects.filter(kind="system", key=key).exclude(url=url).update(url=url)
    for key, _u, module, *_ in SYSTEM:  # a page that moved to a plugin follows that plugin
        Page.objects.filter(kind="system", key=key).exclude(module=module).update(module=module)
    for i, (key, url, module, in_menu, audience, titles) in enumerate(SYSTEM):
        if key not in have:
            Page.objects.create(key=key, kind="system", title=titles, url=url, module=module, in_menu=in_menu, audience=audience, order=n + i)


def available(page):
    """Is the page really usable now: switched on, and its module is on."""
    if not page.enabled and page.key not in ALWAYS_ON:
        return False
    if page.module and not any(modules.enabled(m) for m in page.module.split("|")):  # "a|b" = on while one of them is on
        return False
    if page.key == "register":
        from apps.security import service as security

        return bool(security.get()["registration"]["enabled"])
    return True


def restricted(page):
    return bool((page.access or {}).get("users") or (page.access or {}).get("groups"))


def can_see(user, page):
    """May this visitor open the page? A page without a list of users/groups is for everybody (the audience still decides who sees it in the menu).
    With a list: only the listed users, the members of the listed groups, and those who manage the pages."""
    if not restricted(page):
        return True
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    from apps.accounts.access import level

    if level(user, "pages") >= 2:
        return True
    acc = page.access
    return user.id in (acc.get("users") or []) or user.user_groups.filter(id__in=acc.get("groups") or []).exists()


def title_of(page, lang=None):
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    t = page.title or {}
    for code in (lang, default, "nl", *t):
        if code and t.get(code):
            return t[code]
    return page.key


def menu(user=None):
    """The header menu: only pages that are on (and whose module is on), two levels deep."""
    ensure_defaults()
    return _tree(Page.objects.filter(scope="public"), user)


def private_menu(user=None):
    """The menu of the dashboard (the header of a logged-in member): the private pages that are on."""
    return _tree(Page.objects.filter(scope="private"), user)


def _tree(qs, user=None):
    pages = list(qs.select_related("parent"))
    ok = {p.id: p for p in pages if available(p) and p.in_menu and can_see(user, p)}

    def item(p):
        return {"id": p.id, "key": p.key, "titles": p.title, "url": p.path, "urls": {l: p.path_in(l) for l in lang_codes()}, "new_tab": p.new_tab, "audience": p.audience, "kind": p.kind, "devices": p.devices or {}, "cta": p.cta, "label_link": p.label_link, "children": []}

    top = [item(p) for p in ok.values() if p.parent_id is None]
    by_id = {t["id"]: t for t in top}
    for p in ok.values():
        if p.parent_id and p.parent_id in by_id:  # a child of a hidden/disabled parent is hidden too
            by_id[p.parent_id]["children"].append(item(p))
    top = [t for t in top if t["kind"] != "menu" or t["children"]]  # a text-only item without anything under it is not shown
    order = {p.id: (p.order, p.id) for p in pages}
    top.sort(key=lambda t: order[t["id"]])
    for t in top:
        t["children"].sort(key=lambda c: order[c["id"]])
    return top


def default_menu():
    """When the Pages module is off the site keeps a plain menu: Home plus the built-in pages whose module is on."""
    out = []
    for key, url, module, in_menu, audience, titles in SYSTEM:
        if in_menu and (not module or modules.enabled(module)):
            out.append({"id": -len(out) - 1, "key": key, "titles": titles, "url": url, "new_tab": False, "audience": audience, "children": []})
    return out


URL_RE = re.compile(r"^(https?://[^\s]{3,290}|/[^\s]{0,290}|mailto:[^\s]{3,200}|tel:[+0-9 ()-]{3,30})$")


def _slugify(text):
    import unicodedata

    t = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


def has_slugs(page):
    return page.scope == "public" and page.kind in ("system", "content", "menu") and page.key != "home" and "<" not in (page.url or "")


def fill_slugs(page, given=None):
    """The address of a page in EVERY language (also the ones that are not on): what is given stays, the rest comes from the name in that language,
    or from the address in the default language. Returns an error text when an address is already taken by another page."""
    from apps.core.models import Language

    if not has_slugs(page):
        return None
    codes = list(Language.objects.values_list("code", flat=True)) or ["nl"]
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    cur = {k: v for k, v in (page.slugs or {}).items() if v}
    for k, v in (given or {}).items():
        v = _slugify(v)
        if v:
            cur[k] = v
        elif k in cur and not v:
            cur.pop(k)
    base = cur.get(default) or _slugify((page.title or {}).get(default)) or page.key
    taken = {}
    for o in Page.objects.filter(scope="public").exclude(pk=page.pk):
        for pth in o.all_paths():
            taken[pth] = o.key
    out = {}
    for c in sorted(codes, key=lambda x: x != "en"):  # English first: Chinese and Arabic use it when they have no address of their own
        v = cur.get(c) or _slugify((page.title or {}).get(c)) or (out.get("en") if c in ("zh", "ar") else "") or base
        if "/" + v in taken:
            if c in (given or {}):
                return f"Het adres /{v} wordt al gebruikt door een andere pagina."
            v = base if "/" + base not in taken else page.key
        out[c] = v
    page.slugs = out
    return None


# ── the look of the header menu ─────────────────────────────────────────────
DEVICES = ("desktop", "tablet", "mobile")
FORMS = ("bar", "hamburger", "drawer-left", "drawer-right", "fullscreen", "bottom")  # the form of the menu on a device
DEFAULT_MENU = {
    "breakpoints": {"tablet": 1024, "mobile": 700},
    "forms": {"desktop": "bar", "tablet": "bar", "mobile": "hamburger"},
    "align": {"desktop": "left", "tablet": "left", "mobile": "left"},  # left | center | right (of the header)
    "toggle_pos": {"desktop": "right", "tablet": "right", "mobile": "right"},  # where the hamburger button sits in the header: left | center | right
    "sub": {"desktop": "dropdown", "tablet": "dropdown", "mobile": "accordion"},  # dropdown | mega | accordion
    "open_on": {"desktop": "hover", "tablet": "click", "mobile": "click"},  # how a sub menu opens: hover | click
    "item_style": "theme",  # theme (follows the theme) | text | underline | pill | button | outline
    "size": "md",  # sm | md | lg
    "uppercase": False,
    "arrows": True,  # a small arrow at items with a sub menu
    "overlay": True,  # drawer / full screen: dim the page behind it
    "close_on_click": True,  # close the menu after a click on a link
    "sticky_bottom": True,  # the bottom bar stays at the bottom
    "height": {"desktop": 0, "tablet": 0, "mobile": 0},  # height of the header (px); 0 = what the theme says
    "bg": "",  # colour of the header ("" = the colour of the theme)
    "bg_opacity": 0.88,  # 0 (see-through) to 1 (solid)
    "blur": 10,  # blur of what is behind a see-through header (px)
    "float": "none",  # after scrolling: none | shadow (a shadow) | float (a floating, rounded bar) | hide (away when scrolling down, back when scrolling up)
    "float_after": 80,  # after how many px of scrolling
}
CHOICES = {"float": ("none", "shadow", "float", "hide"), "align": ("left", "center", "right"), "sub": ("dropdown", "mega", "accordion"), "open_on": ("hover", "click"), "item_style": ("theme", "text", "underline", "pill", "button", "outline"), "size": ("sm", "md", "lg")}


def menu_settings():
    from .models import MenuSettings

    row = MenuSettings.objects.filter(pk=1).first()
    return clean_menu_settings((row.data if row else {}) or {})


def clean_menu_settings(d):
    d = d if isinstance(d, dict) else {}
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULT_MENU.items()}
    bp = d.get("breakpoints") or {}
    for k, lo, hi in (("tablet", 700, 1600), ("mobile", 320, 1200)):
        try:
            out["breakpoints"][k] = min(max(int(bp.get(k, out["breakpoints"][k])), lo), hi)
        except (TypeError, ValueError):
            pass
    if out["breakpoints"]["mobile"] >= out["breakpoints"]["tablet"]:
        out["breakpoints"]["mobile"] = out["breakpoints"]["tablet"] - 1
    for key, allowed in (("forms", FORMS), ("toggle_pos", CHOICES["align"]), *((k, v) for k, v in CHOICES.items() if k in ("align", "sub", "open_on"))):
        for dev in DEVICES:
            v = (d.get(key) or {}).get(dev)
            if v in allowed:
                out[key][dev] = v
    for key in ("item_style", "size", "float"):
        if d.get(key) in CHOICES[key]:
            out[key] = d[key]
    for dev in DEVICES:
        try:
            h = int((d.get("height") or {}).get(dev, out["height"][dev]))
            out["height"][dev] = 0 if h <= 0 else min(max(h, 40), 160)
        except (TypeError, ValueError):
            pass
    bg = str(d.get("bg") or "")
    out["bg"] = bg if re.fullmatch(r"#[0-9a-fA-F]{6}", bg) else ""
    fg = str(d.get("fg") or "")
    out["fg"] = fg if re.fullmatch(r"#[0-9a-fA-F]{6}", fg) else ""  # the colour of the menu texts on that background
    for key, lo, hi, cast in (("bg_opacity", 0, 1, float), ("blur", 0, 30, int), ("float_after", 10, 600, int)):
        try:
            out[key] = round(min(max(cast(d.get(key, out[key])), lo), hi), 2) if cast is float else min(max(cast(d.get(key, out[key])), lo), hi)
        except (TypeError, ValueError):
            pass
    for key in ("uppercase", "arrows", "overlay", "close_on_click", "sticky_bottom"):
        if key in d:
            out[key] = bool(d[key])
    return out
