import type { Env, Order } from "./types";
import { getProduct } from "./products";

// Live-lager lagres i ORDERS-KV under nøkkelen `stock:{product_id}:{variant_id}`.
// Simple-produkter uten variant lagres under `stock:{product_id}:_`. Verdien er
// et heltall (string-representert). Hvis nøkkelen mangler, brukes baseline
// (variant.stock) fra products.json som "ubetalt" utgangspunkt.

const stockKey = (productId: number, variantId: string | null | undefined): string =>
  `stock:${productId}:${variantId ?? "_"}`;

type StockableVariant = { id: string; stock?: number };

// Returnerer effektivt lager for en (product, variant). null betyr "ikke sporet"
// (produkter/varianter uten stock-felt regnes som ubegrenset).
export async function getEffectiveStock(
  env: Env,
  productId: number,
  variantId: string | null | undefined,
): Promise<number | null> {
  const product = getProduct(productId);
  if (!product) return null;
  let baseline: number | null = null;
  if (variantId && product.variants) {
    const v = product.variants.find((x: StockableVariant) => x.id === variantId);
    if (v && typeof v.stock === "number") baseline = v.stock;
  }
  if (baseline === null) return null;
  const raw = await env.ORDERS.get(stockKey(productId, variantId));
  if (raw !== null) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : baseline;
  }
  return baseline;
}

// Trekker fra qty fra live-lager. No-op hvis lager ikke spores.
async function decrementOne(
  env: Env,
  productId: number,
  variantId: string | null | undefined,
  qty: number,
): Promise<void> {
  const current = await getEffectiveStock(env, productId, variantId);
  if (current === null) return;
  const next = Math.max(0, current - qty);
  await env.ORDERS.put(stockKey(productId, variantId), String(next));
}

export async function decrementStockForOrder(env: Env, order: Order): Promise<void> {
  await Promise.all(
    order.lines.map((l) => decrementOne(env, l.product_id, l.variant_id ?? null, l.qty)),
  );
}

// Alle overstyrte lagerverdier — brukes av GET /stock for at frontenden skal
// kunne vise oppdatert antall uten å rebygge Hugo-sida.
export async function listStockOverrides(
  env: Env,
): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  let cursor: string | undefined;
  do {
    const page = await env.ORDERS.list({ prefix: "stock:", cursor });
    for (const k of page.keys) {
      const parts = k.name.split(":");
      if (parts.length < 3) continue;
      const productId = parts[1]!;
      const variantId = parts.slice(2).join(":");
      const raw = await env.ORDERS.get(k.name);
      if (raw === null) continue;
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) continue;
      (out[productId] ||= {})[variantId] = n;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}
