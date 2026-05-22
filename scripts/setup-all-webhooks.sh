#!/usr/bin/env bash
# Registreer de P4A-webhook op alle repos van een GitHub-organisatie (idempotent).
# Skipt repos waar al een webhook met dezelfde URL staat.
#
# Gebruik:
#   ./scripts/setup-all-webhooks.sh <org> <secret>
#
# Voorbeeld:
#   ./scripts/setup-all-webhooks.sh Upscailed $(grep GITHUB_WEBHOOK_SECRET .env.local | cut -d= -f2)

set -e

ORG="${1:-Upscailed}"
SECRET="${2:-}"
WEBHOOK_URL="https://project4agents.upscailed.nl/api/github/webhook"

if [ -z "$SECRET" ]; then
  echo "❌ Geen secret meegegeven."
  echo "   Gebruik: $0 <org> <secret>"
  echo "   Of:      $0 $ORG \$(grep GITHUB_WEBHOOK_SECRET .env.local | cut -d= -f2)"
  exit 1
fi

echo "▶ Org: $ORG"
echo "▶ Webhook URL: $WEBHOOK_URL"
echo

REPOS=$(gh repo list "$ORG" --limit 200 --json name --jq '.[].name')

ADDED=0
SKIPPED=0
ERRORS=0

for REPO in $REPOS; do
  FULL="$ORG/$REPO"
  EXISTING=$(gh api "repos/$FULL/hooks" --jq ".[] | select(.config.url == \"$WEBHOOK_URL\") | .id" 2>/dev/null | head -1)

  if [ -n "$EXISTING" ]; then
    echo "  ✓ $FULL — al gekoppeld (hook $EXISTING)"
    SKIPPED=$((SKIPPED+1))
    continue
  fi

  if gh api -X POST "repos/$FULL/hooks" \
    -f "name=web" -F "active=true" \
    -f "events[]=push" -f "events[]=pull_request" -f "events[]=issue_comment" \
    -f "config[url]=$WEBHOOK_URL" \
    -f "config[content_type]=json" \
    -f "config[secret]=$SECRET" \
    -f "config[insecure_ssl]=0" > /dev/null 2>&1; then
    echo "  ➕ $FULL — webhook toegevoegd"
    ADDED=$((ADDED+1))
  else
    echo "  ❌ $FULL — kon webhook niet zetten (rechten?)"
    ERRORS=$((ERRORS+1))
  fi
done

echo
echo "── Klaar ──"
echo "  ➕ Toegevoegd: $ADDED"
echo "  ✓  Al aanwezig: $SKIPPED"
echo "  ❌ Errors: $ERRORS"
