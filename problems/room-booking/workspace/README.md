# Room booking service

The facilities team uses this Django service to reserve shared rooms.
Atlas already has a meeting from 10:00 to 11:00 UTC on January 19, 2027.

## Reproduction

Open the **Room calendar** preview after selecting **Run**.
Request 09:30 to 10:00 in Atlas, then request 10:30 to 11:30 on the same date.
Inspect the HTTP status and refresh the calendar to see which meetings were saved.
Use **Reset data** to restore the demonstration schedule.

## API contract

- `GET /api/rooms` lists the available rooms.
- `GET /api/rooms/{slug}/reservations` lists that room's reservations in chronological order.
- `POST /api/rooms/{slug}/reservations` accepts a title and ISO 8601 timestamps named `starts_at` and `ends_at`.
- A successful creation returns HTTP 201 with the saved reservation and its ID.
- Two reservations may touch at an endpoint or use different rooms at the same time.
- Any positive-duration overlap in the same room returns HTTP 409 and leaves its schedule unchanged.
- Two simultaneous requests for an identical free slot can create at most one reservation.
- Empty or reversed intervals return HTTP 400 and an unknown room returns HTTP 404.

All times displayed in the calendar are UTC.
Run the four PostgreSQL-backed checks with **Run Tests** or `bash test.sh`.
