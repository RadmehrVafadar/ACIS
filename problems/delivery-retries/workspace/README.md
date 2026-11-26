# Parcel tracking

Handheld scanners queue requests offline and can deliver the same request more than once.
A parcel's current facility is the facility from its most recently accepted new event, in server acceptance order.

## Reproduce

Run the application and open the Dispatch preview on port 8080.
Parcel PKG-1047 starts at Riverside Hub with two scans in its history.
Replay scan-41, the earlier Union Depot event.
An exact replay must leave both the history and the current facility unchanged.
You can also submit a new scan or reuse an existing event ID with another facility using the form.

## API contract

`GET /api/parcels` lists the tracking numbers.
`GET /api/parcels/<tracking_number>/scans` returns the current facility and all scans in acceptance order.
`POST /api/parcels/<tracking_number>/scans` accepts JSON with an `event_id` and a `facility`.

- A new ID for this parcel creates one event, updates the current facility, and returns HTTP 201.
- The same ID and facility for this parcel returns HTTP 200 with the original event, including its original receipt time.
- The same ID with a different facility returns HTTP 409 and preserves the parcel and its history.
- Distinct IDs are separate scans even at the same facility.
- Each parcel has its own event ID namespace.

## Local commands

```bash
bash setup.sh
bash seed.sh
bash run.sh
bash test.sh
```

Use `bash seed.sh` to restore the demonstration routes.
The grader runs the protected tests in `backend/tracking/tests/test_scans.py` against a separate PostgreSQL database.
