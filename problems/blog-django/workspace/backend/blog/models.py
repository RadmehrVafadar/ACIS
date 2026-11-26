import secrets

from django.db import models


def new_id():
    return secrets.token_hex(12)


CATEGORIES = (
    "Technology", "Lifestyle", "Travel", "Food",
    "Business", "Health", "Education", "Entertainment",
)


class Author(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=new_id, editable=False)
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=256)
    bio = models.TextField(blank=True)


class Post(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=new_id, editable=False)
    title = models.TextField()
    content = models.TextField()
    category = models.CharField(max_length=32, choices=[(c, c) for c in CATEGORIES])
    excerpt = models.TextField(blank=True)
    tags = models.JSONField(default=list)
    read_time = models.PositiveIntegerField(default=5)
    published = models.BooleanField(default=True)
    author = models.ForeignKey(Author, related_name="posts", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
