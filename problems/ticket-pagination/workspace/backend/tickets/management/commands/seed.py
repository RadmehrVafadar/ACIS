from django.core.management.base import BaseCommand
from django.db import transaction

from tickets.models import Ticket

TICKETS = [
    ("Missing receipt for last month's order", "open"),
    ("Update email preferences", "closed"),
    ("Export a large dashboard", "open"),
    ("Investigate a duplicate invoice", "pending"),
    ("Archive an unused workspace", "closed"),
    ("Restore a deleted report", "open"),
    ("Update default timezone", "pending"),
    ("Reconcile warehouse counts", "open"),
    ("Correct a shipping address", "closed"),
    ("Review delayed notifications", "open"),
    ("Change account owner", "pending"),
    ("Resolve calendar sync delay", "open"),
]


class Command(BaseCommand):
    help = "Restore the sample support queue."

    @transaction.atomic
    def handle(self, *args, **options):
        Ticket.objects.all().delete()
        Ticket.objects.bulk_create([Ticket(title=title, status=status) for title, status in TICKETS])
        self.stdout.write("Seeded 12 support tickets.")
