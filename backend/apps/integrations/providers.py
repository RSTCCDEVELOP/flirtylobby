"""
Catalog of external systems that can be linked, with the settings each needs and a connection test.
To support a new system: add an entry to PROVIDERS and a test function.
"""
import ipaddress
import smtplib
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 10


def _http_get(url, headers):
    req = urllib.request.Request(url, headers={"User-Agent": "portal-connection-test", **headers})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return True, f"Verbinding gelukt (HTTP {res.status})."
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return False, f"Toegang geweigerd (HTTP {e.code}): controleer de sleutel."
        if e.code == 400:
            return False, "Ongeldige aanvraag (HTTP 400): de sleutel lijkt onjuist."
        if e.code == 404:
            return False, "Niet gevonden (HTTP 404): controleer ID of URL."
        return False, f"Onverwacht antwoord (HTTP {e.code})."
    except Exception as e:
        return False, f"Geen verbinding: {e}"


def test_anthropic(c):
    if not c.get("api_key"):
        return False, "API-sleutel ontbreekt."
    return _http_get("https://api.anthropic.com/v1/models", {"x-api-key": c["api_key"], "anthropic-version": "2023-06-01"})


def test_openai(c):
    if not c.get("api_key"):
        return False, "API-sleutel ontbreekt."
    return _http_get("https://api.openai.com/v1/models", {"Authorization": f"Bearer {c['api_key']}"})


def test_stripe(c):
    """A full key can read the balance. A restricted key (rk_…) only has the rights its owner ticked, so we try the endpoints a shop or
    donations need (payments, checkout) and say which right is missing when none works."""
    key = (c.get("secret_key") or "").strip()
    if not key:
        return False, "Secret key ontbreekt."
    if key.startswith("pk_"):
        return False, "Dit is een publiceerbare sleutel (pk_…). Gebruik de geheime sleutel (sk_…) of een beperkte sleutel (rk_…)."
    head = {"Authorization": f"Bearer {key}"}
    denied = ""
    for path, what in (("balance", ""), ("payment_intents?limit=1", "beperkte sleutel: betalingen mogen gelezen worden"), ("checkout/sessions?limit=1", "beperkte sleutel: Checkout mag gelezen worden")):
        ok, msg = _http_get(f"https://api.stripe.com/v1/{path}", head)
        if ok:
            return True, f"Verbinding gelukt{f' ({what})' if what else ''}."
        if "HTTP 403" in msg:
            denied = "Deze sleutel mag niets lezen van saldo, betalingen of Checkout. Zet in Stripe (Ontwikkelaars → API-sleutels → beperkte sleutel) minstens 'PaymentIntents' of 'Checkout Sessions' op lezen/schrijven."
            continue
        return False, msg
    return False, denied or "Toegang geweigerd: controleer de sleutel."


def test_elevenlabs(c):
    key = (c.get("api_key") or "").strip()
    if not key:
        return False, "API-sleutel ontbreekt."
    ok, msg = _http_get("https://api.elevenlabs.io/v1/models", {"xi-api-key": key})
    if ok or "HTTP 401" in msg or "HTTP 403" not in msg:
        return ok, msg
    # a key limited to some rights may not read the models list: the user endpoint tells whether the key itself is valid
    return _http_get("https://api.elevenlabs.io/v1/user/subscription", {"xi-api-key": key})


def test_gemini(c):
    if not c.get("api_key"):
        return False, "API-sleutel ontbreekt."
    return _http_get("https://generativelanguage.googleapis.com/v1beta/models", {"x-goog-api-key": c["api_key"]})


def test_mollie(c):
    if not c.get("api_key"):
        return False, "API-sleutel ontbreekt."
    return _http_get("https://api.mollie.com/v2/methods", {"Authorization": f"Bearer {c['api_key']}"})


def test_postmark(c):
    if not c.get("server_token"):
        return False, "Server-token ontbreekt."
    return _http_get("https://api.postmarkapp.com/server", {"X-Postmark-Server-Token": c["server_token"], "Accept": "application/json"})


def test_bird(c):
    if not c.get("access_key") or not c.get("workspace_id"):
        return False, "Access key en workspace-ID zijn verplicht."
    ws = urllib.parse.quote(c["workspace_id"].strip(), safe="")
    return _http_get(f"https://api.bird.com/workspaces/{ws}/channels", {"Authorization": f"AccessKey {c['access_key']}"})


