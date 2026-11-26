from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Ticket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=160)),
                ("status", models.CharField(choices=[("open", "Open"), ("pending", "Pending"), ("closed", "Closed")], max_length=12)),
            ],
        )
    ]
