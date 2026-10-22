"""Prijzen en installatiewizard. De prijzen staan in apps/core/pricing.json (gaat mee met elke implementatie, per maand ex btw); de prijseneditor schrijft dat bestand.

`apply_to_license()` zet de prijzen ook in de licentie (btw erbij). De wizard bepaalt uit antwoorden welke modules en plugins nodig zijn en wat dat kost per maand, kwartaal en jaar."""
import json
import logging
import re
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from django.conf import settings

from . import modules

logger = logging.getLogger(__name__)
PATH = Path(settings.BASE_DIR) / "apps" / "core" / "pricing.json"
TWO = Decimal("0.01")
q2 = lambda v: Decimal(str(v)).quantize(TWO, rounding=ROUND_HALF_UP)  # noqa: E731


def load():
    return json.loads(PATH.read_text(encoding="utf-8"))


def clean(cfg):
    """A safe config from what the editor sends (only numbers in the prices, periods and base price). Raises ValueError."""
    cur = load()
    out = dict(cur)

    def num(v, lo, hi, what):
        try:
            x = float(v)
        except (TypeError, ValueError):
            raise ValueError(f"{what}: geef een getal op.")
        if not lo <= x <= hi:
            raise ValueError(f"{what}: tussen {lo} en {hi}.")
        return round(x, 2)

    if "base_price" in cfg:
        out["base_price"] = num(cfg["base_price"], 0, 10000, "Basisprijs")
    if "rst_share" in cfg:
        out["rst_share"] = num(cfg["rst_share"], 0, 100, "Aandeel RST")
    if "vat_rate" in cfg:
        out["vat_rate"] = num(cfg["vat_rate"], 0, 50, "Btw")
    if isinstance(cfg.get("periods"), dict):
        out["periods"] = {k: {**cur["periods"][k], "discount": num((cfg["periods"].get(k) or {}).get("discount", cur["periods"][k]["discount"]), 0, 90, f"Korting {k}")} for k in cur["periods"]}
    if isinstance(cfg.get("items"), dict):
        items = dict(cur["items"])
        for k, v in cfg["items"].items():
            if k.split(":")[0] in ("module", "package", "plugin") and ":" in k and len(k) < 80:
                items[k] = num(v, 0, 10000, k)
        out["items"] = items
    ch = cfg.get("hosting")
    if isinstance(ch, dict):
        h = json.loads(json.dumps(cur.get("hosting") or {}))
        for k, lo, hi in (("usd_eur", 0.1, 10), ("markup", 0, 500)):
            if k in ch:
                h[k] = num(ch[k], lo, hi, k)
        if isinstance(ch.get("default"), str) and any(o["key"] == ch["default"] for o in h.get("options", [])):
            h["default"] = ch["default"]
        for o in h.get("options", []):
            co = (ch.get("options") or {}).get(o["key"])
            if isinstance(co, dict):
                for k in ("price", "do_usd"):
                    if k in co and k in o:
                        o[k] = num(co[k], 0, 10000, k)
        out["hosting"] = h
    ce = cfg.get("email")
    if isinstance(ce, dict):
        e = json.loads(json.dumps(cur.get("email") or {}))
        if "max" in ce:
            e["max"] = int(num(ce["max"], 1, 100000, "Maximum adressen"))
        if isinstance(ce.get("tiers"), list):
            tiers = [{"from": int(num(t.get("from"), 1, 100000, "Vanaf")), "price": num(t.get("price"), 0, 1000, "Prijs per adres")} for t in ce["tiers"] if isinstance(t, dict) and t.get("from") not in (None, "")][:8]
            if tiers:
                e["tiers"] = sorted(tiers, key=lambda t: t["from"])
        out["email"] = e
    imp = dict(cur.get("implementation") or {})
    ci = cfg.get("implementation")
    if isinstance(ci, dict):
        for k in ("hourly_rate", "design_hours", "setup_hours"):
            if k in ci:
                imp[k] = num(ci[k], 0, 10000, k)
        if isinstance(ci.get("items"), dict):
            imp["items"] = {**imp.get("items", {}), **{k: num(v, 0, 1000, k) for k, v in ci["items"].items() if k.split(":")[0] in ("module", "package", "plugin") and ":" in k and len(k) < 80}}
    out["implementation"] = imp
    return out


