#!/usr/bin/env bash
# Henter Spond-arrangementer lokalt (GitHub-IP blokkeres av Spond), committer
# og pusher data/spond_events.json bare hvis innholdet har endret seg.
# Ved feil sendes varsel på Telegram. Kjøres av crontab.
set -uo pipefail
REPO="/home/copilot/projects/algardkarate"
PY="/home/copilot/projects/karateklubb/.venv/bin/python"
LOG="$HOME/.hermes/cache/spond_sync.log"
cd "$REPO" || exit 1

notify() {
  local tok
  tok=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$HOME/.hermes/.env" | cut -d= -f2-)
  [ -n "$tok" ] && curl -s -m 20 "https://api.telegram.org/bot${tok}/sendMessage" \
    -d chat_id=8592471457 --data-urlencode "text=$1" >/dev/null
}

set -a; . ./.env.spond; set +a
if ! "$PY" scripts/fetch_spond_events.py >>"$LOG" 2>&1; then
  notify "Spond-synk feilet $(date '+%d.%m %H:%M'). Se ~/.hermes/cache/spond_sync.log"
  exit 1
fi

if git diff --quiet -- data/spond_events.json; then
  echo "$(date '+%F %T') ingen endring" >>"$LOG"; exit 0
fi
git add data/spond_events.json
git commit -q -m "Spond-arrangementer oppdatert ($(date '+%d.%m.%Y'))" \
  && git push -q origin HEAD:main >>"$LOG" 2>&1 \
  || { notify "Spond-synk: commit/push feilet $(date '+%d.%m %H:%M')"; exit 1; }
echo "$(date '+%F %T') pushet ny data" >>"$LOG"
