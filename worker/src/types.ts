export type Env = {
  // KV
  ORDERS: KVNamespace;
  DISCOUNTS: KVNamespace;
  // vars
  VIPPS_ENV: "test" | "prod";
  ALLOWED_ORIGIN: string;
  PICKUP_INFO: string;
  CLUB_EMAIL: string;
  CLUB_NAME: string;
  // secrets (kun den aktive miljø-prefiksen brukes)
  VIPPS_TEST_CLIENT_ID?: string;
  VIPPS_TEST_CLIENT_SECRET?: string;
  VIPPS_TEST_SUBSCRIPTION_KEY?: string;
  VIPPS_TEST_MSN?: string;
  VIPPS_PROD_CLIENT_ID?: string;
  VIPPS_PROD_CLIENT_SECRET?: string;
  VIPPS_PROD_SUBSCRIPTION_KEY?: string;
  VIPPS_PROD_MSN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CLUB_CHAT_ID?: string;
  MAIL_FROM?: string;
};

export type CartItem = {
  product_id: number;
  variant_id?: string | null;
  qty: number;
};

export type Customer = {
  name: string;
  email: string;
  phone: string;
};

export type CheckoutRequest = {
  items: CartItem[];
  customer: Customer;
  discount_code?: string | null;
};

export type OrderLine = {
  product_id: number;
  name: string;
  qty: number;
  unit_price_nok: number;
  line_total_nok: number;
  variant_id?: string | null;
};

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";

export type Order = {
  id: string;
  vipps_reference: string;
  created_at: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal_nok: number;
  discount_code: string | null;
  discount_off_nok: number;
  total_nok: number;
  customer: Customer;
  notified: boolean;
};

export type Discount = {
  code: string;
  percent_off?: number;
  amount_off?: number;
  active: boolean;
  expires_at?: string; // ISO
};
