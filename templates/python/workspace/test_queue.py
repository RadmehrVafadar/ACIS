from queue_app import unread


def test_returns_unread_in_original_order():
    entries = [{"id": 1, "read": False}, {"id": 2, "read": True}, {"id": 3, "read": False}]
    assert [item["id"] for item in unread(entries)] == [1, 3]
