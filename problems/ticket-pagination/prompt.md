# Issue: Ticket Queue Pagination

Support staff page through a filtered queue and see tickets missing or page counts that do not match the filter.
Repair the API so staff can read every matching ticket exactly once in newest-first order.

1. Run the app and open the **Tickets** preview.
2. Select a status and move between pages.
3. Compare the records and counts with `GET /api/tickets?status=open&page=1&page_size=3`.
4. Run the two database-backed tests and repair the behavior.
