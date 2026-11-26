from django.db import models


class Invoice(models.Model):
    number = models.CharField(max_length=24, unique=True)
    customer = models.CharField(max_length=120)


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, related_name="lines", on_delete=models.CASCADE)
    description = models.CharField(max_length=120)
    amount_cents = models.PositiveIntegerField()


class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, related_name="payments", on_delete=models.CASCADE)
    receipt = models.CharField(max_length=40, unique=True)
    amount_cents = models.PositiveIntegerField()
