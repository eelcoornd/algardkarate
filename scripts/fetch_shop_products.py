"""Fetch WooCommerce shop products at build time.

Uses the public Store API (no auth required), filters out internal/admin
products, and writes a minimal JSON for Hugo to render.
"""
import html
import json
import os
import sys
import urllib.request

API = "https://www.algardkarate.net/algardkarate/wp-json/wc/store/v1/products?per_page=100"
EXCLUDED_CATEGORY_SLUGS = {"intern", "kontigent"}
EXCLUDED_SLUGS = {"ehf-gebyr"}
OUTPUT = "data/shop_products.json"


def main() -> int:
    try:
        with urllib.request.urlopen(API, timeout=30) as resp:
            products = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR fetching products: {e}", flush=True)
        return 1

    out = []
    for p in products:
        cat_slugs = {c.get("slug", "").lower() for c in p.get("categories", [])}
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
        image = images[0].get("src") if images else ""
        thumb = images[0].get("thumbnail") if images else image

        out.append({
            "id": p.get("id"),
            "name": html.unescape(p.get("name", "")),
            "slug": p.get("slug", ""),
            "permalink": p.get("permalink", ""),
            "type": p.get("type", "simple"),
            "price": price,
            "currency": prices.get("currency_code", "NOK"),
            "image": image,
            "thumbnail": thumb,
            "on_sale": bool(p.get("on_sale")),
            "categories": sorted(c.get("name", "") for c in p.get("categories", [])),
        })

    out.sort(key=lambda x: x["name"].lower())

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(out)} products to {OUTPUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
