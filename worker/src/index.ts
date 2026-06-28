import { applyDiscount, lookupDiscount } from "./discounts";
import { notifyAll } from "./notify";
import { getProduct } from "./products";
import type {
  CheckoutRequest,
  Customer,
  Env,
  Order,
  OrderLine,
  OrderStatus,
} from "./types";
import {
  capturePayment,
  createPayment,
  getPayment,
} from "./vipps";

// ───── helpers ────────────────────────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env),
    },
  });
}

function errorResponse(env: Env, message: string, status = 400): Response {
  return jsonResponse(env, { error: message }, status);
}

function genOrderId(): string {
  // Vipps reference: 8-50 tegn, [a-zA-Z0-9-]. crypto.randomUUID gir 36 tegn UUID
  // — vi prefikser "ak-" og fjerner bindestreker for litt kortere visning.
  return "ak-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function validateCustomer(c: unknown): c is Customer {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.email === "string" &&
    /.+@.+\..+/.test(o.email) &&
    typeof o.phone === "string" &&
    o.phone.trim().length >= 8
  );
}

// ───── handlers ───────────────────────────────────────────────────────────

async function handleDiscount(env: Env, code: string): Promise<Response> {
  const d = await lookupDiscount(env, code);
  if (!d) return errorResponse(env, "Ugyldig eller utløpt kode", 404);
  return jsonResponse(env, {
    code: d.code,
    percent_off: d.percent_off ?? null,
    amount_off: d.amount_off ?? null,
  });
}

async function handleCheckout(req: Request, env: Env): Promise<Response> {
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return errorResponse(env, "Ugyldig JSON");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return errorResponse(env, "Handlekurven er tom");
  }
  if (!validateCustomer(body.customer)) {
    return errorResponse(env, "Mangelfull kontaktinfo");
  }

  // Server-side prising — frontend-priser ignoreres.
  const lines: OrderLine[] = [];
  for (const item of body.items) {
    if (!Number.isInteger(item.product_id) || !Number.isInteger(item.qty) || item.qty <= 0) {
      return errorResponse(env, `Ugyldig linje for produkt ${item.product_id}`);
    }
    const product = getProduct(item.product_id);
    if (!product) {
      return errorResponse(env, `Ukjent produkt ${item.product_id}`);
    }
    const lineTotal = Math.round(product.price * item.qty * 100) / 100;
    lines.push({
      product_id: product.id,
      name: product.name,
      qty: item.qty,
      unit_price_nok: product.price,
      line_total_nok: lineTotal,
      variant_id: item.variant_id ?? null,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.line_total_nok, 0);
  const discount = body.discount_code
    ? await lookupDiscount(env, body.discount_code)
    : null;
  const discountOff = applyDiscount(subtotal, discount);
  const total = Math.max(0, Math.round((subtotal - discountOff) * 100) / 100);

  if (total <= 0) {
    return errorResponse(env, "Totalbeløp må være større enn 0");
  }

  const orderId = genOrderId();
  const returnUrl = `${env.ALLOWED_ORIGIN}/ordre/?id=${orderId}`;
  const description = `${env.CLUB_NAME} – ordre ${orderId}`.slice(0, 100);

  let vippsResp;
  try {
    vippsResp = await createPayment(env, {
      amountNok: total,
      reference: orderId,
      returnUrl,
      description,
      customerPhone: body.customer.phone,
    });
  } catch (e) {
    return errorResponse(env, `Vipps-feil: ${(e as Error).message}`, 502);
  }

  const order: Order = {
    id: orderId,
    vipps_reference: vippsResp.reference,
    created_at: new Date().toISOString(),
    status: "PENDING",
    lines,
    subtotal_nok: subtotal,
    discount_code: discount?.code ?? null,
    discount_off_nok: discountOff,
    total_nok: total,
    customer: body.customer,
    notified: false,
  };

  // 60 dagers TTL er nok for henvendelser/reklamasjoner.
  await env.ORDERS.put(`order:${orderId}`, JSON.stringify(order), {
    expirationTtl: 60 * 24 * 3600,
  });

  return jsonResponse(env, {
    order_id: orderId,
    redirect_url: vippsResp.redirectUrl,
  });
}

function mapVippsState(state: string): OrderStatus {
  switch (state) {
    case "AUTHORIZED":
      return "PAID"; // captures kjøres umiddelbart etter authorisering
    case "TERMINATED":
    case "ABORTED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

async function handleOrderStatus(env: Env, ctx: ExecutionContext, orderId: string): Promise<Response> {
  const raw = await env.ORDERS.get(`order:${orderId}`);
  if (!raw) return errorResponse(env, "Ukjent ordre", 404);
  const order = JSON.parse(raw) as Order;

  // Bare poll Vipps hvis vi enda ikke har en endelig status.
  if (order.status === "PENDING") {
    try {
      const payment = await getPayment(env, order.vipps_reference);
      const newStatus = mapVippsState(payment.state);

      if (newStatus === "PAID" && order.status !== "PAID") {
        // Auto-capture før vi markerer som betalt.
        const captured =
          (payment.aggregate?.capturedAmount?.value ?? 0) >=
          Math.round(order.total_nok * 100);
        if (!captured) {
          try {
            await capturePayment(env, order.vipps_reference, order.total_nok);
          } catch (e) {
            console.error("capture failed", e);
            // Behold PENDING — neste poll prøver igjen.
            return jsonResponse(env, { status: "PENDING" });
          }
        }
        order.status = "PAID";
        if (!order.notified) {
          order.notified = true;
          ctx.waitUntil(notifyAll(env, order));
        }
        await env.ORDERS.put(`order:${order.id}`, JSON.stringify(order), {
          expirationTtl: 60 * 24 * 3600,
        });
      } else if (newStatus !== order.status) {
        order.status = newStatus;
        await env.ORDERS.put(`order:${order.id}`, JSON.stringify(order), {
          expirationTtl: 60 * 24 * 3600,
        });
      }
    } catch (e) {
      console.error("vipps poll failed", e);
      // Behold lagret status; klienten poller på nytt.
    }
  }

  return jsonResponse(env, {
    status: order.status,
    total_nok: order.total_nok,
    created_at: order.created_at,
  });
}

// ───── router ─────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (req.method === "GET" && path === "/health") {
      return jsonResponse(env, { ok: true, env: env.VIPPS_ENV });
    }

    if (req.method === "POST" && path === "/checkout") {
      return handleCheckout(req, env);
    }

    const discountMatch = path.match(/^\/discount\/([^/]+)$/);
    if (req.method === "GET" && discountMatch) {
      return handleDiscount(env, decodeURIComponent(discountMatch[1]!));
    }

    const orderMatch = path.match(/^\/order\/([^/]+)$/);
    if (req.method === "GET" && orderMatch) {
      return handleOrderStatus(env, ctx, decodeURIComponent(orderMatch[1]!));
    }

    return errorResponse(env, "Not found", 404);
  },
};
