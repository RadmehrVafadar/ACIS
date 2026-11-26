import math

from rest_framework import serializers

from .models import CATEGORIES, Author, Post


class AuthorSerializer(serializers.ModelSerializer):
    _id = serializers.CharField(source="pk", read_only=True)

    class Meta:
        model = Author
        fields = ("_id", "name", "email", "bio")


class PostSerializer(serializers.ModelSerializer):
    _id = serializers.CharField(source="pk", read_only=True)
    author = AuthorSerializer(read_only=True)
    readTime = serializers.IntegerField(source="read_time", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Post
        fields = (
            "_id", "title", "content", "excerpt", "tags", "category", "readTime",
            "author", "published", "createdAt", "updatedAt",
        )


class PostInputSerializer(serializers.ModelSerializer):
    category = serializers.ChoiceField(choices=CATEGORIES)
    content = serializers.CharField(trim_whitespace=False)
    tags = serializers.ListField(child=serializers.CharField(allow_blank=True), required=False)
    readTime = serializers.IntegerField(source="read_time", min_value=0, required=False)

    class Meta:
        model = Post
        fields = ("title", "content", "category", "excerpt", "tags", "readTime")

    def validate(self, attrs):
        if "content" in attrs:
            if not attrs.get("excerpt") and (not self.partial or "excerpt" in attrs):
                attrs["excerpt"] = attrs["content"][:150].strip()
            attrs.setdefault("read_time", math.ceil(len(attrs["content"].split()) / 200))
        return attrs
