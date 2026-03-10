import asyncio
import json
from zoneinfo import ZoneInfo
import os
import sys
from datetime import datetime, timezone
from spond import spond

USERNAME = os.environ.get("SPOND_USERNAME", "")
PASSWORD = os.environ.get("SPOND_PASSWORD", "")

if not USERNAME or not PASSWORD:
    print("ERROR: credentials not set!", flush=True)
    sys.exit(1)

# Subgrupper som IKKE skal vises (kun admin/trener-interne events)
EXCLUDE_ONLY_SUBGROUPS = {"Admin", "Trenere", "Kamptrening"}

# Titler som alltid skal vises uansett subgruppe
ALWAYS_INCLUDE_TITLES = {
    "Gradering", "Gradering + ny belte", "Nybegynner gradering",
    "Sesongavslutning", "Kamptrening graderte", "Vinterleir ETNE -oppdatert-",
    "Åpen Fight Camp Bryne Karateklubb 09.01.26-11.01.26",
    "Publikum til NM Fullkontakt 2026 på Bryne"
}

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

        # Ekskluder events som KUN har Admin/Trenere/Kamptrening subgrupper
        group = event.get("recipients", {}).get("group", {})
        subgroups = {sg.get("name") for sg in group.get("subGroups", [])}
        # Alltid inkluder spesielle events
        if title in ALWAYS_INCLUDE_TITLES:
            pass
        else:
            # Krev minst én belt-subgruppe (ikke bare Admin/Trenere/tom)
            allowed = subgroups - EXCLUDE_ONLY_SUBGROUPS
            if not allowed:
                continue

        # Ekskluder events som allerede er ferdig (mer enn 2 timer siden)
        try:
            end_dt = datetime.fromisoformat(event.get("endTimestamp", start).replace("Z", "+00:00"))
            if end_dt < now:
                continue
        except:
            pass

        oslo = ZoneInfo("Europe/Oslo")
        def to_oslo(ts):
            if not ts:
                return ts
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.astimezone(oslo).strftime("%Y-%m-%dT%H:%M:%S")

        output.append({
            "id": event.get("id", ""),
            "title": title,
            "start": to_oslo(start),
            "end": to_oslo(event.get("endTimestamp", "")),
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
