"""Defaults + validation spec for the security settings. Edit here to add settings."""

COMMON_GATE = {
    "enabled": False,
    "frequency": "session",      # always | session | days | once
    "days": 30,
    "show_on": "all",            # all | home
    "exclude_paths": [],
    "version": 1,                # raise to ask everybody again
}

DEFAULTS = {
    "basic": {
        "login_max_attempts": 5, "lockout_minutes": 15, "token_lifetime_hours": 168,
        "password_min_length": 8, "password_complexity": False, "security_headers": True, "hsts": True,
    },
    "geo": {
        "enabled": False, "mode": "block", "countries": [], "always_allow_ips": [], "admin_bypass": True,
        "unknown_action": "allow", "trust_country_header": False, "test_local": False,
        "texts": {
            "nl": {"title": "Niet beschikbaar in jouw land", "message": "Deze website is helaas niet beschikbaar in jouw regio."},
            "en": {"title": "Not available in your country", "message": "Unfortunately this website is not available in your region."},
        },
    },
    "age": {
        **COMMON_GATE, "min_age": 18, "deny_url": "",
        "texts": {
            "nl": {"title": "Ben je {age} jaar of ouder?", "message": "Deze website is alleen bestemd voor bezoekers van {age} jaar en ouder.",
                   "yes": "Ja, ik ben {age}+", "no": "Nee", "deny_message": "Je hebt helaas geen toegang tot deze website."},
            "en": {"title": "Are you {age} or older?", "message": "This website is only for visitors aged {age} and over.",
                   "yes": "Yes, I am {age}+", "no": "No", "deny_message": "Sorry, you cannot access this website."},
        },
    },
    "gambling": {
        **COMMON_GATE, "min_age": 24, "deny_url": "", "require_confirm": True,
        "texts": {
            "nl": {"title": "Speel bewust", "message": "Je moet minimaal {age} jaar zijn om te gokken. Gokken kan verslavend zijn.",
                   "warnings": ["Speel nooit met geld dat je nodig hebt.", "Gokken kan leiden tot verslaving.", "Zoek hulp als gokken een probleem wordt."],
                   "confirm": "Ik ben {age}+ en begrijp de risico's", "deny": "Verlaten"},
            "en": {"title": "Play responsibly", "message": "You must be at least {age} to gamble. Gambling can be addictive.",
                   "warnings": ["Never gamble with money you need.", "Gambling can lead to addiction.", "Seek help if gambling becomes a problem."],
                   "confirm": "I am {age}+ and understand the risks", "deny": "Leave"},
        },
    },
    "cookies": {
        **COMMON_GATE, "frequency": "days", "days": 365, "position": "bottom", "show_reject": True,
        "analytics": True, "marketing": True, "preferences": True,
        "texts": {
            "nl": {"title": "Cookies", "message": "Wij gebruiken cookies om de website te laten werken en te verbeteren.",
                   "accept_all": "Alles accepteren", "reject": "Alleen noodzakelijk", "settings": "Instellingen", "save": "Keuze opslaan",
                   "policy_link": "Cookiebeleid",
                   "cat_necessary": "Noodzakelijk", "cat_necessary_desc": "Nodig om de website te laten werken. Altijd aan.",
                   "cat_analytics": "Statistieken", "cat_analytics_desc": "Anoniem inzicht in het gebruik van de website.",
                   "cat_marketing": "Marketing", "cat_marketing_desc": "Om advertenties relevanter te maken.",
                   "cat_preferences": "Voorkeuren", "cat_preferences_desc": "Onthoudt je instellingen, zoals taal.",
                   "policy_title": "Cookiebeleid", "policy_body": "Hier beschrijf je welke cookies je gebruikt en waarom."},
            "en": {"title": "Cookies", "message": "We use cookies to make the website work and to improve it.",
                   "accept_all": "Accept all", "reject": "Necessary only", "settings": "Settings", "save": "Save choice",
                   "policy_link": "Cookie policy",
                   "cat_necessary": "Necessary", "cat_necessary_desc": "Required for the website to work. Always on.",
                   "cat_analytics": "Analytics", "cat_analytics_desc": "Anonymous insight into how the site is used.",
                   "cat_marketing": "Marketing", "cat_marketing_desc": "To make advertising more relevant.",
                   "cat_preferences": "Preferences", "cat_preferences_desc": "Remembers your settings, such as language.",
                   "policy_title": "Cookie policy", "policy_body": "Describe here which cookies you use and why."},
        },
    },
    "words": {"enabled": False, "lists": {}},
    "registration": {
        "enabled": False, "verify_email": True, "require_phone": False, "require_birth_date": True, "code_minutes": 15,
        "texts": {
            "nl": {"email_subject": "Bevestig je e-mailadres", "email_body": "Je bevestigingscode is {code}. Deze is {minutes} minuten geldig. Heb je geen account aangemaakt? Negeer dit bericht dan.",
                   "sms_body": "Je bevestigingscode is {code}. Geldig {minutes} min."},
            "en": {"email_subject": "Confirm your e-mail address", "email_body": "Your confirmation code is {code}. It is valid for {minutes} minutes. Did not create an account? Ignore this message.",
                   "sms_body": "Your confirmation code is {code}. Valid {minutes} min."},
        },
    },
    "email_verify": {"enabled": False},  # make every user confirm the e-mail address with a code at login
    "twofa": {
        "enabled": True, "required_for": "none", "allow_email": True, "allow_sms": False, "allow_app": False,
        "code_minutes": 10, "max_attempts": 5,
        "texts": {
            "nl": {"email_subject": "Je verificatiecode", "email_body": "Je verificatiecode is {code}. Deze is {minutes} minuten geldig. Heb je dit niet aangevraagd? Negeer dit bericht dan.",
                   "sms_body": "Je verificatiecode is {code}. Geldig {minutes} min."},
            "en": {"email_subject": "Your verification code", "email_body": "Your verification code is {code}. It is valid for {minutes} minutes. Did not request this? Ignore this message.",
                   "sms_body": "Your verification code is {code}. Valid {minutes} min."},
        },
    },
}

