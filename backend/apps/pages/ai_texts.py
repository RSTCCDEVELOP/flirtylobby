"""Claude makes (or updates) all texts of one page in every language, and the SEO title and description of the page per language.
One language per call, so the screen can show a progress bar. The source is the default language; what already exists in a language is overwritten (an update)."""
import json
import re

from apps.core import richtext, themeimport
from apps.core.models import ContentBlock, Language
from apps.integrations import ai
from apps.security.words import find_forbidden

from .models import Page

MAX_CHARS = 7000  # per request to Claude: longer pages are split


class AiTextError(ValueError):
    pass


def default_code():
    return Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"


def languages():
    """Every language of the system except the default one (also the ones that are off), and the default one."""
    d = default_code()
    return d, [{"code": l.code, "name": l.name} for l in Language.objects.all() if l.code != d]


def _blocks_in(page, lang):
    out = []
    for b in ContentBlock.objects.filter(lang=lang).filter(key__startswith=f"layout.{page.key}.") | ContentBlock.objects.filter(lang=lang, key__startswith=f"page.{page.key}."):
        if not b.text.strip() or b.text.startswith("media:") or re.search(r"\.(pl|st|bg)$", b.key) or b.key.endswith(".title"):
            continue
        out.append((b.key, b.text))
    return out


def source_blocks(page):
    """(language, [(key, text)]): the texts of the page in the default language; when the page has none there, in the language that has the most (a site that was
    written in another language than the default one)."""
    d = default_code()
    blocks = _blocks_in(page, d)
    if blocks:
        return d, blocks
    best = max(((l, _blocks_in(page, l)) for l in Language.objects.values_list("code", flat=True)), key=lambda x: len(x[1]), default=(d, []))
    return best


def excerpt(blocks, limit=1500):
    text = " ".join(richtext.plain(t[len(richtext.PREFIX):]) if t.startswith(richtext.PREFIX) else t for _k, t in blocks)
    return re.sub(r"\s+", " ", text).strip()[:limit]


def _ask(system, payload, need):
    if not ai.available():
        raise AiTextError("Claude is niet gekoppeld. Koppel Claude bij Admin → API keys.")
    last = ""
    for _ in range(3):
        try:
            return themeimport._parse_json(ai.claude(system, json.dumps(payload, ensure_ascii=False), max_tokens=8000, timeout=180), need=need)
        except ValueError as e:
            last = str(e)
    raise AiTextError(f"Claude gaf geen bruikbaar antwoord ({last}).")


def translate_texts(blocks, src, code, name):
    """Translate the blocks; returns {key: text} (html keeps its marks)."""
    system = (f"You translate the texts of a web page from {src} to {name} ({code}). Keep the meaning and a natural, friendly tone. The texts may be HTML: keep every tag and attribute "
              "(also data-media and data-sysobject) exactly as it is and only translate the visible words. Answer with ONE JSON object only, no text around it: {key: translated text}.")
    out, batch, size = {}, {}, 0
    for key, text in blocks + [(None, None)]:
        if key is None or (batch and size + len(text) > MAX_CHARS):
            if batch:
                got = _ask(system, {k: t for k, t in batch.items()}, need=tuple(batch))
                out.update({k: str(v) for k, v in got.items() if k in batch and isinstance(v, str)})
            batch, size = {}, 0
        if key is not None:
            batch[key] = text
            size += len(text)
    return out


def make_seo(page, blocks, code, name, title):
    system = (f"You write the SEO title and meta description of a web page in {name} ({code}). Title: at most 60 characters. Description: at most 160 characters, inviting, no quotes. "
              "Answer with ONE JSON object only: {\"title\": \"...\", \"description\": \"...\"}.")
    got = _ask(system, {"page_name": title, "text": excerpt(blocks)}, need=("title",))
    return str(got.get("title") or "").strip()[:200], str(got.get("description") or "").strip()[:400]


def run(page, code, seo=True):
    """All texts and the SEO of this page in one language. Returns {"lang", "texts", "seo", "title"}."""
    d = default_code()
    lang = Language.objects.filter(code=code).first()
    if not lang:
        raise AiTextError("Onbekende taal.")
    src, blocks = source_blocks(page)
    out = {"lang": code, "texts": 0, "seo": False, "title": False}
    title_src = (page.title or {}).get(src) or (page.title or {}).get(d) or page.key
    title = title_src
    if code != src:
        if blocks:
            got = translate_texts(blocks, src, code, lang.name)
            for key, text in got.items():
                rich = text.startswith(richtext.PREFIX)
                body = richtext.clean(text[len(richtext.PREFIX):]) if rich else text[:5000]
                if find_forbidden(richtext.plain(body) if rich else body):
                    continue
                ContentBlock.objects.update_or_create(key=key, lang=code, defaults={"text": (richtext.PREFIX + body) if rich else body})
                out["texts"] += 1
        t = _ask(f"You translate the short name of a web page from {src} to {lang.name} ({code}). Answer with ONE JSON object only: {{\"title\": \"...\"}}.", {"name": title_src}, need=("title",))
        title = str(t.get("title") or "").strip()[:80] or title_src
        if title and title != title_src and not find_forbidden(title):
            Page.objects.filter(pk=page.pk).update(title={**(page.title or {}), code: title})
            out["title"] = True
    if seo and page.path and page.path.startswith("/") and "<" not in page.path:
        from apps.seo.models import SeoPage

        seo_blocks = blocks if code == src else [(k, ContentBlock.objects.filter(key=k, lang=code).values_list("text", flat=True).first() or t) for k, t in blocks]
        t, desc = make_seo(page, seo_blocks, code, lang.name, title)
        if t or desc:
            SeoPage.objects.update_or_create(path=page.path, lang=code, defaults={"title": t, "description": desc})
            out["seo"] = True
    return out
