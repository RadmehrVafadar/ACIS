from django.urls import path

from blog import views

urlpatterns = [
    path("", views.health),
    path("api/auth/login", views.login),
    path("api/auth/me", views.me),
    path("api/posts", views.posts),
    path("api/posts/my-posts", views.my_posts),
    path("api/posts/<str:post_id>", views.post_detail),
]
