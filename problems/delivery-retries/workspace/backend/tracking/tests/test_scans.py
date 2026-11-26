import pytest
from rest_framework.test import APIClient

from tracking.models import Parcel


@pytest.fixture
def scanner(db):
    client = APIClient()
    parcel = Parcel.objects.create(tracking_number="PKG-88")
    return client, f"/api/parcels/{parcel.pk}/scans"


def send(client, endpoint, event, facility):
    return client.post(endpoint, {"event_id": event, "facility": facility}, format="json")


def test_replayed_event_keeps_the_latest_location(scanner):
    client, endpoint = scanner
    original = send(client, endpoint, "handset-10", "Union Depot")
    assert original.status_code == 201
    assert send(client, endpoint, "handset-11", "Riverside Hub").status_code == 201

    replay = send(client, endpoint, "handset-10", "Union Depot")
    assert replay.status_code == 200
    assert replay.json() == original.json()
    detail = client.get(endpoint).json()
    assert detail["current_facility"] == "Riverside Hub"
    assert [scan["event_id"] for scan in detail["scans"]] == ["handset-10", "handset-11"]


def test_conflicting_payload_leaves_tracking_unchanged(scanner):
    client, endpoint = scanner
    assert send(client, endpoint, "handset-12", "Harbor Terminal").status_code == 201
    before = client.get(endpoint).json()
    conflict = send(client, endpoint, "handset-12", "Union Depot")
    assert conflict.status_code == 409
    assert client.get(endpoint).json() == before


def test_distinct_ids_and_separate_parcels_have_independent_events(scanner):
    client, endpoint = scanner
    for event in ["shift-19", "shift-20"]:
        assert send(client, endpoint, event, "Union Depot").status_code == 201
    other = Parcel.objects.create(tracking_number="PKG-99")
    other_endpoint = f"/api/parcels/{other.pk}/scans"
    assert send(client, other_endpoint, "shift-19", "Harbor Terminal").status_code == 201
    assert client.get(other_endpoint).json()["current_facility"] == "Harbor Terminal"
    detail = client.get(endpoint).json()
    assert detail["current_facility"] == "Union Depot"
    assert [s["event_id"] for s in detail["scans"]] == ["shift-19", "shift-20"]
