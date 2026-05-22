#!/usr/bin/env bash
# Cloudflare Tunnel setup voor GitHub webhook ontvangst.
#
# Resultaat: een publieke URL die naar localhost:3400 routeert.
# GitHub stuurt webhooks naar die URL → de Next.js app ontvangt ze.
#
# Vereist: brew install cloudflared

set -e

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared niet geïnstalleerd. Run: brew install cloudflared"
  exit 1
fi

echo "▶ Start Cloudflare Quick Tunnel (geen account nodig)..."
echo "  → De publieke URL verschijnt zo. Kopieer 'm en plak in scripts/setup-github-webhook.sh"
echo ""

# Quick tunnel = gratis, ephemerale URL. Voor permanente: cloudflared tunnel create + DNS.
cloudflared tunnel --url http://localhost:3400
