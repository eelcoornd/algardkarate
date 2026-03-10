import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from spond import spond

USERNAME = os.environ.get("SPOND_USERNAME", "")
PASSWORD = os.environ.get("SPOND_PASSWORD", "")

if not USERNAME or not PASSWORD:
    print("ERROR: SPOND_USERNAME or SPOND_PASSWORD not set!", flush=True)
    sys.exit(1)

print(f"Logging in as {USERNAME[:3]}***", flush=True)

async def main():
    s = spond.Spond(username=USERNAME, password=PASSWORD)
    events = await s.get_events(min_start=datetime.now(tz=timezone.utc))
    print(f"Fetched {len(events)} events", flush=True)
    output = []
    for event in events:
        output.append({
            "id": event["id"],
            "title": event["heading"],
            "start": event["startTimestamp"],
            "end": event["endTimestamp"],
            "description": event.get("description", ""),
            "location": event.get("location", {}).get("feature", ""),
            "cancelled": event.get("cancelled", False)
        })
    os.makedirs("data", exist_ok=True)
    with open("data/spond_events.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print("Saved to data/spond_events.json", flush=True)
    await s.clientsession.close()

asyncio.run(main())
