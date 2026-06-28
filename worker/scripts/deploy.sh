#!/usr/bin/env bash
# Deploy Cloudflare Worker for algardkarate shop API.
#
# Usage:
#   scripts/deploy.sh            # deployer default (test-miljø)
#   scripts/deploy.sh production # deployer production
#
# Krever:
#   - node + npm installert
#   - ../.env med CLOUDFLARE_API_TOKEN
#   - For prod: ../../karateklubb/.env med VIPPS_PROD_* og VIPPS_TEST_* secrets
#     (eller en alternativ secrets-fil — sett SECRETS_ENV_FILE)

set -euo pipefail

WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$WORKER_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"
SECRETS_ENV_FILE="${SECRETS_ENV_FILE:-$REPO_DIR/../karateklubb/.env}"

TARGET_ENV="${1:-test}"
case "$TARGET_ENV" in
  test|production) ;;
  *) echo "Ukjent miljø: $TARGET_ENV (bruk 'test' eller 'production')" >&2; exit 2;;
esac

cd "$WORKER_DIR"

load_env() {
  # Trygg .env-parser: aksepterer KEY=value med mellomrom i value.
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
    local key="${BASH_REMATCH[1]}"
    local val="${BASH_REMATCH[2]}"
    # Strip inline-kommentar (alt fra ' #' og ut), trim whitespace, strip omkringliggende quotes
    val="${val%%[[:space:]]#*}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    export "$key=$val"
  done < "$file"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Mangler $ENV_FILE (CLOUDFLARE_API_TOKEN)" >&2
  exit 1
fi

load_env "$ENV_FILE"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN er ikke satt i $ENV_FILE" >&2
  exit 1
fi

WRANGLER=(npx --yes wrangler@3)

echo "==> Verifiserer Cloudflare-token"
"${WRANGLER[@]}" whoami >/dev/null

echo "==> Installerer worker-avhengigheter"
if [[ ! -d node_modules ]]; then
  npm install --no-audit --no-fund --silent
fi

ensure_kv() {
  local binding="$1"
  local placeholder="$2"
  if grep -q "$placeholder" wrangler.toml; then
    echo "==> Oppretter KV namespace '$binding'"
    local out
    out=$("${WRANGLER[@]}" kv namespace create "$binding" 2>&1 | tee /dev/stderr)
    local id
    id=$(echo "$out" | grep -oE 'id = "[a-f0-9]+"' | head -1 | sed 's/.*"\([a-f0-9]*\)"/\1/')
    if [[ -z "$id" ]]; then
      # KV finnes allerede — hent eksisterende id
      id=$("${WRANGLER[@]}" kv namespace list 2>/dev/null \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const ns=j.find(n=>n.title.endsWith("-'$binding'")||n.title==="'$binding'");if(ns)console.log(ns.id)})')
    fi
    if [[ -z "$id" ]]; then
      echo "Klarte ikke finne KV-id for $binding" >&2
      exit 1
    fi
    echo "    -> $binding id=$id"
    sed -i.bak "s/$placeholder/$id/" wrangler.toml && rm -f wrangler.toml.bak
  fi
}

ensure_kv ORDERS    REPLACE_WITH_ORDERS_KV_ID
ensure_kv DISCOUNTS REPLACE_WITH_DISCOUNTS_KV_ID

put_secret() {
  local name="$1"; local value="$2"; local env_flag="$3"
  if [[ -z "$value" ]]; then
    echo "    [skip] $name (mangler verdi)"
    return
  fi
  printf '%s' "$value" | "${WRANGLER[@]}" secret put "$name" $env_flag >/dev/null
  echo "    [ok]   $name"
}

sync_secrets() {
  local env_flag="$1"   # "" for default, "--env production" for prod
  local label="$2"
  echo "==> Synker secrets ($label)"

  if [[ -f "$SECRETS_ENV_FILE" ]]; then
    load_env "$SECRETS_ENV_FILE"
  fi

  if [[ "$label" == "production" ]]; then
    put_secret VIPPS_PROD_CLIENT_ID         "${VIPPS_PROD_CLIENT_ID:-}"                  "$env_flag"
    put_secret VIPPS_PROD_CLIENT_SECRET     "${VIPPS_PROD_CLIENT_SECRET:-}"              "$env_flag"
    put_secret VIPPS_PROD_SUBSCRIPTION_KEY  "${VIPPS_PROD_SUBSCRIPTION_KEY_PRIMARY:-}"   "$env_flag"
    put_secret VIPPS_PROD_MSN               "${VIPPS_PROD_MSN:-}"                        "$env_flag"
  else
    put_secret VIPPS_TEST_CLIENT_ID         "${VIPPS_TEST_CLIENT_ID:-}"                  "$env_flag"
    put_secret VIPPS_TEST_CLIENT_SECRET     "${VIPPS_TEST_CLIENT_SECRET:-}"              "$env_flag"
    put_secret VIPPS_TEST_SUBSCRIPTION_KEY  "${VIPPS_TEST_SUBSCRIPTION_KEY_PRIMARY:-}"   "$env_flag"
    put_secret VIPPS_TEST_MSN               "${VIPPS_TEST_MSN:-}"                        "$env_flag"
  fi

  put_secret TELEGRAM_BOT_TOKEN       "${TELEGRAM_BOT_TOKEN:-}"             "$env_flag"
  put_secret TELEGRAM_CLUB_CHAT_ID    "${TELEGRAM_CLUB_CHAT_ID:-}"          "$env_flag"
  put_secret MAIL_FROM                "${MAIL_FROM:-noreply@algardkarate.net}" "$env_flag"
}

if [[ "$TARGET_ENV" == "production" ]]; then
  sync_secrets "--env production" production
  echo "==> Deployer (production)"
  "${WRANGLER[@]}" deploy --env production
else
  sync_secrets "" test
  echo "==> Deployer (test/default)"
  "${WRANGLER[@]}" deploy
fi

echo "==> Ferdig."
