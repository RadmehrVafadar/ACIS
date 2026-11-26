from django.urls import path
from tracking import views

urlpatterns = [
    path("", views.console),
    path("api/parcels", views.parcels),
    path("api/parcels/<slug:tracking_number>/scans", views.scans),
]
