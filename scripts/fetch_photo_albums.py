#!/usr/bin/env python3
"""Fetch Google Photos shared albums and generate Hugo pages.

Reads data/photo_albums_config.json (list of {title, url}).
For each entry:
  - If URL is a /share/?key= URL, scrape the public album HTML to extract
    title, cover, and thumbnail base URLs, then write
    content/info/bilder/<slug>.md with `photos: [...]` frontmatter.
  - Otherwise (private /album/<id> URL), write a stub page that just
    deep-links out to Google Photos.

All previous content/info/bilder/*.md files (except _index.md) are wiped
first so that removals in the config propagate.

The thumbnail URLs are stored as the bare lh3.googleusercontent.com
base; the Hugo template appends sizing suffixes like =w400-h400-no for
grid cells and =w1600-no for the lightbox.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "data" / "photo_albums_config.json"
CONTENT_DIR = REPO_ROOT / "content" / "info" / "bilder"
USER_AGENT = "Mozilla/5.0 (compatible; AlgardKaratePWA/1.0)"

PHOTO_RE = re.compile(r"lh3\.googleusercontent\.com/pw/[A-Za-z0-9_-]+")
OG_TITLE_RE = re.compile(
    r'<meta\s+property="og:title"\s+content="([^"]+)"', re.IGNORECASE
)
OG_IMAGE_RE = re.compile(
    r'<meta\s+property="og:image"\s+content="([^"]+)"', re.IGNORECASE
)


YEAR_RE = re.compile(r"\b(19[5-9]\d|20\d{2})\b")


def extract_year(title: str) -> int:
    """Return the latest 4-digit year found in the title, or 0 if none."""
    years = [int(m.group(1)) for m in YEAR_RE.finditer(title or "")]
    return max(years) if years else 0


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "album"


def resolve_url(url: str) -> str:
    """Follow redirects (e.g. photos.app.goo.gl short links) to the final URL."""
    if "photos.app.goo.gl" not in url:
        return url
    req = Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
    try:
        with urlopen(req, timeout=15) as resp:
            return resp.url
    except (HTTPError, URLError) as exc:
        print(f"  ! could not resolve {url}: {exc}", file=sys.stderr)
        return url


def fetch(url: str, attempts: int = 3) -> str | None:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "no,en"})
    backoff = 1.0
    for attempt in range(attempts):
        try:
            with urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError) as exc:
            print(f"  ! fetch failed ({exc}); retry in {backoff}s", file=sys.stderr)
            time.sleep(backoff)
            backoff *= 2
    return None


def parse_album(html_text: str) -> dict:
    title = None
    m = OG_TITLE_RE.search(html_text)
    if m:
        # og:title is "Album Name · date 📸" — keep the album name part
        raw = html.unescape(m.group(1))
        title = raw.split("·")[0].strip() or raw.strip()
    cover = None
    m = OG_IMAGE_RE.search(html_text)
    if m:
        cover = strip_size_suffix(html.unescape(m.group(1)))
    photos: list[str] = []
    seen: set[str] = set()
    for match in PHOTO_RE.finditer(html_text):
        url = "https://" + match.group(0)
        if url not in seen:
            seen.add(url)
            photos.append(url)
    # The album cover is usually duplicated as the first thumbnail.
    return {"title": title, "cover": cover, "photos": photos}


def strip_size_suffix(url: str) -> str:
    # lh3 URLs may end with =w600-h315-p-k or similar; keep the bare base.
    return url.split("=", 1)[0]


def clean_content_dir() -> None:
    if not CONTENT_DIR.exists():
        CONTENT_DIR.mkdir(parents=True, exist_ok=True)
        return
    for entry in CONTENT_DIR.iterdir():
        if entry.is_file() and entry.name != "_index.md":
            entry.unlink()


def yaml_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def write_page(path: Path, frontmatter: dict, body: str = "") -> None:
    lines = ["---"]
    for key, val in frontmatter.items():
        if isinstance(val, list):
            lines.append(f"{key}:")
            for item in val:
                lines.append(f'  - "{yaml_escape(item)}"')
        elif isinstance(val, bool):
            lines.append(f"{key}: {'true' if val else 'false'}")
        elif isinstance(val, (int, float)):
            lines.append(f"{key}: {val}")
        elif val is None:
            continue
        else:
            lines.append(f'{key}: "{yaml_escape(str(val))}"')
    lines.append("---")
    if body:
        lines.append("")
        lines.append(body)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if not CONFIG_PATH.exists():
        print(f"Missing {CONFIG_PATH}", file=sys.stderr)
        return 1
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    clean_content_dir()

    used_slugs: set[str] = set()
    embedded = 0
    external = 0
    for order, entry in enumerate(config, start=1):
        title = entry.get("title", "").strip() or "Album"
        url = entry["url"].strip()
        resolved = resolve_url(url)
        is_shareable = "/share/" in resolved and "key=" in resolved

        data = {"title": title, "cover": None, "photos": []}
        if is_shareable:
            print(f"-> Fetching {title}: {resolved}")
            html_text = fetch(resolved)
            if html_text:
                parsed = parse_album(html_text)
                if parsed["title"]:
                    data["title"] = parsed["title"]
                data["cover"] = parsed["cover"]
                data["photos"] = parsed["photos"]
                print(
                    f"   {len(data['photos'])} photos, "
                    f"cover={'yes' if data['cover'] else 'no'}"
                )
                time.sleep(0.5)
            else:
                print(f"   ! could not fetch, falling back to link-out")
            if is_shareable and not data["photos"]:
                # Share URL exists but returned no photos -> link is dead or
                # the album is empty. Skip rather than writing a confusing
                # "external" card pointing at a dead share URL.
                print(f"   ! skipping (share URL returned no photos)")
                continue

        slug = slugify(data["title"])
        base = slug
        i = 2
        while slug in used_slugs:
            slug = f"{base}-{i}"
            i += 1
        used_slugs.add(slug)

        frontmatter = {
            "title": data["title"],
            "album_url": url,
            "order": order,
            "year": extract_year(data["title"]),
            "embedded": bool(data["photos"]),
            "cover": data["cover"],
            "ogImage": (data["cover"] + "=w1200-h630-no-c") if data["cover"] else None,
            "photo_count": len(data["photos"]),
            "photos": data["photos"],
        }
        write_page(CONTENT_DIR / f"{slug}.md", frontmatter)
        if data["photos"]:
            embedded += 1
        else:
            external += 1

    print(f"Wrote {embedded} embedded + {external} external album pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
