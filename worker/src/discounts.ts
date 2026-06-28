import type { Discount, Env } from "./types";

// Rabattkoder lagres i KV under nøkkelen "discount:<CODE>" (upper-case).
// Eksempel-verdi:
//   { "code": "MEDLEM25", "percent_off": 25, "active": true }
//
// Sett kode via:
//   wrangler kv:key put --binding=DISCOUNTS discount:MEDLEM25 \
//     '{"code":"MEDLEM25","percent_off":25,"active":true}'

export async function lookupDiscount(env: Env, rawCode: string): Promise<Discount | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const raw = await env.DISCOUNTS.get(`discount:${code}`);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Discount;
    if (!d.active) return null;
    if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return null;
    return d;
  } catch {
    return null;
  }
}

export function applyDiscount(subtotal: number, d: Discount | null): number {
  if (!d) return 0;
  if (d.percent_off) {
    return Math.round(subtotal * (d.percent_off / 100) * 100) / 100;
  }
  if (d.amount_off) {
    return Math.min(subtotal, d.amount_off);
  }
  return 0;
}
