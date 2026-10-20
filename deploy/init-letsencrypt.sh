#!/bin/sh
# One-time: request the first certificate (DOMAIN + api.DOMAIN) before nginx starts.
# Requires DNS A-records for both names pointing at this VPS and port 80 free.
set -e
cd "$(dirname "$0")"
. ./.env

docker compose run --rm -p 80:80 --entrypoint certbot certbot \
  certonly --standalone --non-interactive --agree-tos \
  -m "$LETSENCRYPT_EMAIL" \
  -d "$DOMAIN" -d "api.$DOMAIN"

docker compose up -d
