import json
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.access import level
from apps.core import modules
from apps.security.words import find_forbidden

from .models import FaqEntry


def _pick(d, lang):
    d = d or {}
    return d.get(lang) or d.get("en") or d.get("nl") or next((v for v in d.values() if v), "")


def _texts(raw, n):
    if not isinstance(raw, dict):
        return {}
    return {str(k)[:5]: str(v).strip()[:n] for k, v in raw.items() if re.fullmatch(r"[a-z]{2,5}", str(k)) and str(v).strip()}


def _out(e):
    return {"id": e.id, "question": e.question, "answer": e.answer, "category": e.category, "order": e.order, "active": e.active}


def _bad(msg, code=400):
    return Response({"detail": msg}, status=code)


@api_view(["GET"])
@permission_classes([AllowAny])
def public(request):
    """The FAQ of the website in the language of the visitor (only active questions)."""
    if not modules.enabled("faq"):
        return _bad("Deze module is uitgeschakeld.", 404)
    from .tip_views import faq_settings

    if faq_settings()["page_scope"] == "private" and not request.user.is_authenticated:
        return _bad("Deze FAQ is alleen voor ingelogde gebruikers.", 403)
    lang = str(request.query_params.get("lang") or "nl")[:5]
    return Response({"items": [{"id": e.id, "q": _pick(e.question, lang), "a": _pick(e.answer, lang), "category": _pick(e.category, lang)} for e in FaqEntry.objects.filter(active=True)]})


def _allowed(request, need):
    return request.user.is_authenticated and level(request.user, "faq") >= need and modules.enabled("faq")


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def admin(request):
    if not _allowed(request, 1 if request.method == "GET" else 2):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        d = request.data
        q, a = _texts(d.get("question"), 300), _texts(d.get("answer"), 4000)
        if not q or not a:
            return _bad("Vul een vraag en een antwoord in.")
        if (w := find_forbidden(" ".join([*q.values(), *a.values()]))):
            return _bad(f"Bevat niet toegestane woorden: {', '.join(w)}.")
        last = FaqEntry.objects.order_by("-order").first()
        e = FaqEntry.objects.create(question=q, answer=a, category=_texts(d.get("category"), 80), order=(last.order + 1) if last else 0)
        return Response(_out(e), status=status.HTTP_201_CREATED)
    return Response({"items": [_out(e) for e in FaqEntry.objects.all()], "can_edit": level(request.user, "faq") >= 2})


@api_view(["PATCH", "DELETE"])
@permission_classes([AllowAny])
def entry(request, pk):
    if not _allowed(request, 2):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    e = FaqEntry.objects.filter(pk=pk).first()
    if not e:
        return _bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        e.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data
    if "question" in d:
        e.question = _texts(d["question"], 300)
    if "answer" in d:
        e.answer = _texts(d["answer"], 4000)
    if "category" in d:
        e.category = _texts(d["category"], 80)
    if "active" in d:
        e.active = bool(d["active"])
    if "order" in d:
        try:
            e.order = max(0, int(d["order"]))
        except (TypeError, ValueError):
            pass
    if not e.question or not e.answer:
        return _bad("Vul een vraag en een antwoord in.")
    e.save()
    return Response(_out(e))


@api_view(["POST"])
@permission_classes([AllowAny])
def translate(request):
    """A question and its answer in every language of the system (also the ones that are off), translated by Claude from the default language."""
    if not _allowed(request, 2):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    from apps.core import themeimport
    from apps.core.models import Language
    from apps.integrations import ai

    q, a, c = str(request.data.get("question") or "").strip()[:300], str(request.data.get("answer") or "").strip()[:4000], str(request.data.get("category") or "").strip()[:80]
    if not q or not a:
        return _bad("Vul eerst de vraag en het antwoord in.")
    if not ai.available():
        return _bad("Claude is niet gekoppeld. Vul de talen zelf in of koppel Claude bij Admin → API keys.")
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    todo = [(l.code, l.name) for l in Language.objects.all() if l.code != default]
    system = ("You translate a question and its answer for the FAQ of a website. Keep the meaning and a friendly, clear tone. "
              "Answer with ONE JSON object only, no text around it: {\"question\": {code: text}, \"answer\": {code: text}, \"category\": {code: text}} with an entry for every requested language code (category only when given).")
    prompt = json.dumps({"source_language": default, "question": q, "answer": a, "category": c, "languages": [{"code": code, "name": n} for code, n in todo]}, ensure_ascii=False)
    try:
        out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=6000, timeout=120), need=("question", "answer"))
    except (ValueError, KeyError) as e:
        return _bad(f"Vertalen mislukt: {e}")
    pick = lambda k, src, n: {default: src, **{code: str((out.get(k) or {}).get(code) or "").strip()[:n] for code, _n in todo if str((out.get(k) or {}).get(code) or "").strip()}}  # noqa: E731
    return Response({"question": pick("question", q, 300), "answer": pick("answer", a, 4000), "category": pick("category", c, 80) if c else {}})
