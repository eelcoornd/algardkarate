"""Fetch WooCommerce shop products at build time.

Uses the public Store API (no auth required), filters out internal/admin
products, caches each product image locally, and writes:
  - data/shop_products.json  (used by /shop/ list page)
  - content/shop/<slug>.md   (one per product, used by Hugo for detail
                              pages and per-product Open Graph meta)
  - static/shop-images/<id>.<ext>  (cached images served by the PWA)

Generated content/shop/*.md files (everything except _index.md) are
removed and recreated on each run so deletions in WooCommerce propagate.
"""
import glob
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://www.algardkarate.net/algardkarate/wp-json/wc/store/v1/products?per_page=100"
EXCLUDED_CATEGORY_SLUGS = {"intern", "kontigent"}
EXCLUDED_SLUGS = {"ehf-gebyr"}

DATA_OUTPUT = "data/shop_products.json"
CONTENT_DIR = "content/shop"
IMAGES_DIR = "static/shop-images"
WP_CART_URL = "https://www.algardkarate.net/algardkarate/cart/"

ALLOWED_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def download_image(url: str, product_id: int) -> str:
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    ext = os.path.splitext(parsed.path)[1].lower()
    if ext not in ALLOWED_IMG_EXT:
        ext = ".jpg"
    fname = f"{product_id}{ext}"
    fpath = os.path.join(IMAGES_DIR, fname)
    if os.path.exists(fpath) and os.path.getsize(fpath) > 0:
        return "/shop-images/" + fname
    req = urllib.request.Request(url, headers={"User-Agent": "algardkarate-pwa-build/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                with open(fpath, "wb") as f:
                    f.write(r.read())
            time.sleep(0.3)
            return "/shop-images/" + fname
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                wait = 2 ** attempt
                print(f"  429 for {url}, retrying in {wait}s", flush=True)
                time.sleep(wait)
                continue
            print(f"WARN: failed to download {url}: {e}", flush=True)
            return ""
        except Exception as e:
            print(f"WARN: failed to download {url}: {e}", flush=True)
            return ""
    return ""


def clean_generated_md() -> None:
    for f in glob.glob(os.path.join(CONTENT_DIR, "*.md")):
        if os.path.basename(f) == "_index.md":
            continue
        os.remove(f)


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "annet"


def y(s) -> str:
    """JSON-encode a value for safe YAML embedding."""
    return json.dumps(s, ensure_ascii=False)


def write_product_md(p: dict) -> None:
    slug = p["slug"]
    fpath = os.path.join(CONTENT_DIR, f"{slug}.md")
    cats_str = ", ".join(p["categories"]) if p["categories"] else ""
    parts = [p["name"], f"kr {int(p['price'])},-"]
    if cats_str:
        parts.append(f"({cats_str})")
    desc = " ".join(parts) + " — fra Ålgård Karateklubbs nettbutikk."

    add_to_cart = f"{WP_CART_URL}?add-to-cart={p['id']}" if p["type"] == "simple" else ""

    lines = [
        "---",
        f"title: {y(p['name'])}",
        f"description: {y(desc)}",
        "params:",
        f"  product_id: {p['id']}",
        f"  product_type: {y(p['type'])}",
        f"  price: {p['price']}",
        f"  currency: {y(p['currency'])}",
        f"  image: {y(p['image'])}",
        f"  ogImage: {y(p['image'])}",
        f"  wp_permalink: {y(p['permalink'])}",
        f"  wp_add_to_cart: {y(add_to_cart)}",
        f"  categories: {y(p['categories'])}",
        f"  category_slug: {y(p['category_slug'])}",
        "---",
        "",
    ]
    with open(fpath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main() -> int:
    try:
        with urllib.request.urlopen(API, timeout=30) as resp:
            products = json.loads(resp.read())
    except Exception as e:
        # Fall back to whatever data/shop_products.json was last committed
        # so a transient WP/network outage doesn't fail the whole deploy.
        print(f"WARNING fetching products: {e}", flush=True)
        if os.path.exists(DATA_OUTPUT):
            print(f"  using cached {DATA_OUTPUT}; skipping regeneration.", flush=True)
            return 0
        print(f"  no cached {DATA_OUTPUT} to fall back to.", flush=True)
        return 1

    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(CONTENT_DIR, exist_ok=True)
    clean_generated_md()

    out = []
    for p in products:
        cat_objs = p.get("categories") or []
        cat_slugs = {c.get("slug", "").lower() for c in cat_objs}
        if cat_slugs & EXCLUDED_CATEGORY_SLUGS:
            continue
        if p.get("slug", "").lower() in EXCLUDED_SLUGS:
            continue

        prices = p.get("prices") or {}
        try:
            minor = int(prices.get("price") or 0)
            minor_unit = int(prices.get("currency_minor_unit") or 2)
            price = minor / (10 ** minor_unit)
        except (TypeError, ValueError):
            price = 0.0
        if price <= 0:
            continue

        images = p.get("images") or []
        remote_image = images[0].get("src") if images else ""
        local_image = download_image(remote_image, p.get("id"))

        cat_names = [html.unescape(c.get("name", "")) for c in cat_objs]
        # Primary category slug for filter chips; fall back to "annet"
        primary_slug = next(
            (c.get("slug", "").lower() for c in cat_objs if c.get("slug")),
            "annet",
        )

        out.append({
            "id": p.get("id"),
            "name": html.unescape(p.get("name", "")),
            "slug": p.get("slug", ""),
            "permalink": p.get("permalink", ""),
            "type": p.get("type", "simple"),
            "price": price,
            "currency": prices.get("currency_code", "NOK"),
            "image": local_image,
            "remote_image": remote_image,
            "on_sale": bool(p.get("on_sale")),
            "categories": sorted(cat_names),
            "category_slug": primary_slug,
        })

    out.sort(key=lambda x: x["name"].lower())

    os.makedirs(os.path.dirname(DATA_OUTPUT), exist_ok=True)
    with open(DATA_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    for p in out:
        write_product_md(p)

    print(f"Saved {len(out)} products to {DATA_OUTPUT}", flush=True)
    print(f"Wrote {len(out)} product pages to {CONTENT_DIR}", flush=True)
    print(f"Cached images in {IMAGES_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
