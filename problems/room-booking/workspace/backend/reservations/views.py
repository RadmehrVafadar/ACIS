from pathlib import Path

from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Room
from .serializers import ReservationSerializer


def calendar(request):
    return FileResponse(Path(__file__).with_name("calendar.html").open("rb"), content_type="text/html")


@api_view(["GET"])
def rooms(request):
    return Response(list(Room.objects.order_by("name").values("slug", "name")))


@api_view(["GET", "POST"])
def reservations(request, room_slug):
    if request.method == "GET":
        room = get_object_or_404(Room, slug=room_slug)
        entries = room.bookings.order_by("starts_at", "id")
        return Response(ReservationSerializer(entries, many=True).data)

    form = ReservationSerializer(data=request.data)
    form.is_valid(raise_exception=True)
    start, end = form.validated_data["starts_at"], form.validated_data["ends_at"]
    with transaction.atomic():
        room = get_object_or_404(Room.objects.select_for_update(), slug=room_slug)
        if room.bookings.filter(starts_at__lt=end, ends_at__gt=start).exists():
            return Response({"detail": "That room is already reserved for this time."}, status=409)
        form.save(room=room)
    return Response(form.data, status=201)
