# Ålgård Karate — Hvordan nettsiden er bygget

Dette dokumentet beskriver hele oppsettet rundt **www.algardkarate.net**: hva
som bygger den, hvor den kjører, hvilke eksterne tjenester den snakker med,
hvor koden/hemmelighetene ligger, og hvordan du (eller en annen AI-agent som
Hermes, OpenClaw eller Copilot) kan sette alt opp på nytt fra bunnen av.

---

## 1. Oversikt (arkitekturdiagram)

```
                         ┌─────────────────────────────┐
                         │  Spond (app)                 │
                         │  - Treningsplan / arrangement │
                         │  - Medlemmer / subgrupper     │
                         └───────────────┬──────────────┘
                                          │ spond-python (uoffisielt bibliotek)
                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│  GitHub repo: eelcoornd/algardkarate  (public)                     │
│  main branch                                                        │
│                                                                      │
│  scripts/fetch_spond_events.py      → data/spond_events.json       │
│  scripts/fetch_kampsport_events.py  → data/kampsport_events.json    │
│  scripts/fetch_photo_albums.py      → content/info/bilder/*.md      │
│                                                                      │
│  content/**/*.md   (Hugo-innhold, norsk)                            │
│  layouts/**/*.html (Hugo-templates, Go template-språk)              │
│  static/**         (bilder, css, js, manifest, CNAME)               │
│  hugo.toml          (site-config)                                   │
│  worker/            (Cloudflare Worker – Vipps-betaling for shop)   │
└───────────────┬──────────────────────────────┬─────────────────────┘
                │ GitHub Actions                │ GitHub Actions
                │ .github/workflows/            │ .github/workflows/
                │ deploy-pages.yml              │ deploy-worker.yml
                ▼                                ▼
   ┌─────────────────────────┐      ┌──────────────────────────────┐
   │  GitHub Pages            │      │  Cloudflare Worker            │
   │  (statisk Hugo-build)    │      │  algardkarate-shop-api        │
   │  www.algardkarate.net    │◀────▶│  (Vipps ePayment, KV-lager,   │
   │  (custom domain, HTTPS)  │ fetch│   ordre, Telegram/e-post)     │
   └─────────────────────────┘      └──────────────────────────────┘
                                                    │
                                                    ▼
                                          Vipps ePayment API
                                          (test/prod-miljø)

  (separat, lokalt prosjekt — ikke del av selve nettsiden, men brukes til
   klubbadministrasjon og for å gjøre endringer i Spond via kode/agent)
┌────────────────────────────────────────────────────────────────────┐
│  ~/projects/karateklubb  (eget lokalt/privat repo)                  │
│  - Python "spond" klient (samme uoffisielle bibliotek)              │
│  - MCP-server (karateklubb-mcp) for medlemslister/arrangementer      │
│  - NKKO medlemsrapport (xlsx) + e-post via Gmail SMTP                │
│  - Telegram-bot for klubbspørsmål                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Nettsiden (Hugo static site)

### 2.1 Teknologi
- **Static site generator:** [Hugo](https://gohugo.io/) v0.165.0 (extended), Go templates.
- **Språk:** Go template-språk (`{{ }}`) i `layouts/*.html`, Markdown + HTML i `content/*.md`.
- **Hosting:** GitHub Pages, med custom domain `www.algardkarate.net` (se `static/CNAME`).
- **Repo:** `https://github.com/eelcoornd/algardkarate` (public).
- **Default branch:** `main`. Alt som pushes til `main` trigger automatisk build+deploy.

### 2.2 Lokal katalogstruktur (i dette miljøet)
```
~/projects/algardkarate/     ← Hugo-siten (dette repoet)
~/projects/karateklubb/      ← separat Python-prosjekt for Spond-admin/MCP (se seksjon 5)
```
Hvis du setter opp på nytt et annet sted, er eneste krav at det er en git-klone
av `eelcoornd/algardkarate` — ingen hardkodede absolutte stier i koden.

### 2.3 Mappestruktur i repoet
```
hugo.toml                 Hugo-konfig (baseURL, meny, shop api_base, markup)
content/                  Alt tekstinnhold, ett katalog per seksjon
  info/                   Infosider (Påmelding, Dojo Kun, Belte, Styre, ...)
  info/bilder/            Bildealbum-sider (generert av fetch_photo_albums.py)
  shop/                   Produktsider (ett .md per produkt, med variants i frontmatter)
  treninger/, stevner/, syllabus/, hall-of-fame/, facebook/, posts/
  checkout/, kurv/, ordre/  Handlekurv/kasse-flyt (shop)
layouts/                  Go-templates, ett underkatalog per "section" + _default + partials
  index.html              Forsiden — bl.a. "Kommende arrangementer"-seksjonen
static/                   Statiske filer som kopieres 1:1 til public/
  CNAME                   Custom domain for GitHub Pages: www.algardkarate.net
  css/style.css, js/shop-cart.js, images/, icons/, manifest.webmanifest, sw.js
data/                     JSON-datafiler lest av Hugo-templates via site.Data
  spond_events.json       Kommende arrangementer, hentes fra Spond (se 2.4)
  kampsport_events.json   Fullkontakt-stevner fra kampsport.no
  shop_products.json      Kilde for produktkatalogen (også brukt av worker/)
  photo_albums_config.json  Liste over Google Photos-album som skal vises
  albums.json             (eldre/annen albumliste)
scripts/                  Python-scripts som kjøres i CI før hver Hugo-build
worker/                   Cloudflare Worker (Vipps-betaling), se seksjon 3
.github/workflows/        CI/CD (se seksjon 2.4 og 3)
```

### 2.4 Hvordan innholdet oppdateres automatisk
Workflow: **`.github/workflows/deploy-pages.yml`**
- Trigger: push til `main`, manuelt (`workflow_dispatch`), eller **cron `0 6 * * *`**
  (kl. 06:00 UTC / ca. 08:00 norsk sommertid, hver natt).
- Steg:
  1. Checkout repo
  2. Installer Python + `pip install spond requests`
  3. `python scripts/fetch_spond_events.py` → henter kommende Spond-arrangementer
     og skriver `data/spond_events.json` (krever secrets `SPOND_USERNAME` og
     `SPOND_PASSWORD` — se seksjon 4).
  4. `python scripts/fetch_kampsport_events.py` → skraper kampsport.no for
     Fullkontakt-stevner → `data/kampsport_events.json`.
  5. `python scripts/fetch_photo_albums.py` → leser
     `data/photo_albums_config.json` og genererer
     `content/info/bilder/*.md`.
  6. Setup Hugo (`peaceiris/actions-hugo`, `hugo-version: latest`, extended).
  7. `hugo --minify` → bygger til `./public`.
  8. Last opp `public/` som Pages-artifact og deploy til GitHub Pages.
- Alle fetch-steg har `continue-on-error: true` — hvis Spond/kampsport.no er
  nede, bygger siten likevel med forrige kjente data.

**Viktig logikk i `scripts/fetch_spond_events.py`:**
- Henter events fra Spond mellom 1. januar i år og 31. desember neste år.
- Ekskluderer events der subgruppen **"Trenere"** er blant mottakerne — disse
  er interne trener-notater og skal aldri vises på nettsiden.
- Viser kun events som har minst én "belte"-subgruppe, ELLER som matcher en
  fast liste (`ALWAYS_INCLUDE_TITLES`) eller nøkkelord (leir, gradering,
  sesongavslutning, fight camp, NM), ELLER som er klubb-wide (ingen
  subgruppe-filter).
- Ekskluderer events som er ferdige for mer enn 2 timer siden.
- Konverterer tidspunkt til Europe/Oslo-tidssone.

**Ukedagsformatering (viktig detalj):** Go sitt `time.Format("Mon")` gir
alltid engelske ukedagsforkortelser (Mon, Tue, ...), uavhengig av
`languageCode`. I `layouts/index.html` er dette løst med et eksplisitt
oppslag (`dict "Monday" "Man" "Tuesday" "Tir" ...`) for norske forkortelser
(Man, Tir, Ons, Tor, Fre, Lør, Søn).

### 2.5 Manuell/umiddelbar oppdatering
Hvis du ikke vil vente på nattlig cron, kan du trigge workflow manuelt:
```bash
gh workflow run deploy-pages.yml --ref main
gh run watch <run-id> --exit-status   # følg fremdrift
```
Krever GitHub CLI (`gh`) autentisert med en bruker som har tilgang til
repoet (og `workflow`-scope på token).

---

## 3. Nettbutikk / betaling (Cloudflare Worker + Vipps)

Butikksidene (`content/shop/*.md`) er statiske Hugo-sider, men selve
betalingen håndteres av en **Cloudflare Worker** kalt `algardkarate-shop-api`,
siden GitHub Pages ikke kan kjøre server-side kode.

### 3.1 Arkitektur
```
Hugo-shop (statisk) --POST /checkout--> Worker --> Vipps ePayment API
                     <--{redirect_url}--        --> KV: ORDERS, DISCOUNTS
                                                 --> Telegram + e-post (MailChannels)
Frontend poller GET /order/:id hvert 3. sekund til status = PAID.
```

### 3.2 Kode og config
- Kode: `worker/src/*.ts` (TypeScript, Cloudflare Workers runtime).
- Config: `worker/wrangler.toml` — to miljøer:
  - **Standard/test:** worker-navn `algardkarate-shop-api-test`, `VIPPS_ENV=test`.
  - **`[env.production]`:** worker-navn `algardkarate-shop-api`, `VIPPS_ENV=prod`.
  - Hvert miljø har egne KV-namespaces (`ORDERS`, `DISCOUNTS`) med separate IDer,
    så testdata aldri blander seg med produksjonsdata.
- Produktkatalog: `npm run sync-products` (`worker/scripts/sync-products.mjs`)
  bygger `worker/src/products.json` fra `data/shop_products.json` +
  variant-frontmatter i `content/shop/*.md`, slik at Workeren kan
  validere/prise server-side (frontend-priser stoles det aldri på).
- Endepunkter: `GET /health`, `POST /checkout`, `GET /order/:id`,
  `GET /discount/:code`.
- CORS låst til `ALLOWED_ORIGIN` (= `https://www.algardkarate.net`).

### 3.3 Deploy
Workflow: **`.github/workflows/deploy-worker.yml`**
- Trigger: push til `main` som endrer `worker/**`, `data/shop_products.json`,
  `content/shop/**`, eller selve workflow-filen. Kan også trigges manuelt.
- Steg: `npm ci`, `npm run sync-products`, `npm run typecheck`,
  deploy med `cloudflare/wrangler-action@v3` mot **production**-miljøet
  (`wrangler deploy --env production`).
- Krever secrets `CLOUDFLARE_API_TOKEN` og `CLOUDFLARE_ACCOUNT_ID` (se seksjon 4).

### 3.4 Førstegangsoppsett av Workeren (hvis du bygger på nytt)
```bash
cd worker
npm install
npx wrangler login                       # én gang, interaktivt
npx wrangler kv:namespace create ORDERS
npx wrangler kv:namespace create DISCOUNTS
# lim inn de nye KV-ID-ene i wrangler.toml (test-miljø og/eller [env.production])

npx wrangler secret put VIPPS_TEST_CLIENT_ID
npx wrangler secret put VIPPS_TEST_CLIENT_SECRET
npx wrangler secret put VIPPS_TEST_SUBSCRIPTION_KEY
npx wrangler secret put VIPPS_TEST_MSN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CLUB_CHAT_ID
npx wrangler secret put GMAIL_USER
npx wrangler secret put GMAIL_APP_PASSWORD
npx wrangler secret put MAIL_FROM        # valgfri
# gjenta alle secret put-kommandoene med --env production for prod-miljøet,
# og bruk VIPPS_PROD_* i stedet for VIPPS_TEST_*
```
Etter første deploy, sett i `hugo.toml`:
```toml
[params]
  api_base = "https://algardkarate-shop-api.<din-cloudflare-bruker>.workers.dev"
```
(eller koble et custom domene, f.eks. `shop-api.algardkarate.net`.)

Rabattkoder legges i KV:
```bash
npx wrangler kv:key put --binding=DISCOUNTS discount:MEDLEM25 \
  '{"code":"MEDLEM25","percent_off":25,"active":true}'
```

---

## 4. Hemmeligheter / secrets

Alle secrets ligger i **GitHub Actions repo-secrets** for `eelcoornd/algardkarate`
(Settings → Secrets and variables → Actions), IKKE i git:

| Secret | Brukes av | Beskrivelse |
| --- | --- | --- |
| `SPOND_USERNAME` | deploy-pages.yml | E-post/brukernavn for Spond-innlogging |
| `SPOND_PASSWORD` | deploy-pages.yml | Passord for Spond-innlogging |
| `CLOUDFLARE_API_TOKEN` | deploy-worker.yml | API-token for wrangler-deploy |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-worker.yml | Cloudflare-konto-ID |

Sjekk hvilke som finnes: `gh secret list` (krever admin-tilgang på repoet).

Cloudflare Worker-secrets (Vipps, Telegram, Gmail) settes separat med
`npx wrangler secret put <NAVN>` (se 3.4) — de ligger i Cloudflare, ikke i GitHub.

Lokalt (`~/projects/algardkarate/.env`, git-ignorert) ligger kun
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_EMAIL` for manuell wrangler-bruk fra
terminalen — dette er valgfritt og ikke nødvendig for CI.

**Aldri commit disse verdiene til git.** `.gitignore` ekskluderer allerede
`.env`, `client_secret.json`, `tokens.json`, `public/`, `hugo`-binærfilen og
`.hugo_build.lock`.

---

## 5. GitHub- og domeneoppsett

- **Repo:** `eelcoornd/algardkarate`, public, default branch `main`.
- **GitHub Pages:** Kilde = "GitHub Actions" (ikke branch-basert), custom
  domain `www.algardkarate.net` (satt i repo Settings → Pages, og speilet i
  `static/CNAME`). HTTPS er påtvunget og sertifikat er godkjent.
- **DNS:** domenet `algardkarate.net` peker `www` (CNAME eller A-poster mot
  GitHub Pages sine IP-er) — dette administreres hos domeneregistraren, ikke
  i dette repoet. Hvis du bygger på nytt et annet sted, må du enten:
  1. Legge til en ny `CNAME`-fil i `static/` med ditt domene og peke DNS dit, eller
  2. Bruke standard `<bruker>.github.io/<repo>`-URL uten custom domain.
- **Legacy:** `static/staticwebapp.config.json` inneholder gamle
  redirect-regler fra en tidligere Azure Static Web Apps + WordPress-periode
  (redirects fra `/algardkarate/...`-stier). Denne filen kopieres til
  `public/` av Hugo, men brukes ikke aktivt av GitHub Pages — kan fjernes
  trygt hvis ingen lenker fortsatt peker dit.

---

## 6. Lokalt utviklingsmiljø (rebygge fra bunnen)

### 6.1 Forutsetninger
- [Hugo extended](https://gohugo.io/installation/) (samme versjon som CI,
  p.t. `latest` — sjekk `.github/workflows/deploy-pages.yml` for om det er
  pinnet). Kan lastes ned uten root, f.eks.:
  ```bash
  curl -sL https://github.com/gohugoio/hugo/releases/download/v0.165.0/hugo_0.165.0_linux-amd64.tar.gz \
    -o /tmp/hugo.tar.gz && tar xzf /tmp/hugo.tar.gz -C /tmp hugo
  ```
- Python 3.11+ med `pip install spond requests` (for fetch-scriptene).
- Node.js 20+ og npm (kun for `worker/`).
- GitHub CLI (`gh`) hvis du vil trigge workflows eller lese secrets/PRs derfra.

### 6.2 Klone og bygge
```bash
git clone https://github.com/eelcoornd/algardkarate.git
cd algardkarate
hugo --minify -d public       # bygger statisk site til ./public
hugo server                    # lokal dev-server m/ live reload, http://localhost:1313
```
For å teste med ferske Spond/kampsport-data lokalt (valgfritt):
```bash
export SPOND_USERNAME=... SPOND_PASSWORD=...
python scripts/fetch_spond_events.py
python scripts/fetch_kampsport_events.py
python scripts/fetch_photo_albums.py
```

### 6.3 Publisere en endring
```bash
git add -A
git commit -m "Beskrivelse av endringen"
git push origin main
```
Push til `main` trigger automatisk `deploy-pages.yml` (og `deploy-worker.yml`
hvis `worker/**` er endret). Innen 1-2 minutter er endringen live på
`https://www.algardkarate.net/`.

---

## 7. Sidestruktur / hvordan sider legges til

Nye sider under `/info/` (eller andre "list"-seksjoner) følger dette mønsteret:

1. Opprett `content/info/<slug>.md` med frontmatter:
   ```yaml
   ---
   title: "Sidetittel"
   icon: "fa-<font-awesome-navn>"     # ikon i menylisten og på sidens header
   icon_color: "#hex"
   icon_bg: "#hex"
   weight: <tall>                     # lavere tall = høyere opp i listen
   ---
   ```
2. Selve innholdet under frontmatter er Markdown/HTML. De fleste sider bruker
   et selvstendig, scoped CSS-tema (unikt klasseprefiks per side, f.eks.
   `.nyb-*` for nybegynner.md, `.belte-*` for belte.md, `.dojokun-*` for
   dojo-kun.md) med en `<style>`-blokk nederst i samme fil — dette holder
   hver sides styling isolert og gjør det trygt å style om én side uten å
   påvirke andre.
3. `layouts/info/list.html` viser automatisk alle sider under `/info/` sortert
   på `weight`, med ikon fra frontmatter.
4. `layouts/info/single.html` gir standard sideheader (tilbakepil, ikon,
   tittel) og rendrer `.Content` i en `.syllabus-content`-wrapper.

Samme mønster (weight + icon + list/single-layout) brukes i andre seksjoner
som `content/shop/`, `content/syllabus/`, osv. — se `layouts/<section>/list.html`
og `single.html` for detaljer per seksjon.

---

## 8. Forsiden — "Kommende arrangementer"

- Kilde: `data/spond_events.json` (se 2.4) + `data/kampsport_events.json`
  (Fullkontakt-stevner vises separat, ikke i denne seksjonen — sjekk
  `layouts/index.html` for nøyaktig logikk).
- Logikk i `layouts/index.html`:
  - Filtrerer på `end` (eller `start` hvis `end` mangler) > `now`.
  - Viser maks 6 kommende.
  - Velger ikon/farge basert på nøkkelord i tittelen (Karatetrening graderte,
    Nybegynnere, Gradering, Sesongavslutning, Kamptrening, NM/Publikum,
    ellers en default-stjerne).
  - Viser ukedag (norsk, se 2.4) + dato + klokkeslett, eller et datospenn
    ved flerdagers-events (f.eks. leir).
  - Viser `location`-feltet fra Spond nederst på kortet.
  - Ingen "legg til"-knapp lenger (fjernet — var en visuell "+" som ikke
    hadde noen reell handlekurv-funksjon på denne seksjonen).

---

## 9. Klubbadministrasjon utenfor nettsiden (`~/projects/karateklubb`)

Dette er et **separat, ikke-offentlig prosjekt** (ikke en del av
`algardkarate`-repoet) som brukes til å administrere klubben via Spond
programmatisk — f.eks. for å sette oppmøte/status ("Deltar") på
arrangementer, generere NKKO-medlemsrapporter, og kjøre en Telegram-bot for
klubbspørsmål. Nyttig å ha med hvis en agent skal overta drift av klubbens
digitale verktøy, men det påvirker ikke selve nettsiden.

- **Bibliotek:** samme uoffisielle `spond`-pakke fra PyPI
  (`pip install spond`), som eksponerer `Spond.get_events`,
  `Spond.change_response` (sette et medlems svar på en invitasjon, f.eks.
  `{"accepted": true}` for "Deltar"), `Spond.get_groups`, m.fl.
- **Struktur:**
  ```
  src/karateklubb_mcp/
    spond_client.py   Tynn async-wrapper (login, hent gruppe/medlemmer/events,
                       klassifiser medlemmer på beltegrad)
    server.py         MCP-server (stdio) — eksponerer get_group, list_members,
                       list_events, list_posts, list_messages,
                       list_active_members_by_belt som MCP-tools
    report.py         Fyller NKKO medlemsliste-xlsx og sender på e-post
    telegram_bot.py   Polling-bot, svarer på /help /stats /grader /whoami
  report.py           CLI-inngang for rapportene
  launchd/            macOS LaunchAgents for planlagt kjøring (rapport 15/3
                       og 15/10, + alltid-på Telegram-bot)
  .env                SPOND_USERNAME/PASSWORD, GMAIL_USER/APP_PASSWORD,
                       TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_IDS
  ```
- **Installasjon:**
  ```bash
  cd ~/projects/karateklubb
  python3 -m venv .venv && source .venv/bin/activate
  pip install -e .
  cp .env.example .env   # fyll inn Spond + Gmail App Password
  ```
- **Eksempel — sette "Deltar" for alle inviterte på et event:**
  ```python
  from spond import spond
  s = spond.Spond(username=USERNAME, password=PASSWORD)
  events = await s.get_events(min_start=..., max_end=..., include_scheduled=True)
  # finn event-id, hent event["responses"]["unansweredIds"] for å se hvem som mangler svar
  for user_id in unanswered_ids:
      await s.change_response(event_id, user_id, {"accepted": True})
  ```
  (Dette er akkurat metoden som ble brukt for å sette alle trenere til
  "Deltar" på et arrangement fra denne CLI-sesjonen.)

---

## 10. Oppsummert sjekkliste for en agent som skal overta

1. **Klon repoet:** `git clone https://github.com/eelcoornd/algardkarate.git`
2. **Bygg lokalt:** installer Hugo extended, kjør `hugo server` for å se siten.
3. **For å endre innhold:** rediger `.md`-filer i `content/`, commit, push til
   `main` → autodeploy via GitHub Actions.
4. **For å endre design/logikk:** rediger `layouts/*.html` (Go templates) og
   `static/css/style.css`.
5. **For nye arrangementsdata:** ingenting å gjøre manuelt — cron kjører hver
   natt kl. 06:00 UTC og henter fra Spond automatisk. For umiddelbar
   oppdatering: `gh workflow run deploy-pages.yml --ref main`.
6. **For butikk/betaling:** endre i `worker/src/*.ts` eller
   `data/shop_products.json` / `content/shop/*.md`, push til `main` →
   `deploy-worker.yml` deployer automatisk til Cloudflare (production-miljø).
7. **Secrets:** sjekk `gh secret list` for GitHub Actions-secrets; Cloudflare
   Worker-secrets settes med `wrangler secret put` og synes ikke i GitHub.
8. **For klubbadministrasjon i Spond** (medlemslister, oppmøte, rapporter):
   bruk det separate `~/projects/karateklubb`-prosjektet — se seksjon 9.
9. **Domene:** DNS for `www.algardkarate.net` administreres utenfor GitHub,
   hos domeneregistraren for `algardkarate.net`. GitHub Pages custom domain
   er allerede konfigurert (`static/CNAME` + repo Pages-settings).
