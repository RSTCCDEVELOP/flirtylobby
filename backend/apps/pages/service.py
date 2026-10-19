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
    ("register", "/registreren", "registration", False, "guests", {"nl": "Aanmelden", "en": "Sign up", "de": "Registrieren", "fr": "S’inscrire", "es": "Registrarse", "pt": "Registar", "zh": "注册", "ar": "إنشاء حساب"}),
    ("login", "/login", "", False, "guests", {"nl": "Inloggen", "en": "Log in", "de": "Anmelden", "fr": "Connexion", "es": "Iniciar sesión", "pt": "Entrar", "zh": "登录", "ar": "تسجيل الدخول"}),
    ("notfound", "/404", "", False, "all", {"nl": "Pagina niet gevonden (404)", "en": "Page not found (404)", "de": "Seite nicht gefunden (404)", "fr": "Page introuvable (404)", "es": "Página no encontrada (404)", "pt": "Página não encontrada (404)", "zh": "页面未找到 (404)", "ar": "الصفحة غير موجودة (404)"}),
    ("privacy", "/privacy", "privacy_pages", False, "all", {"nl": "Privacybeleid", "en": "Privacy policy", "de": "Datenschutz", "fr": "Confidentialité", "es": "Privacidad", "pt": "Privacidade", "zh": "隐私政策", "ar": "سياسة الخصوصية"}),
    ("cookies", "/cookies", "privacy_pages", False, "all", {"nl": "Cookiebeleid", "en": "Cookie policy", "de": "Cookie-Richtlinie", "fr": "Politique de cookies", "es": "Política de cookies", "pt": "Política de cookies", "zh": "Cookie 政策", "ar": "سياسة ملفات الارتباط"}),
]
LANG_CODES = ("nl", "en", "de", "fr", "es", "pt", "zh", "ar")
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
    return _tree(Page.objects.filter(scope="public"))


def private_menu():
    """The menu of the dashboard (the header of a logged-in member): the private pages that are on."""
    return _tree(Page.objects.filter(scope="private"))


def _tree(qs):
    pages = list(qs.select_related("parent"))
    ok = {p.id: p for p in pages if available(p) and p.in_menu}

    def item(p):
        return {"id": p.id, "key": p.key, "titles": p.title, "url": p.path, "urls": {l: p.path_in(l) for l in LANG_CODES}, "new_tab": p.new_tab, "audience": p.audience, "children": []}

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


def _slugify(text):
    import unicodedata

    t = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


def has_slugs(page):
    return page.scope == "public" and page.kind in ("system", "content") and page.key != "home" and "<" not in (page.url or "")


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
