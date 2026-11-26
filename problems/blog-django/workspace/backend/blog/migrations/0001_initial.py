import django.db.models.deletion
from django.db import migrations, models

from blog.models import new_id


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Author",
            fields=[
                ("id", models.CharField(primary_key=True, max_length=24, default=new_id, editable=False, serialize=False)),
                ("name", models.CharField(max_length=160)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("password", models.CharField(max_length=256)),
                ("bio", models.TextField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name="Post",
            fields=[
                ("id", models.CharField(primary_key=True, max_length=24, default=new_id, editable=False, serialize=False)),
                ("title", models.TextField()),
                ("content", models.TextField()),
                ("category", models.CharField(max_length=32, choices=[(x, x) for x in (
                    "Technology", "Lifestyle", "Travel", "Food", "Business", "Health", "Education", "Entertainment",
                )])),
                ("excerpt", models.TextField(blank=True)),
                ("tags", models.JSONField(default=list)),
                ("read_time", models.PositiveIntegerField(default=5)),
                ("published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="posts", to="blog.author")),
            ],
            options={"ordering": ("-created_at", "-id")},
        ),
    ]
