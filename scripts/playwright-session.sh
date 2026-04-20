#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-open}"
BASE_URL="${BASE_URL:-http://127.0.0.1:5173}"
SESSION="${PW_SESSION:-stow-audit}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required for the Playwright CLI wrapper."
  exit 1
fi

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

if [ ! -x "$PWCLI" ]; then
  echo "Playwright wrapper not found at $PWCLI"
  exit 1
fi

case "$COMMAND" in
  open)
    "$PWCLI" --session "$SESSION" open "$BASE_URL" --headed
    "$PWCLI" --session "$SESSION" snapshot
    ;;
  snapshot)
    "$PWCLI" --session "$SESSION" snapshot
    ;;
  screenshot)
    "$PWCLI" --session "$SESSION" screenshot
    ;;
  console)
    "$PWCLI" --session "$SESSION" console
    ;;
  close)
    "$PWCLI" --session "$SESSION" close
    ;;
  *)
    echo "Usage: bash ./scripts/playwright-session.sh {open|snapshot|screenshot|console|close}"
    exit 1
    ;;
esac
