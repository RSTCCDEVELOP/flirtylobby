#!/bin/sh
# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
