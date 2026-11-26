from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.core.management import call_command
from django.db import connections
from rest_framework.test import APIClient

from reservations.models import Reservation


@pytest.fixture
def calendar(db):
    call_command("seed")
    return APIClient()


def book(client, start, end, room="atlas"):
    return client.post(
        f"/api/rooms/{room}/reservations",
        {"title": "Design review", "starts_at": f"2027-01-19T{start}:00Z", "ends_at": f"2027-01-19T{end}:00Z"},
        format="json",
    )


def test_existing_meeting_can_be_followed_or_preceded_immediately(calendar):
    before = book(calendar, "09:30", "10:00")
    assert before.status_code == 201, before.json()
    after = book(calendar, "11:00", "11:30")
    assert after.status_code == 201, after.json()
    saved = calendar.get("/api/rooms/atlas/reservations").json()
    assert [item["id"] for item in saved if item["title"] == "Design review"] == [
        before.json()["id"], after.json()["id"],
    ]


def test_partial_and_full_overlaps_preserve_the_schedule(calendar):
    original = list(Reservation.objects.order_by("id").values())
    for start, end in [("10:30", "11:30"), ("10:15", "10:45"), ("09:30", "11:30"), ("10:00", "11:00")]:
        result = book(calendar, start, end)
        assert result.status_code == 409, (start, end, result.json())
        assert list(Reservation.objects.order_by("id").values()) == original


def test_independent_rooms_and_invalid_intervals(calendar):
    assert book(calendar, "10:00", "11:00", "cedar").status_code == 201
    assert book(calendar, "11:00", "11:00").status_code == 400
    assert book(calendar, "11:00", "10:30").status_code == 400
    assert book(calendar, "10:00", "11:00", "missing").status_code == 404
    assert Reservation.objects.count() == 4


@pytest.mark.django_db(transaction=True)
def test_simultaneous_requests_only_reserve_once():
    call_command("seed")
    barrier = Barrier(2)

    def submit():
        try:
            barrier.wait(timeout=10)
            return book(APIClient(), "15:00", "16:00").status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = [pool.submit(submit) for _ in range(2)]
        assert sorted(response.result(timeout=20) for response in responses) == [201, 409]
    assert Reservation.objects.filter(room__slug="atlas", title="Design review").count() == 1
