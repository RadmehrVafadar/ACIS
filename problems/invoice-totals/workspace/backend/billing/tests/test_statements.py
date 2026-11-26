import pytest

from ..models import Invoice, InvoiceLine, Payment

pytestmark = pytest.mark.django_db


def invoice(number, lines=(), payments=()):
    entry = Invoice.objects.create(number=number, customer=f"Account {number}")
    for index, cents in enumerate(lines, start=1):
        InvoiceLine.objects.create(invoice=entry, description=f"Service {index}", amount_cents=cents)
    for index, cents in enumerate(payments, start=1):
        Payment.objects.create(invoice=entry, receipt=f"{number}-{index}", amount_cents=cents)
    return entry


def test_statement_agrees_with_each_posted_entry(client):
    record = invoice("INV-5218", lines=[4700, 4700, 1050], payments=[3000, 3000])
    response = client.get("/api/invoices")
    assert response.status_code == 200
    assert response.json()["invoices"] == [
        {"number": record.number, "customer": record.customer,
         "billed_cents": 10450, "paid_cents": 6000, "balance_cents": 4450}
    ]
    html = client.get("/", {"number": record.number})
    assert html.status_code == 200
    assert "$44.50" in html.content.decode()


def test_batch_preserves_credits_empty_accounts_and_query_budget(client, django_assert_max_num_queries):
    invoice("INV-7104", lines=[3450, 550], payments=[1700, 3200])
    invoice("INV-7102", lines=[4999])
    invoice("INV-7103", payments=[810])
    invoice("INV-7101")
    with django_assert_max_num_queries(3):
        response = client.get("/api/invoices")
        assert response.status_code == 200
        data = response.json()["invoices"]
    assert [(r["number"], r["billed_cents"], r["paid_cents"], r["balance_cents"]) for r in data] == [
        ("INV-7101", 0, 0, 0),
        ("INV-7102", 4999, 0, 4999),
        ("INV-7103", 0, 810, -810),
        ("INV-7104", 4000, 4900, -900),
    ]
    assert InvoiceLine.objects.count() == 3
    assert Payment.objects.count() == 3
