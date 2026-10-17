from django.conf import settings
from django.db import models

U = settings.AUTH_USER_MODEL


class SocialSettings(models.Model):
    """Singleton (pk=1): configuration of profiles, messages and chat (Admin -> Community)."""

    data = models.JSONField(default=dict, blank=True)


class Profile(models.Model):
    """A member's own page. Who may see it is decided by `visibility` (+ the allow list), language and blocks."""

    VISIBILITY = [("public", "Iedereen"), ("members", "Alleen leden"), ("friends", "Alleen vrienden"), ("selected", "Alleen geselecteerde leden")]

    user = models.OneToOneField(U, on_delete=models.CASCADE, related_name="profile")
    slug = models.SlugField(max_length=80, unique=True)
    enabled = models.BooleanField(default=False)
    headline = models.CharField(max_length=150, blank=True)
    bio = models.TextField(blank=True)
    visibility = models.CharField(max_length=10, choices=VISIBILITY, default="members")
    languages = models.JSONField(default=list, blank=True)  # visible in these (active) languages; empty = all
    searchable_local = models.BooleanField(default=True)  # findable in the member search of this system
    searchable_public = models.BooleanField(default=False)  # findable by search engines (sitemap + index)
    accept_messages = models.BooleanField(default=True)
    accept_chat = models.BooleanField(default=True)
    # "Zoeken & matchen" (dating-style discovery)
    discover = models.BooleanField(default=False)  # takes part: can search others and be found
    gender = models.CharField(max_length=1, blank=True)  # m | f | x
    birth_date = models.DateField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, blank=True)
    interests = models.JSONField(default=list, blank=True)
    data = models.JSONField(default=dict, blank=True)  # values of the configurable profile fields (Admin -> Community -> Profielvelden)
    looking_for_genders = models.JSONField(default=list, blank=True)  # empty = everybody
    aim = models.CharField(max_length=15, blank=True)  # dating | relationship | friends | chat
    age_min = models.PositiveSmallIntegerField(default=18)
    age_max = models.PositiveSmallIntegerField(default=99)
    lat = models.FloatField(null=True, blank=True)  # rounded (~1 km) on purpose
    lon = models.FloatField(null=True, blank=True)
    show_distance = models.BooleanField(default=True)
    show_age = models.BooleanField(default=True)
    show_city = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


def photo_path(instance, filename):
    """Random file names: the URL of a private photo cannot be guessed."""
    import os
    import uuid

    from apps.medialib import areas

    return areas.user_path(instance.profile.user_id, "photos", f"{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()[:6]}")


def blur_path(instance, filename):
    import uuid

    from apps.medialib import areas

    return areas.user_path(instance.profile.user_id, "photos/blur", f"{uuid.uuid4().hex}.jpg")


class ProfilePhoto(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=photo_path)
    blurred = models.ImageField(upload_to=blur_path, blank=True)  # strongly blurred copy shown to people without access
    VISIBILITY = [("public", "Openbaar"), ("members", "Portal (ingelogde leden)"), ("private", "Privé (wazig tot toegang)"), ("hidden", "Onzichtbaar (alleen ik)")]
    visibility = models.CharField(max_length=8, choices=VISIBILITY, default="public")
    caption = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    @property
    def private(self):
        return self.visibility == "private"


class ProfileAllow(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="allowed")
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")

    class Meta:
        unique_together = ("profile", "user")


class Block(models.Model):
    """`blocker` blocked `blocked`: neither can see or find the other, message or chat."""

    blocker = models.ForeignKey(U, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(U, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("blocker", "blocked")


class DirectMessage(models.Model):
    """Messages system (mailbox style, asynchronous)."""

    sender = models.ForeignKey(U, on_delete=models.CASCADE, related_name="messages_sent")
    recipient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="messages_received")
    subject = models.CharField(max_length=150, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    hidden_sender = models.BooleanField(default=False)
    hidden_recipient = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at", "id"]


def chat_path(instance, filename):
    import os
    import uuid

    from apps.medialib import areas

    return areas.user_path(instance.sender_id, "chat", f"{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()[:6]}")


class ChatMessage(models.Model):
    """Chat via the portal (method 'portal'); with WebRTC nothing is stored."""

    sender = models.ForeignKey(U, on_delete=models.CASCADE, related_name="chat_sent")
    recipient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="chat_received")
    body = models.TextField(blank=True)
    attachment = models.FileField(upload_to=chat_path, blank=True)
    attachment_kind = models.CharField(max_length=10, blank=True)  # image | video
    attachment_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]


