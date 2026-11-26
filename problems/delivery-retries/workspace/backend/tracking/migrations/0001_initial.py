import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Parcel",
            fields=[
                ("tracking_number", models.SlugField(primary_key=True, serialize=False)),
                ("current_facility", models.CharField(blank=True, max_length=80)),
            ],
        ),
        migrations.CreateModel(
            name="Scan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.SlugField(max_length=64)),
                ("facility", models.CharField(max_length=80)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("parcel", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="scans", to="tracking.parcel")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("parcel", "event_id"), name="unique_parcel_event")
                ]
            },
        ),
    ]
