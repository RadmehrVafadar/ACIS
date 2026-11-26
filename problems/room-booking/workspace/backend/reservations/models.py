from django.db import models


class Room(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=80)


class Reservation(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="bookings")
    title = models.CharField(max_length=100)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()

    class Meta:
        constraints = (
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="reservation_ends_after_start",
            ),
        )
        indexes = (models.Index(fields=["room", "starts_at"], name="reservation_room_start"),)
