#!/bin/bash
# Maakt een certificaat voor lokaal testen met https (localhost, 127.0.0.1 en het adres van dit netwerk) in .certs/.
# Met mkcert (brew install mkcert && mkcert -install) is het certificaat vertrouwd door je browser: nodig voor passkeys en inloggen met Google of Apple.
# Zonder mkcert maakt dit script een zelfondertekend certificaat (de browser waarschuwt; passkeys werken dan niet).
# Een eigen domeinnaam voor lokaal testen (bijvoorbeeld siten.easy2edit.com): ./dev-certs.sh siten.easy2edit.com ander.easy2edit.com
# Zonder namen gebruikt het script de namen die eerder zijn opgeslagen in .certs/domains (standaard: siten.easy2edit.com).
set -e
cd "$(dirname "$0")"
mkdir -p .certs
if [ $# -gt 0 ]; then echo "$@" | tr ' ' '\n' > .certs/domains; fi
[ -f .certs/domains ] || echo "siten.easy2edit.com" > .certs/domains
DOMAINS=$(tr '\n' ' ' < .certs/domains)
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
NAMES="localhost 127.0.0.1 ::1 ${LAN_IP} ${DOMAINS}"
if command -v mkcert >/dev/null 2>&1; then
  mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem $NAMES
  echo "$(mkcert -CAROOT)/rootCA.pem" > .certs/ca-path
  echo "Klaar (mkcert): .certs/cert.pem en .certs/key.pem voor: $NAMES"
  for d in $DOMAINS; do echo "  Zet in /etc/hosts:  127.0.0.1 $d     (sudo nano /etc/hosts)   of maak een DNS-record $d -> 127.0.0.1"; echo "  Open dan: https://$d:5173"; done
else
  SAN="DNS:localhost,IP:127.0.0.1,IP:::1"
  [ -n "$LAN_IP" ] && SAN="$SAN,IP:$LAN_IP"
  for d in $DOMAINS; do SAN="$SAN,DNS:$d"; done
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=localhost" -addext "subjectAltName=$SAN" -keyout .certs/key.pem -out .certs/cert.pem 2>/dev/null
  echo "$(pwd)/.certs/cert.pem" > .certs/ca-path
  echo "Klaar (zelfondertekend): .certs/cert.pem voor: $SAN"
  echo "Let op: de browser vertrouwt dit niet. Voor passkeys: brew install mkcert && mkcert -install en draai dit script opnieuw."
fi
