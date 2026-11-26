from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Room",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("name", models.CharField(max_length=80)),
            ],
        ),
        migrations.CreateModel(
            name="Reservation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=100)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField()),
                ("room", models.ForeignKey(on_delete=models.CASCADE, related_name="bookings", to="reservations.room")),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(ends_at__gt=models.F("starts_at")),
                        name="reservation_ends_after_start",
                    ),
                ],
                "indexes": [models.Index(fields=["room", "starts_at"], name="reservation_room_start")],
            },
        ),
    ]
