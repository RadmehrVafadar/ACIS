from django.core.management.base import BaseCommand
from django.db import transaction

from tracking.models import Parcel, Scan


class Command(BaseCommand):
    help = "Restore the dispatch demonstration parcels."

    @transaction.atomic
    def handle(self, *args, **options):
        Parcel.objects.all().delete()
        routes = {
            "PKG-1047": (("scan-41", "Union Depot"), ("scan-42", "Riverside Hub")),
            "PKG-1051": (("scan-41", "Harbor Terminal"),),
        }
        for number, events in routes.items():
            parcel = Parcel.objects.create(tracking_number=number, current_facility=events[-1][1])
            for event_id, facility in events:
                Scan.objects.create(parcel=parcel, event_id=event_id, facility=facility)
