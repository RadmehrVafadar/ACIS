from pathlib import Path

from django.http import FileResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Ticket


def queue(request):
    return FileResponse(Path(__file__).with_name("queue.html").open("rb"), content_type="text/html")


@api_view(["GET"])
def ticket_list(request):
    try:
        page = int(request.query_params.get("page", "1"))
        size = int(request.query_params.get("page_size", "3"))
    except ValueError:
        return Response({"detail": "Page and page_size must be integers."}, status=400)
    if page < 1 or not 1 <= size <= 50:
        return Response({"detail": "Use a positive page and a page_size from 1 to 50."}, status=400)
    query = Ticket.objects.order_by("-id")
    status = request.query_params.get("status")
    if status:
        if status not in dict(Ticket.STATUS):
            return Response({"detail": "Unknown status."}, status=400)
        query = query.filter(status=status)
    count = query.count()
    start = (page - 1) * size
    rows = query[start : start + size].values("id", "title", "status")
    return Response({"page": page, "page_size": size, "count": count, "results": list(rows)})
