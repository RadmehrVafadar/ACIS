from pathlib import Path

from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Parcel, Scan


class ScanInput(serializers.Serializer):
    event_id = serializers.SlugField(max_length=64)
    facility = serializers.CharField(max_length=80)


def console(request):
    return FileResponse(Path(__file__).with_name("dispatch.html").open("rb"), content_type="text/html")


@api_view(["GET"])
def parcels(request):
    return Response({"parcels": list(Parcel.objects.order_by("tracking_number").values_list("pk", flat=True))})


@api_view(["GET", "POST"])
def scans(request, tracking_number):
    if request.method == "GET":
        parcel = get_object_or_404(Parcel, pk=tracking_number)
        return Response({
            "tracking_number": parcel.pk,
            "current_facility": parcel.current_facility,
            "scans": list(parcel.scans.order_by("id").values("event_id", "facility", "received_at")),
        })

    payload = ScanInput(data=request.data)
    payload.is_valid(raise_exception=True)
    event_id = payload.validated_data["event_id"]
    facility = payload.validated_data["facility"]
    with transaction.atomic():
        parcel = get_object_or_404(Parcel.objects.select_for_update(), pk=tracking_number)
        scan, created = Scan.objects.get_or_create(
            parcel=parcel, event_id=event_id, defaults={"facility": facility}
        )
        if not created and scan.facility != facility:
            return Response({"detail": "This event ID already records another facility."}, status=409)
        if created:
            parcel.current_facility = facility
            parcel.save(update_fields=["current_facility"])
    return Response(
        {"event_id": scan.event_id, "facility": scan.facility, "received_at": scan.received_at},
        status=201 if created else 200,
    )
