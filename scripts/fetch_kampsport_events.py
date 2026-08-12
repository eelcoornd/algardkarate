#!/usr/bin/env python3
"""Fetch Karate Fullkontakt events from kampsport.no and save as JSON.

Scrapes https://kampsport.no/arrangementer/?event_section=Karate and keeps
only cards tagged with the "Karate fullkontakt" category (excludes Shobu
Ippon, Sportskarate, and all other disciplines), since Ålgård Karateklubb
competes in Fullkontakt.
"""
import json
import os
import re
import html as html_module

import requests

URL = "https://kampsport.no/arrangementer/?event_section=Karate"
ONLY_CATEGORY = "karate fullkontakt"

CARD_RE = re.compile(r'<a href="([^"]+)" class="event-card">(.*?)</a>', re.S)
CATEGORY_RE = re.compile(r'event-card__category">([^<]*)')
TITLE_RE = re.compile(r'event-card__title">([^<]*)')
DATE_RE = re.compile(r'<time datetime="([^"]+)">([^<]*)</time>')
LOCATION_RE = re.compile(r'event-card__location">\s*<svg.*?</svg>\s*<p>([^<]*)</p>', re.S)
IMAGE_RE = re.compile(r'<img[^>]+src="([^"]+)"[^>]*alt="[^"]*"[^>]*loading="lazy"')


def clean(text):
    return html_module.unescape(text or "").strip()


def main():
    r = requests.get(URL, timeout=30)
    r.raise_for_status()
    html_text = r.text

    events = []
    for link, body in CARD_RE.findall(html_text):
        cat_match = CATEGORY_RE.search(body)
        category = clean(cat_match.group(1)) if cat_match else ""
        if category.lower() != ONLY_CATEGORY:
            continue

        title_match = TITLE_RE.search(body)
        title = clean(title_match.group(1)) if title_match else ""

        date_match = DATE_RE.search(body)
        date_iso = date_match.group(1) if date_match else ""
        date_text = clean(date_match.group(2)) if date_match else ""

        loc_match = LOCATION_RE.search(body)
        location = clean(loc_match.group(1)) if loc_match else ""

        image_match = IMAGE_RE.search(body)
        image = clean(image_match.group(1)) if image_match else ""

        events.append({
            "title": title,
            "url": link,
            "date": date_iso,
            "date_text": date_text,
            "location": location,
            "image": image,
        })

    os.makedirs("data", exist_ok=True)
    with open("data/kampsport_events.json", "w") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(events)} Fullkontakt events to data/kampsport_events.json")


if __name__ == "__main__":
    main()
