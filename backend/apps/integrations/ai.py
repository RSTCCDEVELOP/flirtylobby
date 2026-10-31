# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""
import json
import time
import urllib.error
import urllib.request

from . import aiusage
from .models import Integration


def link():
    try:  # someone who works in the own system of an admin uses the own AI link of that admin
        user = aiusage.current_user()
        if aiusage.uses_tenant(user):
            own, _ = aiusage.tenant_links()
            if own:
                return own
    except Exception:  # noqa: BLE001
        pass
    obj = Integration.objects.filter(provider="anthropic", enabled=True).order_by("-superadmin_only", "id").first()  # AI always runs on an Easy2edit link of the superadmin when there is one
    return obj if obj and obj.config.get("api_key") else None


def available():
    """True when Claude is linked and switched on."""
    return link() is not None


def body_model(body):
    try:
        return json.loads(body).get("model", "")
    except Exception:  # noqa: BLE001
        return ""


def claude(system, prompt, max_tokens=2500, timeout=90, web=False, images=None):
    """The text Claude answers. images = [(media_type, base64 data)] are sent along with the prompt. Raises ValueError with a readable message."""
    obj = link()
    if not obj:
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    aiusage.gate(obj.config.get("model") or "claude-sonnet-5-5", (system, prompt), max_tokens, len(images or []))  # is there enough credit for this call? (when credit is required); if not, nothing is sent
    content = ([{"type": "image", "source": {"type": "base64", "media_type": mt, "data": data}} for mt, data in images] + [{"type": "text", "text": prompt}]) if images else prompt
    payload = {"model": obj.config.get("model") or "claude-sonnet-5-5", "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": content}]}
    if web:  # Claude searches the internet itself (the web search tool of Anthropic)
        payload["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}]
    body = json.dumps(payload).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={"x-api-key": obj.config["api_key"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
    from apps.plugins.facade import stats

    purpose = " ".join(str(system or "").split()[:6])[:60]
    started, mdl, nimg = time.time(), body_model(body), len(images or [])
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        stats.record("ai", "call", body_model(body)), stats.record("ai", "error", f"HTTP {e.code}")
        aiusage.record(mdl, None, started, False, f"HTTP {e.code}", web, nimg, system)
        raise ValueError(f"Claude gaf een fout (HTTP {e.code}). Controleer de koppeling en het tegoed.")
    except Exception as e:  # noqa: BLE001
        stats.record("ai", "call", body_model(body)), stats.record("ai", "error", "verbinding")
        aiusage.record(mdl, None, started, False, "verbinding", web, nimg, system)
        raise ValueError(f"Geen verbinding met Claude: {e}")
    usage = data.get("usage") or {}
    aiusage.record(mdl, usage, started, True, "", web, nimg, system)
    stats.record("ai", "call", body_model(body))
    stats.record("ai", "purpose", purpose)
    stats.record("ai", "tokens_in", body_model(body), int(usage.get("input_tokens") or 0))
    stats.record("ai", "tokens_out", body_model(body), int(usage.get("output_tokens") or 0))
    return "".join(b.get("text", "") for b in data.get("content", []))


def claude_stream(system, prompt, max_tokens=4000, timeout=300, web=False, on_event=None):
    """Like claude(), but streamed so the caller can show what happens: on_event(kind, text) with kind "search" (a web search: the query), "found" (results came in) and "write" (the answer is being written).
    Returns the text. Raises ValueError with a readable message."""
    obj = link()
    if not obj:
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    aiusage.gate(obj.config.get("model") or "claude-sonnet-5-5", (system, prompt), max_tokens, 0)
    payload = {"model": obj.config.get("model") or "claude-sonnet-5-5", "max_tokens": max_tokens, "system": system, "stream": True, "messages": [{"role": "user", "content": prompt}]}
    if web:
        payload["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}]
    body = json.dumps(payload).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={"x-api-key": obj.config["api_key"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
    from apps.plugins.facade import stats

    emit = on_event or (lambda *_a: None)
    started, mdl = time.time(), body_model(body)
    text, kinds, partial, usage = [], {}, {}, {}
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            for raw in res:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    ev = json.loads(line[5:].strip())
                except ValueError:
                    continue
                t, i = ev.get("type"), ev.get("index")
                if t == "content_block_start":
                    b = ev.get("content_block") or {}
                    kinds[i] = b.get("type")
                    partial[i] = ""
                    if b.get("type") == "thinking":
                        emit("think", "")
                    elif b.get("type") == "web_search_tool_result":
                        emit("found", "")
                    elif b.get("type") == "text":
                        emit("write", "")
                elif t == "content_block_delta":
                    d = ev.get("delta") or {}
                    if d.get("type") == "text_delta":
                        text.append(d.get("text", ""))
                    elif d.get("type") == "input_json_delta":
                        partial[i] = partial.get(i, "") + d.get("partial_json", "")
                elif t == "content_block_stop" and kinds.get(i) == "server_tool_use":
                    try:
                        emit("search", str(json.loads(partial.get(i) or "{}").get("query") or ""))
                    except ValueError:
                        emit("search", "")
                elif t == "message_start":
                    usage.update((ev.get("message") or {}).get("usage") or {})
                elif t == "message_delta":
                    usage.update(ev.get("usage") or {})
                    if (ev.get("delta") or {}).get("stop_reason") == "max_tokens":
                        raise ValueError("Het antwoord van de AI werd afgebroken (te lang). Probeer het nog eens.")
                elif t == "error":
                    raise ValueError("Claude gaf een fout: " + str((ev.get("error") or {}).get("message") or "onbekend"))
    except urllib.error.HTTPError as e:
        stats.record("ai", "call", body_model(body)), stats.record("ai", "error", f"HTTP {e.code}")
        aiusage.record(mdl, None, started, False, f"HTTP {e.code}", web, 0, system)
        raise ValueError(f"Claude gaf een fout (HTTP {e.code}). Controleer de koppeling en het tegoed.")
    except ValueError as e:
        aiusage.record(mdl, usage, started, False, str(e), web, 0, system)  # (what was used before the error is counted)
        raise
    except Exception as e:  # noqa: BLE001
        stats.record("ai", "call", body_model(body)), stats.record("ai", "error", "verbinding")
        aiusage.record(mdl, None, started, False, "verbinding", web, 0, system)
        raise ValueError(f"Geen verbinding met Claude: {e}")
    aiusage.record(mdl, usage, started, True, "", web, 0, system)
    stats.record("ai", "call", body_model(body))
    stats.record("ai", "purpose", " ".join(str(system or "").split()[:6])[:60])
    stats.record("ai", "tokens_in", body_model(body), int(usage.get("input_tokens") or 0))
    stats.record("ai", "tokens_out", body_model(body), int(usage.get("output_tokens") or 0))
    return "".join(text)
