from django.contrib.auth.hashers import check_password
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from .models import Author, Post
from .serializers import AuthorSerializer, PostInputSerializer, PostSerializer


class LoginRequired(APIException):
    status_code = 401
    default_detail = "Please sign in."


def current_author(request):
    identity = request.headers.get("x-user-id")
    if not identity:
        raise LoginRequired()
    return get_object_or_404(Author, pk=identity)


def health(request):
    return HttpResponse("Blog API is running.", content_type="text/plain")


@api_view(["POST"])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password")
    if not email or not password:
        return Response({"message": "Email and password are required"}, status=400)
    author = Author.objects.filter(email=email).first()
    if not author or not check_password(password, author.password):
        return Response({"message": "Invalid email or password"}, status=401)
    return Response({"message": "Login successful", "user": AuthorSerializer(author).data})


@api_view(["GET"])
def me(request):
    return Response({"user": AuthorSerializer(current_author(request)).data})


@api_view(["GET", "POST"])
def posts(request):
    if request.method == "GET":
        feed = Post.objects.filter(published=True).select_related("author")
        return Response({"posts": PostSerializer(feed, many=True).data})

    author = current_author(request)
    submission = PostInputSerializer(data=request.data)
    submission.is_valid(raise_exception=True)
    post = submission.save(author=author)
    return Response({"message": "Post created successfully", "post": PostSerializer(post).data}, status=201)


@api_view(["GET"])
def my_posts(request):
    articles = Post.objects.filter(author=current_author(request)).select_related("author")
    return Response({"posts": PostSerializer(articles, many=True).data})


@api_view(["GET", "PUT", "DELETE"])
def post_detail(request, post_id):
    post = get_object_or_404(Post.objects.select_related("author"), pk=post_id)
    if request.method == "GET":
        return Response({"post": PostSerializer(post).data})
    if post.author_id != current_author(request).pk:
        return Response({"message": "Only the author can change this post"}, status=403)
    if request.method == "DELETE":
        post.delete()
        return Response({"message": "Post deleted successfully"})
    changes = PostInputSerializer(post, data=request.data, partial=True)
    changes.is_valid(raise_exception=True)
    changes.save()
    return Response({"message": "Post updated successfully", "post": PostSerializer(post).data})
