from django.db.models import BigIntegerField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from .models import Invoice, InvoiceLine, Payment


def total_for_invoice(model):
    group = (
        model.objects.filter(invoice_id=OuterRef("pk"))
        .values("invoice_id")
        .annotate(cents=Sum("amount_cents"))
    )
    money = BigIntegerField()
    return Coalesce(Subquery(group.values("cents"), output_field=money), Value(0, output_field=money))


def statements():
    return (
        Invoice.objects.annotate(
            billed_cents=total_for_invoice(InvoiceLine),
            paid_cents=total_for_invoice(Payment),
        )
        .annotate(balance_cents=F("billed_cents") - F("paid_cents"))
        .order_by("number")
    )
