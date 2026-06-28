import type { Env } from "./types";

type VippsCreds = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
  msn: string;
};

const BASE_URLS = {
  test: "https://apitest.vipps.no",
  prod: "https://api.vipps.no",
} as const;

const SYSTEM_NAME = "algardkarate-shop-api";
const SYSTEM_VERSION = "0.1.0";

export function getCreds(env: Env): VippsCreds {
  const prefix = `VIPPS_${env.VIPPS_ENV.toUpperCase()}_` as const;
  const need = (suffix: string): string => {
    const key = `${prefix}${suffix}` as keyof Env;
    const v = env[key];
    if (typeof v !== "string" || !v) {
      throw new Error(`Missing secret ${prefix}${suffix}`);
    }
    return v;
  };
  return {
    baseUrl: BASE_URLS[env.VIPPS_ENV],
    clientId: need("CLIENT_ID"),
    clientSecret: need("CLIENT_SECRET"),
    subscriptionKey: need("SUBSCRIPTION_KEY"),
    msn: need("MSN"),
  };
}

// Vi cacher token i Worker-isolatets globale scope. Det lever på tvers av
// requests så lenge isolatet er varmt; ved kaldstart hentes nytt token.
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const creds = getCreds(env);
  const resp = await fetch(`${creds.baseUrl}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
    },
  });
  if (!resp.ok) {
    throw new Error(`Vipps token ${resp.status}: ${await resp.text()}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_on: string };
  cachedToken = {
    token: data.access_token,
    expiresAt: Number(data.expires_on) * 1000,
  };
  return cachedToken.token;
}

async function vippsHeaders(
  env: Env,
  idempotencyKey?: string,
): Promise<HeadersInit> {
  const creds = getCreds(env);
  const token = await getAccessToken(env);
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
    "Merchant-Serial-Number": creds.msn,
    "Vipps-System-Name": SYSTEM_NAME,
    "Vipps-System-Version": SYSTEM_VERSION,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  return h;
}

export type CreatePaymentArgs = {
  amountNok: number;
  reference: string;
  returnUrl: string;
  description: string;
  customerPhone?: string;
};

export type CreatePaymentResponse = {
  redirectUrl: string;
  reference: string;
};

export async function createPayment(
  env: Env,
  args: CreatePaymentArgs,
): Promise<CreatePaymentResponse> {
  const creds = getCreds(env);
  const payload = {
    amount: {
      currency: "NOK",
      value: Math.round(args.amountNok * 100),
    },
    paymentMethod: { type: "WALLET" },
    reference: args.reference,
    returnUrl: args.returnUrl,
    userFlow: "WEB_REDIRECT",
    paymentDescription: args.description,
    customer: args.customerPhone ? { phoneNumber: args.customerPhone } : undefined,
  };
  const resp = await fetch(`${creds.baseUrl}/epayment/v1/payments`, {
    method: "POST",
    headers: await vippsHeaders(env, crypto.randomUUID()),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Vipps create ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as CreatePaymentResponse;
}

export type VippsPaymentState =
  | "CREATED"
  | "AUTHORIZED"
  | "TERMINATED"
  | "EXPIRED"
  | "ABORTED";

export type VippsPayment = {
  reference: string;
  state: VippsPaymentState;
  aggregate?: {
    authorizedAmount?: { value: number; currency: string };
    capturedAmount?: { value: number; currency: string };
    refundedAmount?: { value: number; currency: string };
    cancelledAmount?: { value: number; currency: string };
  };
};

export async function getPayment(env: Env, reference: string): Promise<VippsPayment> {
  const creds = getCreds(env);
  const resp = await fetch(`${creds.baseUrl}/epayment/v1/payments/${reference}`, {
    headers: await vippsHeaders(env),
  });
  if (!resp.ok) {
    throw new Error(`Vipps get ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as VippsPayment;
}

export async function capturePayment(
  env: Env,
  reference: string,
  amountNok: number,
): Promise<void> {
  const creds = getCreds(env);
  const resp = await fetch(
    `${creds.baseUrl}/epayment/v1/payments/${reference}/capture`,
    {
      method: "POST",
      headers: await vippsHeaders(env, crypto.randomUUID()),
      body: JSON.stringify({
        modificationAmount: {
          currency: "NOK",
          value: Math.round(amountNok * 100),
        },
      }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Vipps capture ${resp.status}: ${await resp.text()}`);
  }
}