def test_s3(c):
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    if not all(c.get(k) for k in ("bucket", "access_key", "secret_key")):
        return False, "Bucket, access key en secret key zijn verplicht."
    endpoint = (c.get("endpoint") or "").strip() or None
    if endpoint:
        parsed = urllib.parse.urlparse(endpoint)
        host = parsed.hostname
        if parsed.scheme not in ("http", "https") or not host or "." not in host:
            return False, "Het endpoint moet een volledig adres zijn, bv. https://ams3.digitaloceanspaces.com (niet de naam van de bucket)."
        if not _is_public_host(host):
            return False, "Alleen publieke endpoints zijn toegestaan."
    try:
        client = boto3.client(
            "s3", endpoint_url=endpoint, region_name=c.get("region") or "us-east-1",
            aws_access_key_id=c["access_key"], aws_secret_access_key=c["secret_key"],
            config=Config(connect_timeout=TIMEOUT, read_timeout=TIMEOUT, retries={"max_attempts": 1}),
        )
        client.head_bucket(Bucket=c["bucket"])
        return True, "Bucket bereikbaar."
    except ClientError as e:
        code = str(e.response.get("Error", {}).get("Code", ""))
        if code in ("404", "NoSuchBucket"):
            return False, "Bucket niet gevonden: controleer naam en regio."
        if code in ("403", "AccessDenied", "SignatureDoesNotMatch", "InvalidAccessKeyId"):
            return False, "Toegang geweigerd: controleer de sleutels en rechten."
        if code == "400":
            return False, "Ongeldige aanvraag: controleer regio en endpoint."
        return False, f"S3-fout: {code or e}"
    except Exception as e:
        return False, f"Geen verbinding: {e}"


def test_smtp(c):
    host, security = c.get("host"), c.get("security", "starttls")
    if not host:
        return False, "Server ontbreekt."
    try:
        port = int(c.get("port") or (465 if security == "ssl" else 587))
        smtp = smtplib.SMTP_SSL(host, port, timeout=TIMEOUT) if security == "ssl" else smtplib.SMTP(host, port, timeout=TIMEOUT)
        with smtp:
            if security == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if c.get("username"):
                smtp.login(c["username"], c.get("password", ""))
            else:
                smtp.noop()
        return True, "Verbinding en inloggen gelukt."
    except smtplib.SMTPAuthenticationError:
        return False, "Inloggen geweigerd: controleer gebruikersnaam en wachtwoord."
    except Exception as e:
        return False, f"Geen verbinding: {e}"


def _is_public_host(host):
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False


def test_custom(c):
    base = (c.get("base_url") or "").strip()
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False, "Ongeldige URL (gebruik https://...)."
    if not _is_public_host(parsed.hostname):
        return False, "Alleen publieke adressen zijn toegestaan."
    headers = {}
    if c.get("api_key"):
        headers[c.get("header_name") or "Authorization"] = c["api_key"]
    return _http_get(base.rstrip("/") + "/" + (c.get("test_path") or "").lstrip("/"), headers)


def test_google_login(c):
    cid = (c.get("client_id") or "").strip()
    if not cid.endswith(".apps.googleusercontent.com"):
        return False, "Dit lijkt geen Google Client-ID (het eindigt op .apps.googleusercontent.com)."
    return True, "Client-ID ziet er goed uit. Zet bij Google Cloud je websiteadres bij 'Geautoriseerde JavaScript-bronnen'."


def test_apple_login(c):
    cid = (c.get("client_id") or "").strip()
    if not cid or " " in cid or "." not in cid:
        return False, "Vul de Services-ID in (bijvoorbeeld com.jouwbedrijf.web)."
    return True, "Services-ID ingevuld. Zet bij Apple de domeinnaam en de terugkeer-URL van je website bij deze Services-ID."


def f(key, label, kind="text", secret=False, default="", options=None, required=True):
    return {"key": key, "label": label, "type": kind, "secret": secret, "default": default,
            "options": options, "required": required}


def model_field(default, options):
    """A model choice: pick from the list (or fetch the live list from the provider), or type any model ID."""
    return f("model", "Model", kind="model", default=default, required=False, options=[{"value": v, "label": l} for v, l in options])


