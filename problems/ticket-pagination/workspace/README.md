# Ticket Queue: Pagination

A small Django REST Framework service provides a support queue backed by PostgreSQL.
The status filter and pagination must describe the same ordered result set.

## API

`GET /api/tickets` accepts optional `status` (open, pending, or closed), a one-based `page`, and a `page_size` between 1 and 50.
Defaults are page 1 and 3 items per page.
Return the requested page, the page size, the number of matching tickets, and a `results` array of newest-first records with id, title, and status.
The final page may be short and pages beyond the end return an empty array.
Invalid parameters return HTTP 400.
The browser queue on port 8080 exercises the same endpoint.

## Commands

```bash
bash setup.sh
bash seed.sh
bash run.sh
bash test.sh
python -m pytest backend/tickets/tests/test_pagination.py -k filtered
```

To inspect a breakpoint alongside the preview, start **Django API (port 8082)** in Debug and call `http://127.0.0.1:8082/api/tickets` from the workspace terminal.

## Protected files

Keep README.md, setup.sh, seed.sh, test.sh, requirements.txt, pytest.ini, backend/config/settings.py, backend/tickets/management/commands/seed.py, and backend/tickets/tests/test_pagination.py intact.