class ChatSignal(models.Model):
    """WebRTC signaling (offers, answers, ICE candidates, call requests). Short-lived."""

    sender = models.ForeignKey(U, on_delete=models.CASCADE, related_name="signals_sent")
    recipient = models.ForeignKey(U, on_delete=models.CASCADE, related_name="signals_received")
    kind = models.CharField(max_length=15)  # sdp | ice | call | accept | decline | end
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Like(models.Model):
    """from_user likes to_user. Two likes in both directions = a match."""

    from_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="likes_given")
    to_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="likes_received")
    seen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("from_user", "to_user")


class Favorite(models.Model):
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="favorites")
    target = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "target")


class ProfileVisit(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="visits")
    viewer = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    visited_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("profile", "viewer")


class Connection(models.Model):
    """A request from one member to another: become friends, see the (private) photos, or see the profile.
    The receiver accepts or declines. Accepted = access until one of them ends it."""

    KINDS = [("friend", "Vriendschap"), ("photos", "Foto's bekijken"), ("profile", "Profiel bekijken")]
    STATUS = [("pending", "In afwachting"), ("accepted", "Geaccepteerd"), ("declined", "Geweigerd")]

    from_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="requests_sent")
    to_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="requests_received")
    kind = models.CharField(max_length=10, choices=KINDS)
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    message = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("from_user", "to_user", "kind")
        ordering = ["-created_at"]


class DirectRoom(models.Model):
    """One-to-one WebRTC connection by invitation link / QR code. The guest does not need an account.
    The server only relays the signaling; text, files and video go device to device."""

    token = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=8, blank=True, db_index=True)  # short code to connect without the link
    owner = models.ForeignKey(U, on_delete=models.CASCADE, related_name="direct_rooms", null=True, blank=True)  # empty: started by a visitor without an account (/directchat)
    owner_name = models.CharField(max_length=60, blank=True)  # only for visitor-started rooms
    owner_gender = models.CharField(max_length=1, blank=True)
    owner_key = models.CharField(max_length=64, blank=True)  # secret of the visitor who started the room
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    closed = models.BooleanField(default=False)
    guest_name = models.CharField(max_length=60, blank=True)
    guest_gender = models.CharField(max_length=1, blank=True)  # m | f | x, asked before connecting
    chat_request = models.CharField(max_length=8, blank=True)  # the guest asks to chat: "" | asked | declined | accepted
    guest_key = models.CharField(max_length=64, blank=True)  # secret of the one guest who joined
    guest_seen = models.DateTimeField(null=True, blank=True)
    owner_seen = models.DateTimeField(null=True, blank=True)


class DirectSignal(models.Model):
    room = models.ForeignKey(DirectRoom, on_delete=models.CASCADE, related_name="signals")
    to_role = models.CharField(max_length=5)  # owner | guest
    kind = models.CharField(max_length=10)  # sdp | ice | call | accept | decline | end
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Pass(models.Model):
    """from_user swiped to_user away: not shown again in the swipe deck for a while."""

    from_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="passes_given")
    to_user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("from_user", "to_user")


class Notification(models.Model):
    """In-app notice for a member: someone liked them, a match, a short message with a like."""

    KINDS = [("like", "Like"), ("match", "Match"), ("message", "Bericht"), ("dchat", "Chatverzoek")]
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=10, choices=KINDS)
    from_user = models.ForeignKey(U, null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    text = models.CharField(max_length=200, blank=True)
    seen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
