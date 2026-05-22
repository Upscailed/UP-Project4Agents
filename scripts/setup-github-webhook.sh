#!/usr/bin/env bash
# Maak de GitHub webhook aan op de repo via `gh` CLI.
#
# Gebruik:
#   ./scripts/setup-github-webhook.sh <publieke-url> [<repo>]
#
# Voorbeeld:
#   ./scripts/setup-github-webhook.sh https://xyz.trycloudflare.com Upscailed/UP-Project4Agents

set -e

URL="${1:-}"
REPO="${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')}"

if [ -z "$URL" ]; then
  echo "Gebruik: $0 <publieke-url> [<repo>]"
  echo "  bv: $0 https://xyz.trycloudflare.com Upscailed/UP-Project4Agents"
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "❌ Kan repo niet detecteren. Geef 'm als 2e argument: $0 <url> <owner/repo>"
  exit 1
fi

# Zorg dat er een secret bestaat
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ] || ! grep -q "GITHUB_WEBHOOK_SECRET" "$ENV_FILE"; then
  SECRET=$(openssl rand -hex 32)
  echo "GITHUB_WEBHOOK_SECRET=$SECRET" >> "$ENV_FILE"
  echo "✓ Gegenereerd webhook secret en in $ENV_FILE gezet"
else
  SECRET=$(grep "GITHUB_WEBHOOK_SECRET" "$ENV_FILE" | cut -d= -f2)
  echo "✓ Bestaand webhook secret hergebruikt uit $ENV_FILE"
fi

WEBHOOK_URL="${URL%/}/api/github/webhook"

echo "▶ Maak webhook aan op $REPO → $WEBHOOK_URL"
gh api -X POST "repos/$REPO/hooks" \
  -f "name=web" \
  -F "active=true" \
  -f "events[]=push" \
  -f "events[]=pull_request" \
  -f "events[]=issue_comment" \
  -f "config[url]=$WEBHOOK_URL" \
  -f "config[content_type]=json" \
  -f "config[secret]=$SECRET" \
  -f "config[insecure_ssl]=0"

echo ""
echo "✓ Webhook geregistreerd. Test 'm:"
echo "  gh api repos/$REPO/hooks | jq '.[] | {id, config: .config.url, last_response}'"
echo ""
echo "▶ Vergeet niet je dev-server te (her)starten zodat .env.local geladen wordt:"
echo "  cd $(pwd) && npm run dev"
