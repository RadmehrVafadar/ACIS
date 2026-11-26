# Room Booking Conflicts

Office coordinators report that the calendar blocks free slots yet accepts some requests during an existing meeting.
The issue is visible in Atlas, which has a release review from 10:00 to 11:00 UTC on January 19, 2027.

1. Run the project and open **Room calendar**.
2. In Atlas, request 09:30 to 10:00 UTC, followed by 10:30 to 11:30 UTC.
3. Compare the responses and saved schedule with the contract in the workspace README.
4. Repair the Django API and run the four database-backed checks.

Back-to-back meetings must work, and a conflict must leave the calendar unchanged.
