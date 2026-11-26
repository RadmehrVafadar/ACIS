from django.db import models


class Parcel(models.Model):
    tracking_number = models.SlugField(primary_key=True)
    current_facility = models.CharField(max_length=80, blank=True)


class Scan(models.Model):
    parcel = models.ForeignKey(Parcel, related_name="scans", on_delete=models.CASCADE)
    event_id = models.SlugField(max_length=64)
    facility = models.CharField(max_length=80)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = (
            models.UniqueConstraint(fields=("parcel", "event_id"), name="unique_parcel_event"),
        )
