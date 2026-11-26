from django.db import models


class Ticket(models.Model):
    STATUS = (("open", "Open"), ("pending", "Pending"), ("closed", "Closed"))
    title = models.CharField(max_length=160)
    status = models.CharField(max_length=12, choices=STATUS)

    def __str__(self):
        return self.title
