"""Profile block "Beschikbaar voor": what a member is available for (games, direct connection, chat, video chat, type of date, type of connection ...).
Own items are managed by the admin (Admin -> Community); items from a module appear while that module is on and can be switched off."""
import re

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level
from apps.core import modules

from . import service
from .models import AvailabilityOption

GROUP_LABEL = {
    "games": {"nl": "Games", "en": "Games", "de": "Spiele", "fr": "Jeux", "es": "Juegos", "pt": "Jogos", "zh": "游戏", "ar": "الألعاب"},
    "direct": {"nl": "Directe verbinding", "en": "Direct connection", "de": "Direktverbindung", "fr": "Connexion directe", "es": "Conexión directa", "pt": "Ligação direta", "zh": "直接连接", "ar": "اتصال مباشر"},
    "chat": {"nl": "Chat en videochat", "en": "Chat and video chat", "de": "Chat und Videochat", "fr": "Chat et appel vidéo", "es": "Chat y videochat", "pt": "Chat e videochamada", "zh": "聊天和视频聊天", "ar": "الدردشة ومحادثة الفيديو"},
    "date": {"nl": "Soort date", "en": "Type of date", "de": "Art des Dates", "fr": "Type de rendez-vous", "es": "Tipo de cita", "pt": "Tipo de encontro", "zh": "约会类型", "ar": "نوع الموعد"},
    "work": {"nl": "Werk en netwerk", "en": "Work and network", "de": "Arbeit und Netzwerk", "fr": "Travail et réseau", "es": "Trabajo y red", "pt": "Trabalho e rede", "zh": "工作与人脉", "ar": "العمل والشبكة"},
    "training": {"nl": "Samen sporten", "en": "Training together", "de": "Gemeinsam trainieren", "fr": "S'entraîner ensemble", "es": "Entrenar juntos", "pt": "Treinar juntos", "zh": "一起运动", "ar": "التدريب معًا"},
    "connection": {"nl": "Soort connectie", "en": "Type of connection", "de": "Art der Verbindung", "fr": "Type de relation", "es": "Tipo de conexión", "pt": "Tipo de ligação", "zh": "关系类型", "ar": "نوع العلاقة"},
}
# the groups that only belong to some profile themes (Admin -> Community -> Profielthema); the others belong to every theme
GROUP_THEMES = {"date": ["dating", "normal"], "work": ["business"], "training": ["sporters"]}
DEFAULTS = [
    ("work", "vaste-baan", {"nl": "Een vaste baan", "en": "A permanent job"}), ("work", "freelance", {"nl": "Freelance of opdrachten", "en": "Freelance work"}), ("work", "netwerkkoffie", {"nl": "Netwerkkoffie", "en": "Networking coffee"}),
    ("work", "mentoring", {"nl": "Mentoring", "en": "Mentoring"}), ("work", "spreker", {"nl": "Spreker of trainer", "en": "Speaker or trainer"}), ("work", "samenwerking", {"nl": "Samenwerking", "en": "Collaboration"}), ("work", "stage", {"nl": "Stage of leerwerkplek", "en": "Internship"}),
    ("training", "trainingsmaatje", {"nl": "Trainingsmaatje", "en": "Training buddy"}), ("training", "hardlopen", {"nl": "Samen hardlopen", "en": "Running together"}), ("training", "fietsen", {"nl": "Samen fietsen", "en": "Cycling together"}),
    ("training", "wedstrijd", {"nl": "Samen een wedstrijd doen", "en": "Racing together"}), ("training", "sportschool", {"nl": "Samen naar de sportschool", "en": "Gym together"}),  # the first time: some own items to begin with (the admin changes them freely)
    ("date", "koffie", {"nl": "Koffie of thee", "en": "Coffee or tea"}), ("date", "wandelen", {"nl": "Een wandeling", "en": "A walk"}), ("date", "diner", {"nl": "Uit eten", "en": "Dinner"}),
    ("date", "drankje", {"nl": "Een drankje", "en": "A drink"}), ("date", "film", {"nl": "Film of theater", "en": "Cinema or theatre"}), ("date", "online", {"nl": "Online date", "en": "Online date"}),
    ("connection", "vriendschap", {"nl": "Vriendschap", "en": "Friendship"}), ("connection", "relatie", {"nl": "Vaste relatie", "en": "Relationship"}), ("connection", "kennismaken", {"nl": "Kennismaken", "en": "Getting to know each other"}),
    ("connection", "praten", {"nl": "Gewoon praten", "en": "Just talking"}), ("connection", "activiteiten", {"nl": "Samen activiteiten doen", "en": "Doing things together"}),
]


def _auto():
    """The items the modules offer right now: [(key, group, label, source)]."""
    out = []
    if modules.enabled("directconnect"):
        out.append(("direct", "direct", {"nl": "Directe verbinding", "en": "Direct connection", "de": "Direktverbindung", "fr": "Connexion directe", "es": "Conexión directa", "pt": "Ligação direta", "zh": "直接连接", "ar": "اتصال مباشر"}, "direct"))
    if modules.enabled("chat"):
        out.append(("chat", "chat", {"nl": "Chat", "en": "Chat", "de": "Chat", "fr": "Chat", "es": "Chat", "pt": "Chat", "zh": "聊天", "ar": "دردشة"}, "chat"))
        if service.get()["chat"].get("video_chat"):
            out.append(("videochat", "chat", {"nl": "Videochat", "en": "Video chat", "de": "Videochat", "fr": "Appel vidéo", "es": "Videochat", "pt": "Videochamada", "zh": "视频聊天", "ar": "محادثة فيديو"}, "video"))
    if modules.enabled("plugin:games"):
        from apps.plugins import installer
        from apps.plugins.models import Plugin

        p = Plugin.objects.filter(name="games", enabled=True).first()
        for it in (installer.content_items(p) if p else []) or []:
            if it.get("enabled") and not it.get("problem"):
                titles = {"nl": it["title"], **(it.get("meta", {}).get("titles") or {})}
                out.append((f"game-{it['name']}", "games", titles, f"game:{it['name']}"))
    return out


