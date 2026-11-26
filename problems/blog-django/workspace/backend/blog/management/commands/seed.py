import json
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from blog.models import Author, Post

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "data" / "seed.json"


class Command(BaseCommand):
    help = "Restore the four sample authors and their ten posts."

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        Author.objects.all().delete()
        authors = {}
        password = make_password("password123")
        for entry in data["authors"]:
            author = Author.objects.create(password=password, **entry)
            authors[author.email] = author
        for article in data["posts"]:
            record = dict(article)
            record["author"] = authors[record.pop("email")]
            Post.objects.create(**record)
        self.stdout.write("Created 4 authors and 10 posts.")
