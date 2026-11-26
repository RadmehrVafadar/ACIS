from django.db import migrations, models
from django.db.models.deletion import CASCADE


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Invoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.CharField(max_length=24, unique=True)),
                ("customer", models.CharField(max_length=120)),
            ],
        ),
        migrations.CreateModel(
            name="InvoiceLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.CharField(max_length=120)),
                ("amount_cents", models.PositiveIntegerField()),
                ("invoice", models.ForeignKey(on_delete=CASCADE, related_name="lines", to="billing.invoice")),
            ],
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("receipt", models.CharField(max_length=40, unique=True)),
                ("amount_cents", models.PositiveIntegerField()),
                ("invoice", models.ForeignKey(on_delete=CASCADE, related_name="payments", to="billing.invoice")),
            ],
        ),
    ]
