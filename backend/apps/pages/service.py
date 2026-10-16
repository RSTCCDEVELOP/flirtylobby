import re

from apps.core import modules
from apps.core.models import Language

from .models import Page

# Built-in pages: key, titles, url, module that must be on, in the menu by default, audience
SYSTEM = [
    ("home", "/", "", True, "all", {"nl": "Home", "en": "Home", "de": "Startseite", "fr": "Accueil", "es": "Inicio", "pt": "Início", "zh": "首页", "ar": "الرئيسية"}),
    ("products", "/producten", "products", True, "all", {"nl": "Producten", "en": "Products", "de": "Produkte", "fr": "Produits", "es": "Productos", "pt": "Produtos", "zh": "产品", "ar": "المنتجات"}),
    ("members", "/leden", "profiles", True, "all", {"nl": "Leden", "en": "Members", "de": "Mitglieder", "fr": "Membres", "es": "Miembros", "pt": "Membros", "zh": "会员", "ar": "الأعضاء"}),
    ("register", "/registreren", "registration", False, "guests", {"nl": "Aanmelden", "en": "Sign up", "de": "Registrieren", "fr": "S’inscrire", "es": "Registrarse", "pt": "Registar", "zh": "注册", "ar": "إنشاء حساب"}),
    ("privacy", "/privacy", "privacy_pages", False, "all", {"nl": "Privacybeleid", "en": "Privacy policy", "de": "Datenschutz", "fr": "Confidentialité", "es": "Privacidad", "pt": "Privacidade", "zh": "隐私政策", "ar": "سياسة الخصوصية"}),
    ("cookies", "/cookies", "privacy_pages", False, "all", {"nl": "Cookiebeleid", "en": "Cookie policy", "de": "Cookie-Richtlinie", "fr": "Politique de cookies", "es": "Política de cookies", "pt": "Política de cookies", "zh": "Cookie 政策", "ar": "سياسة ملفات الارتباط"}),
]
ALWAYS_ON = {"home"}


def ensure_defaults():
    """Create the built-in pages that do not exist yet (idempotent; new ones are added as the app grows)."""
    have = set(Page.objects.filter(kind="system").values_list("key", flat=True))
    n = Page.objects.count()
    for i, (key, url, module, in_menu, audience, titles) in enumerate(SYSTEM):
        if key not in have:
            Page.objects.create(key=key, kind="system", title=titles, url=url, module=module, in_menu=in_menu, audience=audience, order=n + i)


def available(page):
    """Is the page really usable now: switched on, and its module is on."""
    if not page.enabled and page.key not in ALWAYS_ON:
        return False
    if page.module and not modules.enabled(page.module):
        return False
    if page.key == "register":
        from apps.security import service as security

        return bool(security.get()["registration"]["enabled"])
    return True


def title_of(page, lang=None):
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    t = page.title or {}
    for code in (lang, default, "nl", *t):
        if code and t.get(code):
            return t[code]
    return page.key


def menu():
    """The header menu: only pages that are on (and whose module is on), two levels deep."""
    ensure_defaults()
    pages = list(Page.objects.select_related("parent"))
    ok = {p.id: p for p in pages if available(p) and p.in_menu}

    def item(p):
        return {"id": p.id, "key": p.key, "titles": p.title, "url": p.path, "new_tab": p.new_tab, "audience": p.audience, "children": []}

    top = [item(p) for p in ok.values() if p.parent_id is None]
    by_id = {t["id"]: t for t in top}
    for p in ok.values():
        if p.parent_id and p.parent_id in by_id:  # a child of a hidden/disabled parent is hidden too
            by_id[p.parent_id]["children"].append(item(p))
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
