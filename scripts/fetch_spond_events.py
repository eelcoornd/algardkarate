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
EXCLUDE_ONLY_SUBGROUPS = {"Admin", "Trenere"}

# Titler som alltid skal vises uansett subgruppe
ALWAYS_INCLUDE_TITLES = {
    "Gradering", "Gradering + ny belte", "Nybegynner gradering",
    "Sesongavslutning", "Kamptrening graderte", "Vinterleir ETNE -oppdatert-",
    "Åpen Fight Camp Bryne Karateklubb 09.01.26-11.01.26",
    "Publikum til NM Fullkontakt 2026 på Bryne"
}

# Tittel-substringer som alltid skal inkluderes (uansett subgruppe-oppsett)
# NB: "gradering" alene ekskluderer "gradering øvelse" (mock-gradering,
# trener-intern planlegging) via ordgrense-sjekk under.
ALWAYS_INCLUDE_KEYWORDS = (
    "sommerleir", "vinterleir", "leir", "gradering",
    "sesongavslutning", "fight camp", "nm",
)

# Titler som ALDRI skal tvinges inn selv om de matcher et alltid-inkluder nøkkelord
# (trener-interne planleggingsnotater, ikke reelle klubb-arrangementer)
NEVER_FORCE_INCLUDE_KEYWORDS = (
    "gradering øvelse", "graderings trening", "gradering-øvelse",
)

print(f"Logging in as {USERNAME[:3]}***", flush=True)

async def main():
    s = spond.Spond(username=USERNAME, password=PASSWORD)

    # Rullerende vindu: fra 1. januar i år til 31. desember neste år, slik at
    # events lenger frem i tid (f.eks. juni-gradering) ikke faller utenfor
    # og forsvinner fra nettsiden.
    now = datetime.now(tz=timezone.utc)
    min_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    max_end   = now.replace(year=now.year + 1, month=12, day=31, hour=23, minute=59, second=59, microsecond=0)

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
        title_lower = (title or "").lower()
        # Alltid inkluder spesielle events
        if title in ALWAYS_INCLUDE_TITLES or (
            any(kw in title_lower for kw in ALWAYS_INCLUDE_KEYWORDS)
            and not any(kw in title_lower for kw in NEVER_FORCE_INCLUDE_KEYWORDS)
        ):
            pass
        elif not subgroups:
            # Klubb-wide event uten subgruppe-filter — inkluder
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
