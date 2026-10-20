"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""
import json
import urllib.error
import urllib.request

from .models import Integration


def link():
    obj = Integration.objects.filter(provider="anthropic", enabled=True).first()
    return obj if obj and obj.config.get("api_key") else None


def available():
    """True when Claude is linked and switched on."""
    return link() is not None


def claude(system, prompt, max_tokens=2500, timeout=90):
    """The text Claude answers. Raises ValueError with a readable message."""
    obj = link()
    if not obj:
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    body = json.dumps({"model": obj.config.get("model") or "claude-sonnet-5-5", "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={"x-api-key": obj.config["api_key"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise ValueError(f"Claude gaf een fout (HTTP {e.code}). Controleer de koppeling en het tegoed.")
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"Geen verbinding met Claude: {e}")
    return "".join(b.get("text", "") for b in data.get("content", []))