def save(cfg):
    PATH.write_text(json.dumps(clean(cfg), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.warning("Pricing saved")
    return load()


def hosting_options():
    """The hosting choices with their price per month ex VAT: a fixed price, or the DigitalOcean price (USD) x rate + markup, rounded up to x.95 and capped at 35."""
    h = load().get("hosting") or {}
    out = []
    for o in h.get("options", []):
        if "price" in o:
            price = Decimal(str(o["price"]))
        else:
            raw = Decimal(str(o["do_usd"])) * Decimal(str(h.get("usd_eur", 1))) * (100 + Decimal(str(h.get("markup", 0)))) / 100
            price = min(Decimal(35), Decimal(int(raw)) + Decimal("0.95") if raw % 1 <= Decimal("0.95") else Decimal(int(raw) + 1) + Decimal("0.95"))
        cost = q2(Decimal(str(o["do_usd"])) * Decimal(str(h.get("usd_eur", 1)))) if o.get("do_usd") is not None else q2(Decimal(str(o.get("cost", 0))))  # what the server costs us (DigitalOcean in EUR, or the own cost of shared)
        out.append({"key": o["key"], "label": o["label"], "desc": o.get("desc", ""), "price": str(q2(price)), "do_usd": o.get("do_usd"), "cost": str(cost), "profit": str(q2(price - cost)), "margin_pct": float(q2((price - cost) / price * 100)) if price else 0})
    return out


def email_config():
    return load().get("email") or {}


def email_price(count):
    """(price per month, {addresses, per_address}) for this number of e-mail addresses: the price per address depends on the step (the more, the lower)."""
    cfg = email_config()
    try:
        n = max(0, min(int(count or 0), int(cfg.get("max", 200))))
    except (TypeError, ValueError):
        n = 0
    if not n:
        return Decimal(0), None
    per = Decimal(0)
    for t in sorted(cfg.get("tiers", []), key=lambda x: x["from"]):
        if n >= t["from"]:
            per = Decimal(str(t["price"]))
    return q2(per * n), {"addresses": n, "per_address": str(q2(per))}


def hosting_price(key):
    opts = {o["key"]: o for o in hosting_options()}
    o = opts.get(key) or opts.get((load().get("hosting") or {}).get("default", "shared"))
    return (Decimal(o["price"]), o) if o else (Decimal(0), None)


def catalog():
    """Everything that has a price: [{key, label, group, price}] (modules, packages, plugins), with the labels of the system."""
    from apps.plugins.models import Plugin

    items = load()["items"]
    out = [{"key": f"package:{p['key']}", "label": p["label"], "group": "Pakketten", "price": items.get(f"package:{p['key']}", 0)} for p in modules.PACKAGES]
    in_pkg = {k for p in modules.PACKAGES for k in p["modules"]}
    out += [{"key": f"module:{m['key']}", "label": m["label"], "group": "Modules", "price": items.get(f"module:{m['key']}", 0)} for m in modules.MODULES if m["key"] not in in_pkg and not m.get("core")]
    out += [{"key": f"plugin:{p.name}", "label": p.title or p.name, "group": "Plugins", "price": items.get(f"plugin:{p.name}", 0)} for p in Plugin.objects.order_by("name")]
    return out


def price_of(module_keys, plugin_names, hosting=None, email=None):
    """(per month ex VAT, [lines]) for these modules and plugins: base price + packages in use + single modules + plugins."""
    cfg = load()
    items, lines = cfg["items"], []
    total = Decimal(str(cfg["base_price"]))
    lines.append({"label": "Basis (website, bewerkmodus, media, thema's, talen, beveiliging, back-ups)", "price": str(q2(total))})
    mods = set(module_keys)
    for p in modules.PACKAGES:
        if mods & set(p["modules"]):
            pr = Decimal(str(items.get(f"package:{p['key']}", 0)))
            total += pr
            lines.append({"label": p["label"], "price": str(q2(pr))})
    in_pkg = {k for p in modules.PACKAGES for k in p["modules"]}
    for k in sorted(mods - in_pkg):
        pr = Decimal(str(items.get(f"module:{k}", 0)))
        if pr:
            total += pr
            lines.append({"label": modules.BY_KEY[k]["label"], "price": str(q2(pr))})
    from apps.plugins.models import Plugin

    titles = {p.name: p.title or p.name for p in Plugin.objects.all()}
    for n in sorted(set(plugin_names)):
        pr = Decimal(str(items.get(f"plugin:{n}", 0)))
        if pr:
            total += pr
            lines.append({"label": titles.get(n, n), "price": str(q2(pr))})
    hp, ho = hosting_price(hosting)
    if ho:
        total += hp
        lines.append({"label": "Hosting: " + ho["label"], "price": str(q2(hp))})
    ep, eo = email_price(email)
    if eo and ep > 0:
        total += ep
        lines.append({"label": f"E-mail: {eo['addresses']} adressen à € {eo['per_address']}", "price": str(q2(ep))})
    return q2(total), lines


def periods(monthly, hosting_monthly=0, hosting_cost=0):
    """What it costs per period (ex VAT and incl. VAT): the longer you commit, the lower the price. [{key, label, months, discount, price, per_month, vat_price}]"""
    cfg, out = load(), []
    for k, p in cfg["periods"].items():
        per_month = q2(monthly * (Decimal(100) - Decimal(str(p["discount"]))) / 100)
        price = q2(per_month * p["months"])
        share = Decimal(str(cfg.get("rst_share", 0)))
        soft = q2((monthly - Decimal(str(hosting_monthly))) * (Decimal(100) - Decimal(str(p["discount"]))) / 100 * p["months"])  # the share of RST counts over the software, not the hosting
        cost = q2(soft * share / 100)  # what goes to RST for the use of Easy2edit (the purchase price of the reseller)
        out.append({"key": k, "label": p["label"], "months": p["months"], "discount": p["discount"], "per_month": str(per_month), "price": str(price), "price_incl_vat": str(q2(price * (Decimal(100) + Decimal(str(cfg["vat_rate"]))) / 100)),
                    "purchase": str(cost), "purchase_per_month": str(q2(cost / p["months"])), "hosting_cost": str(q2(Decimal(str(hosting_cost)) * (Decimal(100) - Decimal(str(p["discount"]))) / 100 * p["months"])), "hosting_profit": str(q2((Decimal(str(hosting_monthly)) - Decimal(str(hosting_cost))) * (Decimal(100) - Decimal(str(p["discount"]))) / 100 * p["months"])), "margin": str(price - cost), "rst_share": float(share)})
    return out


def implementation(module_keys, plugin_names):
    """Estimate of the one-time costs for design and implementation (ex VAT): hours x hourly rate. {hours, rate, price, price_incl_vat, lines}"""
    cfg = load()
    imp = cfg.get("implementation") or {}
    rate = Decimal(str(imp.get("hourly_rate", 0)))
    items = imp.get("items", {})
    lines = [{"label": "Ontwerp (design): kleuren, logo, indeling en teksten", "hours": float(imp.get("design_hours", 0))}, {"label": "Installatie en inrichting (domeinnaam, hosting, instellingen)", "hours": float(imp.get("setup_hours", 0))}]
    mods = set(module_keys)
    from apps.plugins.models import Plugin

    titles = {p.name: p.title or p.name for p in Plugin.objects.all()}
    for p in modules.PACKAGES:
        if mods & set(p["modules"]) and items.get(f"package:{p['key']}"):
            lines.append({"label": p["label"], "hours": float(items[f"package:{p['key']}"])})
    in_pkg = {k for p in modules.PACKAGES for k in p["modules"]}
    for k in sorted(mods - in_pkg):
        if items.get(f"module:{k}"):
            lines.append({"label": modules.BY_KEY[k]["label"], "hours": float(items[f"module:{k}"])})
    for n in sorted(set(plugin_names)):
        if items.get(f"plugin:{n}"):
            lines.append({"label": titles.get(n, n), "hours": float(items[f"plugin:{n}"])})
    hours = sum(l["hours"] for l in lines)
    price = q2(Decimal(str(hours)) * rate)
    return {"hours": hours, "rate": str(rate), "price": str(price), "price_incl_vat": str(q2(price * (Decimal(100) + Decimal(str(cfg["vat_rate"]))) / 100)), "lines": lines, "note": imp.get("note", "")}


def plan_of(module_keys, plugin_names, hosting=None, email=None):
    """Price per month/quarter/year and the estimate for design and implementation, for a set of modules and plugins and a hosting choice."""
    monthly, lines = price_of(module_keys, plugin_names, hosting, email)
    hp, ho = hosting_price(hosting)
    ep, eo = email_price(email)
    return {"monthly": str(monthly), "lines": lines, "periods": periods(monthly, hp + ep, Decimal(ho["cost"]) if ho else 0), "implementation": implementation(module_keys, plugin_names), "includes": load().get("includes", ""), "hosting": ho["key"] if ho else ""}


def plan(answers):
    """From the answers of the wizard: the modules and plugins that are needed, and the price. answers = {key: bool}."""
    cfg = load()
    on = {q["key"] for q in cfg["wizard"] if q.get("type") != "choice" and answers.get(q["key"])}
    changed = True
    while changed:  # an answer that needs another one (messages need members)
        changed = False
        for q in cfg["wizard"]:
            if q["key"] in on and any(r not in on for r in q.get("requires", [])):
                on |= set(q["requires"])
                changed = True
    mods, plugs = set(cfg["base_modules"]), set()
    for q in cfg["wizard"]:
        if q["key"] in on:
            mods |= set(q.get("modules", []))
            plugs |= set(q.get("plugins", []))
    mods = {m for m in mods if m in modules.BY_KEY}
    from . import presets

    want = presets._wanted_modules({"modules": sorted(mods)})  # what these modules need themselves
    return {"modules": sorted(want), "plugins": sorted(plugs), "answers": sorted(on), **plan_of(want, plugs, answers.get("hosting"), answers.get("email"))}


def apply_to_license():
    """The prices of pricing.json into the licence (Super admin -> Licentie): base price and the price of every component, incl. VAT."""
    from .models import ComponentPrice, License

    cfg = load()
    vat = Decimal(100 + Decimal(str(cfg["vat_rate"]))) / 100
    lic, _ = License.objects.get_or_create(pk=1)
    lic.base_price = q2(Decimal(str(cfg["base_price"])) * vat)
    lic.save(update_fields=["base_price"])
    for k, v in cfg["items"].items():
        kind, _, key = k.partition(":")
        price = q2(Decimal(str(v)) * vat)
        if price > 0:
            ComponentPrice.objects.update_or_create(kind=kind, key=key, defaults={"price": price})
        else:
            ComponentPrice.objects.filter(kind=kind, key=key).delete()


# ── AI-calculatie ──────────────────────────────────────────────────────────────────────────────────────────────────
POSITIONS = {"budget": "goedkoop: scherp onder de markt", "market": "marktconform: gelijk aan de markt", "premium": "premium: duurder dan de markt, met extra service en kwaliteit"}


def editable(cfg):
    """The numbers the AI may change: {key: value}."""
    out = {"base_price": cfg["base_price"], "discount_quarter": cfg["periods"]["quarter"]["discount"], "discount_year": cfg["periods"]["year"]["discount"], "hourly_rate": cfg["implementation"]["hourly_rate"], "hosting_markup": cfg["hosting"]["markup"]}
    out.update({k: v for k, v in cfg["items"].items()})
    out.update({f"email_tier_{t['from']}": t["price"] for t in cfg["email"]["tiers"]})
    out.update({f"hosting_{o['key']}": o["price"] for o in cfg["hosting"]["options"] if "price" in o})
    return out


def apply_values(cfg, values):
    """Put the accepted values into a copy of the config. Unknown keys are ignored. Returns (new config, number of changes)."""
    new, n = json.loads(json.dumps(cfg)), 0

    def put(container, key, v):
        nonlocal n
        try:
            v = round(float(v), 2)
        except (TypeError, ValueError):
            return
        if container.get(key) != v and v >= 0:
            container[key] = v
            n += 1

    for k, v in (values or {}).items():
        if k == "base_price":
            put(new, "base_price", v)
        elif k == "discount_quarter":
            put(new["periods"]["quarter"], "discount", min(float(v), 60))
        elif k == "discount_year":
            put(new["periods"]["year"], "discount", min(float(v), 60))
        elif k == "hourly_rate":
            put(new["implementation"], "hourly_rate", v)
        elif k == "hosting_markup":
            put(new["hosting"], "markup", v)
        elif k in new["items"]:
            put(new["items"], k, v)
        elif k.startswith("email_tier_"):
            for t in new["email"]["tiers"]:
                if f"email_tier_{t['from']}" == k:
                    put(t, "price", v)
        elif k.startswith("hosting_"):
            for o in new["hosting"]["options"]:
                if f"hosting_{o['key']}" == k and "price" in o:
                    put(o, "price", v)
    return new, n


def ai_proposal(answers):
    """Ask Claude for a price proposal given the position in the market. Returns {values, reasons, summary, market}."""
    from apps.integrations import ai

    cfg = load()
    cur = editable(cfg)
    pos = POSITIONS.get(answers.get("position"), POSITIONS["market"])
    system = ("Je bent een prijsadviseur voor een Nederlandse aanbieder van websites (CMS) met hosting en e-mail. Antwoord ALLEEN met geldige JSON: "
              '{"summary": "korte uitleg in het Nederlands", "market": [{"name": "...", "price": "...", "note": "..."}], "values": {"<sleutel>": <getal>}, "reasons": {"<sleutel>": "waarom"}}. '
              "Gebruik alleen sleutels uit de lijst met huidige waarden. Alle bedragen per maand in euro ex btw (kortingen en opslag in procenten). Verzin geen bronnen: noem de concurrenten die je kent (zoals Wix, Squarespace, Shopify, WordPress.com, Webflow, Ghost, Strapi Cloud, Transip, Hostnet, Antagonist, DigitalOcean) met hun ongeveer prijzen en zeg dat het een inschatting is.")
    prompt = (f"Gewenste positie: {pos}.\nDoelgroep: {answers.get('audience') or 'midden- en kleinbedrijf'}.\nGewenste winstmarge op hosting en inkoop: minimaal {answers.get('margin') or 25}%.\n"
              f"Inkoop: {cfg.get('rst_share', 0)}% van de softwareprijs gaat naar RST; hosting-inkoop is DigitalOcean (USD x {cfg['hosting']['usd_eur']}).\n"
              f"Opmerkingen: {answers.get('notes') or '-'}\n\nHuidige waarden:\n{json.dumps(cur, ensure_ascii=False)}\n\nStel nieuwe waarden voor voor wat anders moet, en laat de rest weg.")
    text = ai.claude(system, prompt, max_tokens=3000)
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("De AI gaf geen bruikbaar antwoord. Probeer het nog eens.")
    try:
        data = json.loads(m.group(0))
    except ValueError:
        raise ValueError("De AI gaf geen bruikbaar antwoord. Probeer het nog eens.")
    values = {k: v for k, v in (data.get("values") or {}).items() if k in cur and isinstance(v, (int, float)) and v >= 0}
    return {"summary": str(data.get("summary") or "")[:1500], "market": [{k: str(x.get(k, ""))[:120] for k in ("name", "price", "note")} for x in (data.get("market") or []) if isinstance(x, dict)][:12],
            "values": values, "reasons": {k: str(v)[:200] for k, v in (data.get("reasons") or {}).items() if k in values}, "current": {k: cur[k] for k in values}}


# ── installatieconfiguratie ───────────────────────────────────────────────────────────────────────────────────────────
CUSTOMER_KEYS = ("company", "first_name", "last_name", "contact", "email", "phone", "mobile", "street", "postal_code", "city", "country", "kvk", "vat_id")


RESELLER_KEYS = CUSTOMER_KEYS[:2] + ("last_name", "email", "phone", "mobile", "street", "postal_code", "city", "country", "website", "kvk", "vat_id")


def reseller_of(d):
    """The reseller (seller) of the installation: what the wizard sends, completed with the defaults (Studio2) from pricing.json."""
    base = load().get("reseller") or {}
    sent = d.get("reseller") if isinstance(d.get("reseller"), dict) else {}
    out = {k: str(sent.get(k, base.get(k, "")) or "").strip()[:200] for k in RESELLER_KEYS}
    out["contact"] = " ".join(x for x in (out["first_name"], out["last_name"]) if x)
    return out


def build_config(d):
    """The configuration of an installation as one JSON document: customer, website, answers, modules, plugins, hosting, e-mail and prices. Used by apply_config (also later, on another server)."""
    from django.utils import timezone

    answers = {k: (v if k in ("hosting", "email") else bool(v)) for k, v in (d.get("answers") or {}).items()}
    plan = globals()["plan"](answers)
    cu = {k: str(((d.get("customer") or {}).get(k)) or "").strip()[:200] for k in CUSTOMER_KEYS}
    cu["contact"] = (" ".join(x for x in (cu["first_name"], cu["last_name"]) if x)) or cu["contact"]
    period = d.get("period") if d.get("period") in ("month", "quarter", "year") else "year"
    ho = hosting_price(answers.get("hosting"))[1]
    return {"format": "easy2edit-install", "version": 1, "created_at": timezone.now().isoformat(timespec="seconds"), "customer": cu, "reseller": reseller_of(d),
            "site": {"name": str(d.get("site_name") or "").strip()[:100], "language": d.get("lang") if d.get("lang") in ("nl", "en", "de", "fr", "es") else "nl", "theme": "easy2edit"},
            "answers": answers, "modules": plan["modules"], "plugins": plan["plugins"], "hosting": {"choice": ho["key"] if ho else "", "label": ho["label"] if ho else ""},
            "email": {"addresses": int(answers.get("email") or 0)}, "licence": {"period": period, "months": {"month": 1, "quarter": 3, "year": 12}[period]},
            "prices": {"currency": "EUR", "ex_vat": True, "monthly": plan["monthly"], "periods": [{k: p[k] for k in ("key", "months", "discount", "per_month", "price", "price_incl_vat")} for p in plan["periods"]],
                       "implementation": plan["implementation"]["price"], "lines": plan["lines"]}}


def apply_config(cfg):
    """Set the system up from a configuration document: modules and plugins, names and address, the licence. Returns what happened."""
    from . import presets, system
    from .models import License

    if cfg.get("format") != "easy2edit-install":
        raise ValueError("Dit is geen installatieconfiguratie van Easy2edit.")
    cu, site = cfg.get("customer") or {}, cfg.get("site") or {}
    result = presets.apply("wizard", {"modules": cfg.get("modules") or [], "plugins": cfg.get("plugins") or [], "theme": "normal"})
    address = ", ".join(x for x in (cu.get("street"), " ".join(x for x in (cu.get("postal_code"), cu.get("city")) if x), cu.get("country")) if x)
    data = {"site_name": site.get("name", ""), "company_name": cu.get("company", ""), "contact_email": cu.get("email", ""), "phone": cu.get("mobile") or cu.get("phone", ""), "address": address, "kvk": cu.get("kvk", ""), "vat_id": cu.get("vat_id", "")}
    system.save({k: v for k, v in data.items() if v})
    lic, _ = License.objects.get_or_create(pk=1)
    lic.client = cu.get("company") or cu.get("contact") or lic.client
    lic.client_address = address[:300]
    lic.renew_months = (cfg.get("licence") or {}).get("months", 1)
    rs = cfg.get("reseller") or {}
    lic.reseller_name = (rs.get("company") or rs.get("contact") or lic.reseller_name)[:120]
    lic.reseller_email = rs.get("email") or lic.reseller_email
    lic.reseller_url = (rs.get("website") or lic.reseller_url)[:300]
    lic.save(update_fields=["client", "client_address", "renew_months", "reseller_name", "reseller_email", "reseller_url"])
    apply_to_license()
    return {"modules_on": result["modules_on"], "plugins_on": result["plugins_on"], "plugins_missing": result["plugins_missing"]}
