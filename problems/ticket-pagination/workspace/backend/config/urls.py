from django.urls import path

from tickets.views import queue, ticket_list

urlpatterns = [path("", queue), path("api/tickets", ticket_list)]
