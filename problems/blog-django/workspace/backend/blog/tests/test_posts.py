import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from blog.models import Author, Post


@pytest.fixture
def author_client(db):
    call_command("seed", verbosity=0)
    john = Author.objects.get(email="john@example.com")
    client = APIClient()
    client.raise_request_exception = False
    client.credentials(HTTP_X_USER_ID=john.pk)
    return john, client


def test_create_response_and_values(author_client):
    john, client = author_client
    payload = {
        "title": "Shipping a smaller API", "content": "A field note from reducing a public API.",
        "category": "Technology", "excerpt": "Notes from the release.",
        "tags": ["api", "release", "design"], "readTime": 5,
    }
    response = client.post("/api/posts", payload, format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["message"] == "Post created successfully"
    post = body["post"]
    assert {key: post[key] for key in payload} == payload
    assert post["published"] is True
    assert post["author"] == {"_id": john.pk, "name": "John Doe", "email": john.email, "bio": john.bio}


def test_created_post_is_saved_and_appears_in_my_posts(author_client):
    john, client = author_client
    payload = {
        "title": "An overnight train", "content": "A journal entry from the last sleeper train.",
        "category": "Travel", "excerpt": "From the upper berth.",
        "tags": ["trains", "travel", "journal"], "readTime": 3,
    }
    response = client.post("/api/posts", payload, format="json")
    assert response.status_code == 201
    post_id = response.json()["post"]["_id"]
    stored = Post.objects.get(pk=post_id)
    assert stored.author == john and stored.published
    assert stored.title == payload["title"] and stored.content == payload["content"]
    assert stored.category == payload["category"] and stored.excerpt == payload["excerpt"]
    assert stored.read_time == payload["readTime"] and stored.tags == payload["tags"]
    listing = client.get("/api/posts/my-posts")
    assert listing.status_code == 200
    assert any(p["_id"] == post_id and p["title"] == payload["title"] for p in listing.json()["posts"])
