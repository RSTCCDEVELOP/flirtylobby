#!/bin/sh
set -e
python manage.py migrate --noinput
python manage.py ensure_admin
python manage.py collectstatic --noinput
exec "$@"
