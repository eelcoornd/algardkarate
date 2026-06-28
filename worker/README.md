# algardkarate-shop-api

Cloudflare Worker som lar Hugo-shoppen på <https://www.algardkarate.net/shop/>
ta imot betaling via Vipps ePayment. Varer leveres på trening — ingen frakt.

## Arkitektur

```
[Hugo shop (statisk)]
   │  POST /checkout  ┌─────────────────────────────┐
   │ ───────────────▶ │  algardkarate-shop-api      │
   │ ◀───────────────  │  (Cloudflare Worker)        │
   │  {redirect_url}   │   ├─ Vipps ePayment API    │
   │                   │   ├─ KV: ORDERS, DISCOUNTS │
   │  GET /order/:id   │   ├─ Telegram-bot          │
   │ ───────────────▶  │   └─ MailChannels e-post   │
   │  {status: PAID}   └─────────────────────────────┘
   ▼
[Klubben varsles] — Telegram + e-post til kunde og klubb
```

Frontend (i samme repo) poller `/order/:id` hvert 3. sekund etter at brukeren
kommer tilbake fra Vipps. Workeren slår opp status mot Vipps, captures
beløpet automatisk når det er AUTHORIZED, og sender notifikasjoner én gang.

## Førstegangsoppsett

```bash
cd worker
npm install

# Logg inn (én gang)
npx wrangler login

# Opprett KV-namespaces (kjør én gang, lim inn id-ene i wrangler.toml)
npx wrangler kv:namespace create ORDERS
npx wrangler kv:namespace create DISCOUNTS

# Sett secrets (gjenta med --env production for prod)
npx wrangler secret put VIPPS_TEST_CLIENT_ID
npx wrangler secret put VIPPS_TEST_CLIENT_SECRET
npx wrangler secret put VIPPS_TEST_SUBSCRIPTION_KEY
npx wrangler secret put VIPPS_TEST_MSN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CLUB_CHAT_ID
npx wrangler secret put MAIL_FROM
```

For produksjon, gjenta med `--env production` og bruk `VIPPS_PROD_*`-navn.

## Vanlig arbeidsflyt

```bash
npm run sync-products   # kopier data/shop_products.json → src/products.json
npm run typecheck       # tsc --noEmit
npm run dev             # lokal dev-server på http://localhost:8787
npm run deploy          # deploy til Cloudflare (test-miljø)
npm run deploy -- --env production
```

## Endepunkter

| Metode | Path              | Beskrivelse                              |
|--------|-------------------|------------------------------------------|
| GET    | /health           | Liveness + hvilket Vipps-miljø           |
| POST   | /checkout         | Opprett ordre + Vipps payment            |
| GET    | /order/:id        | Status (PENDING/PAID/CANCELLED/EXPIRED)  |
| GET    | /discount/:code   | Slå opp rabattkode                       |

## Rabattkoder

Lagres i KV (`DISCOUNTS`) med nøkkel `discount:<KODE>`:

```bash
npx wrangler kv:key put --binding=DISCOUNTS discount:MEDLEM25 \
  '{"code":"MEDLEM25","percent_off":25,"active":true}'
```

## Koble til Hugo

Etter første deploy, sett i `hugo.toml`:

```toml
[params]
  api_base = "https://algardkarate-shop-api.<din-bruker>.workers.dev"
```

(eller bind til et custom domene som `shop-api.algardkarate.net`.)

## Sikkerhetsnotater

* Priser hentes server-side fra `src/products.json`. Frontend-priser ignoreres.
* CORS låst til `ALLOWED_ORIGIN` (default `https://www.algardkarate.net`).
* Vipps `reference` = ordre-id; egen tilfeldig UUID for hver bestilling.
* Webhook-flow ikke implementert i v1 — status oppdateres via polling.
  Frontenden poller hvert 3. sek; auto-capture skjer på Worker-siden.
