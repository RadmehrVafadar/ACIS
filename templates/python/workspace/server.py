import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from queue_app import unread

ARTICLES = [{"title": "Query plans", "read": False}, {"title": "Indexes", "read": True}]


class QueueHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(unread(ARTICLES)).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8000), QueueHandler).serve_forever()
