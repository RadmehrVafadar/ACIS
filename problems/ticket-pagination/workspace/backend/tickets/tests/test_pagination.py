import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from tickets.models import Ticket


@pytest.fixture
def queue(db):
    call_command("seed", verbosity=0)
    return APIClient()


def test_adjacent_pages_cover_newest_tickets_without_gaps(queue):
    expected = list(Ticket.objects.order_by("-id").values_list("pk", flat=True))
    pages = [queue.get("/api/tickets", {"page": n, "page_size": 5}) for n in range(1, 4)]
    assert all(response.status_code == 200 for response in pages)
    bodies = [response.json() for response in pages]
    assert [ticket["id"] for body in bodies for ticket in body["results"]] == expected
    assert [len(body["results"]) for body in bodies] == [5, 5, 2]


def test_filtered_count_and_last_page(queue):
    matching = Ticket.objects.filter(status="open").order_by("-id")
    response = queue.get("/api/tickets", {"status": "open", "page": 2, "page_size": 4})
    assert response.status_code == 200
    page = response.json()
    assert page["count"] == matching.count()
    assert page["page"] == 2 and page["page_size"] == 4
    assert page["results"] == list(matching[4:8].values("id", "title", "status"))
    assert queue.get("/api/tickets", {"status": "open", "page": 3, "page_size": 4}).json()["results"] == []