# Default texts in the other languages (zh, ar, pt, es, de, fr) live in i18n/<code>.json: { section: { text_key: value } }
def _load_default_texts():
    import json
    import os

    base = os.path.join(os.path.dirname(__file__), "i18n")
    if not os.path.isdir(base):
        return
    for fn in sorted(os.listdir(base)):
        if not fn.endswith(".json"):
            continue
        lang = fn[:-5]
        with open(os.path.join(base, fn), encoding="utf-8") as fh:
            data = json.load(fh)
        for section, texts in data.items():
            if section in DEFAULTS and "texts" in DEFAULTS[section] and isinstance(texts, dict):
                DEFAULTS[section]["texts"].setdefault(lang, texts)


_load_default_texts()

# Keys allowed in the per-language "texts" of each section ("warnings" is a list)
TEXT_KEYS = {
    "geo": ["title", "message"],
    "age": ["title", "message", "yes", "no", "deny_message"],
    "gambling": ["title", "message", "warnings", "confirm", "deny"],
    "twofa": ["email_subject", "email_body", "sms_body"],
    "registration": ["email_subject", "email_body", "sms_body"],
    "cookies": ["title", "message", "accept_all", "reject", "settings", "save", "policy_link", "cat_necessary",
                "cat_necessary_desc", "cat_analytics", "cat_analytics_desc", "cat_marketing", "cat_marketing_desc",
                "cat_preferences", "cat_preferences_desc", "policy_title", "policy_body"],
}

# kind: bool | ("int", lo, hi) | ("choice", [...]) | "countries" | "ips" | "paths" | "url"
SPEC = {
    "basic": {
        "login_max_attempts": ("int", 1, 20), "lockout_minutes": ("int", 1, 1440), "token_lifetime_hours": ("int", 0, 8760),
        "password_min_length": ("int", 6, 64), "password_complexity": "bool", "security_headers": "bool", "hsts": "bool",
    },
    "geo": {
        "enabled": "bool", "mode": ("choice", ["block", "allow"]), "countries": "countries", "always_allow_ips": "ips",
        "admin_bypass": "bool", "unknown_action": ("choice", ["allow", "block"]), "trust_country_header": "bool", "test_local": "bool",
    },
    **{
        gate: {
            "enabled": "bool", "frequency": ("choice", ["always", "session", "days", "once"]), "days": ("int", 1, 3650),
            "show_on": ("choice", ["all", "home"]), "exclude_paths": "paths", "version": ("int", 1, 1_000_000),
            **extra,
        }
        for gate, extra in {
            "age": {"min_age": ("int", 1, 99), "deny_url": "url"},
            "gambling": {"min_age": ("int", 1, 99), "deny_url": "url", "require_confirm": "bool"},
            "cookies": {"position": ("choice", ["bottom", "center"]), "show_reject": "bool", "analytics": "bool",
                        "marketing": "bool", "preferences": "bool"},
        }.items()
    },
    "words": {"enabled": "bool"},
    "email_verify": {"enabled": "bool"},
    "registration": {"enabled": "bool", "verify_email": "bool", "require_phone": "bool", "require_birth_date": "bool", "code_minutes": ("int", 1, 60)},
    "twofa": {
        "enabled": "bool", "required_for": ("choice", ["none", "admins", "all"]), "allow_email": "bool", "allow_sms": "bool", "allow_app": "bool",
        "code_minutes": ("int", 1, 60), "max_attempts": ("int", 1, 10),
    },
}
