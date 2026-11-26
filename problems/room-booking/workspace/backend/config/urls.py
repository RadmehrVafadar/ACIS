from django.urls import path
from reservations import views

urlpatterns = [
    path("", views.calendar),
    path("api/rooms", views.rooms),
    path("api/rooms/<slug:room_slug>/reservations", views.reservations),
]
