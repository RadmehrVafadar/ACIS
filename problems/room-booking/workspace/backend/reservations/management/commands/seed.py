from datetime import UTC, datetime

from django.core.management.base import BaseCommand
from django.db import transaction

from reservations.models import Reservation, Room


class Command(BaseCommand):
    help = "Restore the office calendar to its demonstration schedule."

    @transaction.atomic
    def handle(self, *args, **options):
        Room.objects.all().delete()
        atlas = Room.objects.create(slug="atlas", name="Atlas")
        cedar = Room.objects.create(slug="cedar", name="Cedar")
        rows = (
            (atlas, "Release readiness review", 10, 11),
            (atlas, "Partner onboarding", 13, 14),
            (cedar, "Support handover", 9, 10),
        )
        for room, title, start, end in rows:
            Reservation.objects.create(
                room=room,
                title=title,
                starts_at=datetime(2027, 1, 19, start, tzinfo=UTC),
                ends_at=datetime(2027, 1, 19, end, tzinfo=UTC),
            )
