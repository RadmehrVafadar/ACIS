# Parcel scan replays

A parcel reached Riverside Hub.
Hours later, a handheld scanner reconnected and resent an earlier scan from Union Depot.
Dispatch now shows the parcel back at Union Depot, although the scan history still ends at Riverside.

1. Start **Run** and open the **Dispatch** preview.
2. Select **PKG-1047** and replay **scan-41** from its history.
3. Compare the current facility with the newest accepted scan.
4. Use the Django code and the visible API tests to repair ingestion.

New scans, exact retries, and reused IDs with conflicting data have different contracts.
See the candidate README for the response codes and persistence requirements.
