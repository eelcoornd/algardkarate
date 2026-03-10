import asyncio
import json
import os
from datetime import datetime, timezone
from spond import spond

USERNAME = os.environ["SPOND_USERNAME"]
PASSWORD = os.environ["SPOND_PASSWORD"]

async def main():
    s = spond.Spond(username=USERNAME, password=PASSWORD)
    events = await s.get_events(min_start=datetime.now(tz=timezone.utc))
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
    await s.clientsession.close()

asyncio.run(main())