@transaction.atomic
def sync():
    """Make the rows for the module items (new ones appear, the label follows the game) and the first own items."""
    from .models import SocialSettings

    row, _ = SocialSettings.objects.get_or_create(pk=1)
    seeded = set((row.data or {}).get("avail_seeded") or []) | set(AvailabilityOption.objects.filter(source="").values_list("group", flat=True))  # a group is filled once; after that the admin owns it
    todo = {g for g, *_ in DEFAULTS} - seeded
    for i, (g, k, lab) in enumerate(DEFAULTS):
        if g in todo and not AvailabilityOption.objects.filter(key=k).exists():
            AvailabilityOption.objects.create(key=k, group=g, label=lab, order=i)
    if todo:
        row.data = {**(row.data or {}), "avail_seeded": sorted(seeded | todo)}
        row.save()
    for k, g, lab, src in _auto():
        row = AvailabilityOption.objects.filter(key=k).first()
        if not row:
            AvailabilityOption.objects.create(key=k, group=g, label=lab, source=src, order=100)
        elif row.source and row.label != lab:
            AvailabilityOption.objects.filter(pk=row.pk).update(label=lab)


def live():
    """The options that can be chosen now: switched on, and (for module items) the module is on."""
    sync()
    on = {k for k, *_ in _auto()}
    return [o for o in AvailabilityOption.objects.filter(enabled=True) if not o.source or o.key in on]


def groups():
    """[{key, label{lang}, items: [{key, label{lang}}]}], only groups that have items and belong to the profile theme of this site."""
    theme = service.get()["profiles"]["theme"]
    by = {}
    for o in live():
        by.setdefault(o.group, []).append({"key": o.key, "label": o.label})
    return [{"key": g, "label": GROUP_LABEL[g], "items": by[g]} for g, _ in AvailabilityOption.GROUPS if by.get(g) and (g not in GROUP_THEMES or theme in GROUP_THEMES[g])]


def valid_keys():
    return {o.key for o in live()}


def of_profile(p):
    """What this member is available for, as [{key, group, label{lang}}] (for cards and the profile page)."""
    mine = set(p.available or [])
    if not mine:
        return []
    return [{"key": o.key, "group": o.group, "label": o.label} for o in live() if o.key in mine]


# ── for members: the choices ───────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def options(request):
    return Response({"groups": groups()})


# ── for the admin (Admin -> Community) ─────────────────────────────────────
def _admin(request):
    return level(request.user, "profiles") >= 2 or request.user.is_staff


def _row(o):
    return {"id": o.id, "key": o.key, "group": o.group, "label": o.label, "enabled": o.enabled, "order": o.order, "own": not o.source, "source": o.source,
            "available": (not o.source) or o.key in {k for k, *_ in _auto()}}


def _label(raw):
    return {str(k)[:5]: str(v).strip()[:60] for k, v in (raw.items() if isinstance(raw, dict) else []) if re.fullmatch(r"[a-z]{2,5}", str(k)) and str(v).strip()}


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_list(request):
    if not _admin(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    sync()
    if request.method == "POST":
        d = request.data
        label = _label(d.get("label"))
        group = d.get("group")
        if group not in dict(AvailabilityOption.GROUPS) or not label:
            return Response({"detail": "Kies een groep en geef het item een naam."}, status=status.HTTP_400_BAD_REQUEST)
        base = re.sub(r"[^a-z0-9]+", "-", next(iter(label.values())).lower()).strip("-")[:40] or "item"
        key, n = base, 2
        while AvailabilityOption.objects.filter(key=key).exists():
            key, n = f"{base}-{n}", n + 1
        last = AvailabilityOption.objects.filter(group=group).order_by("-order").first()
        o = AvailabilityOption.objects.create(key=key, group=group, label=label, order=(last.order + 1) if last else 0)
        return Response(_row(o), status=status.HTTP_201_CREATED)
    return Response({"groups": [{"key": g, "label": GROUP_LABEL[g]} for g, _ in AvailabilityOption.GROUPS], "items": [_row(o) for o in AvailabilityOption.objects.all()]})


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_item(request, pk):
    if not _admin(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    o = AvailabilityOption.objects.filter(pk=pk).first()
    if not o:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        if o.source:
            return Response({"detail": "Een onderdeel van een module kun je niet verwijderen; zet het uit."}, status=status.HTTP_400_BAD_REQUEST)
        o.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data
    if "enabled" in d:
        o.enabled = bool(d["enabled"])
    if "label" in d and not o.source:
        lab = _label(d["label"])
        if not lab:
            return Response({"detail": "Geef het item een naam."}, status=status.HTTP_400_BAD_REQUEST)
        o.label = lab
    if "group" in d and not o.source and d["group"] in dict(AvailabilityOption.GROUPS):
        o.group = d["group"]
    if "order" in d:
        try:
            o.order = max(0, int(d["order"]))
        except (TypeError, ValueError):
            pass
    o.save()
    return Response(_row(o))
