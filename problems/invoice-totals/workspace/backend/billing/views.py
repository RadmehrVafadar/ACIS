from decimal import Decimal

from django.shortcuts import get_object_or_404, render
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Invoice
from .statements import statements


def dollars(cents):
    return format(Decimal(cents).scaleb(-2), ",.2f")


def ledger(request):
    invoices = Invoice.objects.order_by("number")
    number = request.GET.get("number")
    selected = get_object_or_404(statements(), number=number) if number else statements().first()
    context = {"invoices": invoices, "selected": selected}
    if selected:
        context.update(
            billed=dollars(selected.billed_cents),
            paid=dollars(selected.paid_cents),
            balance=dollars(selected.balance_cents),
            charges=[(line.description, dollars(line.amount_cents)) for line in selected.lines.order_by("id")],
            payments=[(p.receipt, dollars(p.amount_cents)) for p in selected.payments.order_by("id")],
        )
    return render(request, "billing/ledger.html", context)


@api_view(["GET"])
def statement_list(request):
    rows = statements().values("number", "customer", "billed_cents", "paid_cents", "balance_cents")
    return Response({"invoices": list(rows)})