PROVIDERS = {
    "anthropic": {"label": "Claude (Anthropic)", "test": test_anthropic, "fields": [f("api_key", "API-sleutel", secret=True), model_field("claude-sonnet-5-5", [
        ("claude-fable-5-1", "Claude Fable 5.1"), ("claude-opus-5-5", "Claude Opus 5.5"), ("claude-sonnet-5-5", "Claude Sonnet 5.5"), ("claude-haiku-5-5", "Claude Haiku 5.5")])]},
    "gemini": {"label": "Gemini (Google)", "test": test_gemini, "fields": [f("api_key", "API-sleutel", secret=True), model_field("gemini-2.5-flash", [
        ("gemini-2.5-pro", "Gemini 2.5 Pro"), ("gemini-2.5-flash", "Gemini 2.5 Flash"), ("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite")])]},
    "openai": {"label": "OpenAI", "test": test_openai, "fields": [f("api_key", "API-sleutel", secret=True), model_field("gpt-4o", [
        ("gpt-4o", "GPT-4o"), ("gpt-4o-mini", "GPT-4o mini"), ("o3", "o3"), ("o4-mini", "o4-mini")])]},
    "elevenlabs": {"label": "ElevenLabs (stem en audio)", "test": test_elevenlabs, "fields": [f("api_key", "API-sleutel", secret=True), model_field("eleven_multilingual_v2", [
        ("eleven_multilingual_v2", "Multilingual v2"), ("eleven_flash_v2_5", "Flash v2.5 (snel)"), ("eleven_turbo_v2_5", "Turbo v2.5"), ("eleven_v3", "Eleven v3")]),
        f("voice_id", "Standaardstem (voice-ID, optioneel)", required=False)]},
    "s3": {"label": "S3-opslag", "test": test_s3, "fields": [
        f("bucket", "Bucket"), f("region", "Regio", default="eu-west-1"),
        f("endpoint", "Endpoint (alleen voor S3-compatibel, bv. Hetzner/Scaleway)", required=False),
        f("access_key", "Access key"), f("secret_key", "Secret key", secret=True),
        f("public_url", "Publieke URL (bucket-URL of CDN, optioneel)", required=False),
        f("prefix", "Map in de bucket (optioneel, bv. site)", required=False),
        f("encryption_key", "Hoofdsleutel", secret=True, required=False)]},
    "stripe": {"label": "Stripe", "test": test_stripe, "fields": [f("secret_key", "Secret key", secret=True)]},
    "mollie": {"label": "Mollie", "test": test_mollie, "fields": [f("api_key", "API-sleutel (live_ of test_)", secret=True)]},
    "postmark": {"label": "Postmark", "test": test_postmark, "fields": [f("server_token", "Server-token", secret=True), f("from_email", "Afzender (e-mailadres, gevalideerd bij Postmark)", required=False)]},
    "bird": {"label": "Bird", "test": test_bird, "fields": [f("workspace_id", "Workspace-ID"), f("access_key", "Access key", secret=True), f("sms_channel_id", "SMS-kanaal-ID (voor het versturen van codes)", required=False)]},
    "smtp": {"label": "E-mail (SMTP)", "test": test_smtp, "fields": [
        f("host", "Server"), f("port", "Poort", default="587"),
        f("security", "Beveiliging", kind="select", default="starttls",
          options=[{"value": "starttls", "label": "STARTTLS"}, {"value": "ssl", "label": "SSL/TLS"}, {"value": "none", "label": "Geen"}]),
        f("username", "Gebruikersnaam", required=False), f("password", "Wachtwoord", secret=True, required=False),
        f("from_email", "Afzender (e-mailadres)", required=False)]},
    "google_login": {"label": "Inloggen met Google", "test": test_google_login, "fields": [f("client_id", "Client-ID (Google Cloud, type Webapplicatie)")]},
    "apple_login": {"label": "Inloggen met Apple", "test": test_apple_login, "fields": [f("client_id", "Services-ID (Apple Developer, Identifiers)")]},
    "custom": {"label": "Eigen API", "test": test_custom, "fields": [
        f("base_url", "Basis-URL"), f("test_path", "Testpad (optioneel)", required=False),
        f("header_name", "Headernaam", default="Authorization", required=False), f("api_key", "Sleutel/token", secret=True, required=False)]},
}


def catalog():
    return [{"provider": k, "label": v["label"], "fields": v["fields"]} for k, v in PROVIDERS.items()]


# ── live model lists (the "Modellen ophalen" button) ─────────────────────────
def _get_json(url, headers):
    import json

    req = urllib.request.Request(url, headers={"User-Agent": "portal-connection-test", **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        return json.loads(res.read())


def list_models(provider, c):
    """[{value, label}] of the models this key may use. Raises ValueError with a readable message."""
    key = (c.get("api_key") or "").strip()
    if not key:
        raise ValueError("Vul eerst de API-sleutel in (of sla de koppeling op).")
    try:
        if provider == "anthropic":
            d = _get_json("https://api.anthropic.com/v1/models?limit=100", {"x-api-key": key, "anthropic-version": "2023-06-01"})
            return [{"value": m["id"], "label": m.get("display_name") or m["id"]} for m in d.get("data", [])]
        if provider == "openai":
            d = _get_json("https://api.openai.com/v1/models", {"Authorization": f"Bearer {key}"})
            skip = ("embedding", "whisper", "tts", "dall-e", "moderation", "image", "audio", "realtime", "transcribe", "davinci", "babbage")
            return [{"value": m["id"], "label": m["id"]} for m in sorted(d.get("data", []), key=lambda x: x["id"]) if not any(s in m["id"] for s in skip)]
        if provider == "gemini":
            d = _get_json(f"https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key={urllib.parse.quote(key)}", {})
            return [{"value": m["name"].split("/", 1)[-1], "label": m.get("displayName") or m["name"]} for m in d.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])]
        if provider == "elevenlabs":
            d = _get_json("https://api.elevenlabs.io/v1/models", {"xi-api-key": key})
            return [{"value": m["model_id"], "label": m.get("name") or m["model_id"]} for m in d]
    except urllib.error.HTTPError as e:
        raise ValueError("Toegang geweigerd: controleer de API-sleutel." if e.code in (401, 403) else f"Het ophalen mislukte (HTTP {e.code}).")
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"Geen verbinding: {e}")
    raise ValueError("Deze koppeling heeft geen lijst met modellen.")
