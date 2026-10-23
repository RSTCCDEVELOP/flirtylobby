# Easy2edit

Django (DRF) backend + Next.js (SSR) frontend.

```
backend/    Django, DRF, apps: core (/api/health/), accounts (custom User), members (Members)
frontend/   Next.js, port 5173
Database/   db.sqlite3 (dev only, shared by Docker and local)
deploy/     production compose, nginx, certbot, init script
.github/workflows/deploy.yml
```

## Local (no Docker)

```bash
# backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver          # http://localhost:8000/api/health/

# frontend
cd frontend
cp .env.example .env
npm install
npm run dev                         # http://localhost:5173
```

(`./start-backend.sh` / `./start-frontend.sh` do the same.)

## Docker (development)

```bash
docker compose up --build
```

- Backend `:8000`, frontend `:5173`.
- API URL: browser -> `http://localhost:8000` (`NEXT_PUBLIC_API_URL`), Next.js server -> `http://backend:8000` (`API_URL_INTERNAL`).

### SQLite volume mapping
`./Database:/app/Database` maps the host folder into the container. The backend code sits in `/app/backend`, so `settings.py` resolves `<parent of backend>/Database/db.sqlite3` = `/app/Database/db.sqlite3` in Docker and `./Database/db.sqlite3` locally: the **same file**. Because it is a bind mount, the data survives `docker compose down`.

### Docker vs local
| | Local | Docker |
|---|---|---|
| DB file | `./Database/db.sqlite3` | `/app/Database/db.sqlite3` (same file via volume) |
| SSR API URL | `http://localhost:8000` | `http://backend:8000` |
| Browser API URL | `http://localhost:8000` | `http://localhost:8000` |
| Config | `backend/.env`, `frontend/.env` | compose `environment:` |

Don't run both at the same time on the same SQLite file.

## Production (VPS, `/opt/easy2edit`)

Stack (`deploy/docker-compose.prod.yml`): postgres, backend (gunicorn), frontend, nginx (forces HTTPS for `DOMAIN` and `api.DOMAIN`), certbot (renews every 12h; nginx reloads every 6h). Images come from `ghcr.io`.

One-time VPS setup:
1. DNS A-records for `DOMAIN` and `api.DOMAIN` -> VPS. Docker + compose installed.
2. `mkdir -p /opt/easy2edit` and create `/opt/easy2edit/.env` from `deploy/.env.example`.
3. GitHub repo settings:
   - Variable: `DOMAIN`
   - Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_USER`, `GHCR_PULL_TOKEN` (PAT with `read:packages`)
4. Push to `main`: the workflow builds + pushes images and copies the deploy files. The first run stops short of starting (no certificate yet), so then run on the VPS:
   `cd /opt/easy2edit && ./init-letsencrypt.sh`
5. Later pushes pull the new images and restart automatically.

Create an admin user: `docker compose exec backend python manage.py createsuperuser`.

## Models
- `members.Members`: `name`, `image` (-> `images/tms/coaches/`), `description`; `__str__` = name.
- `accounts.User` (extends `AbstractUser`): `function`, `role`, `link`, `link_external`, `short`, `description`, `otp_token`, `otp_active`.

## Beheer (dashboard)
- Login: `/login`. The first admin is created on start from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`python manage.py ensure_admin`).
- `/dashboard`: dashboard, own profile. `/dashboard/admin`: users (create/block/delete), members, design ("Vormgeving": colors, fonts, sizes; defined in `backend/apps/core/theme.py`).
