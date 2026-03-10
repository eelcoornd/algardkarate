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

ALLOWED_SUBGROUPS = {
    "0D59F1E8010048C194198CB81DA394B2",
    "0FBFF193CDC448589B6BB8BDA7789138",
    "203AA68374B14D358E79FEF640E3E3DC",
    "3ED49243F50A4908BC165187DB4BF063",
    "40F6D9142C2D4DDA8144590098A8ED3C",
    "513BAED6579B40A3BF3A0FDAC67F7D9C",
    "54FC45F0DE8F41E9BB3ABBD746718FAE",
    "6B3C0257AFA44DBE957A04C6A3FD49E0",
    "8221E1EEFA8E418BBA0C1A8D476E27E5",
    "913A9D4055234D5BB176EE1322814E69",
    "9A4CDEF198AD4B84870BF8734B829F27",
    "A6D986AC386A49529980AE1E9FDF7574",
    "AADD692B10724378962738D87C9ACC9E",
    "D3E912AB523E43DE8841DCAB752C513E",
    "E8DAE1A23B264567A6503204A6E52EF1",
}

print(f"Logging in as {USERNAME[:3]}***", flush=True)

async def main():
    s = spond.Spond(username=USERNAME, password=PASSWORD)
    now = datetime.now(tz=timezone.utc)

    all_events = await s.get_events(
        min_start=now,
        max_end=None,
        include_scheduled=True,
        max_events=500
    )
    print(f"Fetched {len(all_events)} total events", flush=True)

    output = []
    for event in all_events:
        # Sjekk om event tilhører en av de tillatte subgruppene
        recipients = event.get("recipients", {})
        subgroups = recipients.get("subGroups", []) if recipients else []
        subgroup_ids = {sg.get("id", "") for sg in subgroups}

        if not subgroup_ids.intersection(ALLOWED_SUBGROUPS):
            continue

        output.append({
            "id": event.get("id", ""),
            "title": event.get("heading", ""),
            "start": event.get("startTimestamp", ""),
            "end": event.get("endTimestamp", ""),
            "description": event.get("description", ""),
            "location": event.get("location", {}).get("feature", "") if event.get("location") else "",
            "cancelled": event.get("cancelled", False),
            "subgroups": list(subgroup_ids.intersection(ALLOWED_SUBGROUPS))
        })

    output.sort(key=lambda e: e["start"])

    os.makedirs("data", exist_ok=True)
    with open("data/spond_events.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"Saved {len(output)} filtered events to data/spond_events.json", flush=True)
    await s.clientsession.close()

asyncio.run(main())
