# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import has_level_for
from apps.core import modules
from apps.core.modules import module_required
from rest_framework.response import Response

from apps.medialib import service
from apps.security.words import validate_no_forbidden_words

from .models import SLOTS, HomePhoto, SiteAsset

logger = logging.getLogger(__name__)
MAX_BYTES = 5 * 1024 * 1024
MAX_PHOTOS = 12


def _check_image(f):
    if f.size > MAX_BYTES:
        raise serializers.ValidationError("Bestand is te groot (maximaal 5 MB).")
    return f


class UploadSerializer(serializers.Serializer):
    image = serializers.ImageField(validators=[_check_image])


@api_view(["GET"])
@permission_classes([AllowAny])
def branding(request):
    """Public. Returns relative media paths (the frontend prefixes the API origin)."""
    if not modules.enabled("branding"):
        return Response({"assets": {}, "photos": [], "slots": {k: {"label": v[0], "hint": v[1]} for k, v in SLOTS.items()}})
    assets = {a.slot: f"{a.image.url}?v={int(a.updated_at.timestamp())}" for a in SiteAsset.objects.all()}
    photos = [{"id": p.id, "url": p.image.url, "caption": p.caption} for p in HomePhoto.objects.all()]
    return Response({"assets": assets, "photos": photos, "slots": {k: {"label": v[0], "hint": v[1]} for k, v in SLOTS.items()}})


@api_view(["PUT", "DELETE"])
@permission_classes([has_level_for("branding", {"PUT": "edit", "DELETE": "manage"}), module_required("branding")])
@parser_classes([MultiPartParser, FormParser])
def asset(request, slot):
    if slot not in SLOTS:
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_404_NOT_FOUND)
    existing = SiteAsset.objects.filter(slot=slot).first()
    if request.method == "DELETE":
        if existing:
            name = existing.image.name
            existing.delete()
            service.release(name)
        return Response(status=status.HTTP_204_NO_CONTENT)

    up = UploadSerializer(data=request.data)
    if not up.is_valid():
        msgs = [str(m) for v in up.errors.values() for m in v]
        return Response({"detail": " ".join(msgs)}, status=status.HTTP_400_BAD_REQUEST)
    image = up.validated_data["image"]
    if existing:
        old = existing.image.name
        existing.image = image
        existing.save()
        service.release(old)
    else:
        SiteAsset.objects.create(slot=slot, image=image)
    logger.info("Branding asset '%s' updated by %s", slot, request.user.email)
    return Response({"ok": True})


class HomePhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = HomePhoto
        fields = ["id", "image", "url", "caption", "order"]
        extra_kwargs = {"image": {"write_only": True, "validators": []}, "caption": {"validators": [validate_no_forbidden_words]}}

    def get_url(self, obj):
        return obj.image.url

    def validate_image(self, value):
        return _check_image(value)

    def validate(self, attrs):
        if self.instance is None and HomePhoto.objects.count() >= MAX_PHOTOS:
            raise serializers.ValidationError(f"Maximaal {MAX_PHOTOS} foto's.")
        return attrs


class HomePhotoViewSet(viewsets.ModelViewSet):
    queryset = HomePhoto.objects.all()
    serializer_class = HomePhotoSerializer
    permission_classes = [has_level_for("branding", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"), module_required("branding")]
    http_method_names = ["get", "post", "patch", "delete"]

    def perform_create(self, serializer):
        last = HomePhoto.objects.order_by("-order").first()
        serializer.save(order=(last.order + 1) if last else 0)

    def perform_destroy(self, instance):
        name = instance.image.name
        instance.delete()
        service.release(name)
