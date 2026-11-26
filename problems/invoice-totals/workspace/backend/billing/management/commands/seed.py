from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import Invoice, InvoiceLine, Payment


class Command(BaseCommand):
    help = "Restore the demonstration ledger"

    @transaction.atomic
    def handle(self, *args, **options):
        Invoice.objects.all().delete()
        fixtures = [
            ("INV-1042", "Harbor Print Co.", [("Press setup", 8500), ("Color proof", 8500), ("Delivery", 3000)],
             [("RC-7102", 6000), ("RC-7115", 6000)]),
            ("INV-1043", "Northline Ceramics", [("Studio rental", 9500)], []),
            ("INV-1044", "Dovetail Books", [("Bookbinding supplies", 4200)], [("RC-7121", 5000)]),
            ("INV-1045", "West Quay Studio", [], []),
        ]
        for number, customer, lines, payments in fixtures:
            invoice = Invoice.objects.create(number=number, customer=customer)
            InvoiceLine.objects.bulk_create([
                InvoiceLine(invoice=invoice, description=description, amount_cents=amount)
                for description, amount in lines
            ])
            Payment.objects.bulk_create([
                Payment(invoice=invoice, receipt=receipt, amount_cents=amount)
                for receipt, amount in payments
            ])
