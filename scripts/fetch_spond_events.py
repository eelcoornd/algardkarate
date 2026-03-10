import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from spond import spond

USERNAME = os.environ.get("SPOND_USERNAME", "")
PASSWORD = os.environ.get("SPOND_PASSWORD", "")

if not USERNAME or not PASSWORD:
    print("ERROR: credentials not set!", flush=True)
    sys.exit(1)

# Titles å ekskludere (ikke relevante for treningsoversikt)
EXCLUDE_TITLES = {"påskeferie", "Påskeferie veke 14", "2.pinsedag", "Himmelfartsdag", "siste skuledag for elevane"}

print(f"Logging in as {USERNAME[:3]}***", flush=True)

async def main():
    s = spond.Spond(username=USERNAME, password=PASSWORD)

    min_start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    max_end   = datetime(2026, 12, 31, tzinfo=timezone.utc)

    all_events = await s.get_events(
        min_start=min_start,
        max_end=max_end,
        include_scheduled=True,
        max_events=500
    )
    print(f"Fetched {len(all_events)} total events", flush=True)

    now = datetime.now(tz=timezone.utc)
    output = []
    for event in all_events:
        title = event.get("heading", "")
        start = event.get("startTimestamp", "")

        # Ekskluder ikke-relevante events
        if title in EXCLUDE_TITLES:
            continue

        # Ekskluder events som allerede er ferdig (mer enn 2 timer siden)
        try:
            end_dt = datetime.fromisoformat(event.get("endTimestamp", start).replace("Z", "+00:00"))
            if end_dt < now:
                continue
        except:
            pass

        output.append({
            "id": event.get("id", ""),
            "title": title,
            "start": start,
            "end": event.get("endTimestamp", ""),
            "description": event.get("description", ""),
            "location": event.get("location", {}).get("feature", "") if event.get("location") else "",
            "cancelled": event.get("cancelled") or False,
        })

    output.sort(key=lambda e: e["start"])

    os.makedirs("data", exist_ok=True)
    with open("data/spond_events.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"Saved {len(output)} events to data/spond_events.json", flush=True)
    await s.clientsession.close()

asyncio.run(main())
