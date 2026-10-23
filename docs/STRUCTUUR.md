# Systeem en site gescheiden

Doel: het **systeem** (Easy2edit) blijft één code-basis die je op elke website kunt bijwerken, en alles van **één website** staat apart, zodat een update nooit content overschrijft.

```
easy2edit/                   ← SYSTEEM  (git: RSTCCDEVELOP/easy2edit)
├── backend/                 Django: kern, modules, plugin-runtime, API
├── frontend/                Next.js: website, dashboard, admin
├── deploy/                  nginx, docker-compose.prod, certificaten
├── plugin-example/          voorbeeldplugin voor ontwikkelaars
├── docs/                    deze documentatie
└── site/                    ← JOUW WEBSITE  (NIET in de systeem-repository)
    ├── Database/            db.sqlite3 en back-ups
    ├── media/               geüploade afbeeldingen en video's
    ├── plugins/             plugins van deze site (games, webshop, marktplaats, eigen werk)
    ├── themes/              themapakketten van deze site
    └── content/             exports, imports, logo's en losse bestanden
```

## De bibliotheek: `resource/`
`resource/` hoort bij het product en gaat mee in git. Hierin staan de zips die je zonder uploaden kunt toevoegen:

```
resource/
├── plugins/      <naam>-<versie>.zip   (ondertekend met plugin_build; alleen de nieuwste versie)
├── themas/       <thema>-<versie>.zip  en alle-themas.zip   (theme_build / Admin → Thema → exporteren)
├── languages/    <code>.zip  en all_languages.zip           (Admin → Talen → exporteren)
└── allowed.json  welke plugins, thema's en talen gebruikers zonder uploaden mogen installeren
```
- Bouwen: `python manage.py plugin_build --all` zet de zips in `resource/plugins` en ruimt oudere versies op; thema's en talen worden vanuit Admin geëxporteerd naar `resource/themas` en `resource/languages`. Niets komt meer in `.dist`.
- Gebruiken: Admin → Plugins / Thema / Talen hebben de knoppen **Toevoegen uit de bibliotheek** en **Updaten** (alleen wat nieuwer is dan wat is geïnstalleerd).
- Rechten: een superadmin installeert alles; wie het onderdeel mag beheren maar geen superadmin is, installeert alleen wat is aangevinkt in Super admin → Bibliotheek (opgeslagen in `resource/allowed.json`).
- In Docker/Coolify wordt `./resource` gemount op `/app/resource` (`RESOURCE_DIR`).

## Regels
- **Systeem** = `backend/`, `frontend/`, `deploy/`. Hier staat niets van één site. Wijzig je hier iets, dan geldt het voor alle sites na een update.
- **Site** = alles in `site/`. Een update van het systeem raakt deze map nooit.
- `site/` heeft een eigen (privé) repository of een back-up. Een nieuwe website = een nieuwe site-map met dezelfde systeemcode.
- Nieuwe functies voor alle sites: bouw ze in het **systeem** of als **plugin**. Site-eigen functies: plugin in `site/plugins/`, uiterlijk: themapakket in `site/themes/`.

## Hoe het systeem de site vindt
`backend/config/settings.py` kent `SITE_DIR` (standaard `<project>/site`, of de omgevingsvariabele `SITE_DIR`).
Daaruit komen `DB_PATH`, `MEDIA_ROOT`, `PLUGINS_DIR` en `THEMES_DIR`; elk daarvan is ook los in te stellen.
Een installatie van vóór deze indeling blijft werken: bestaat `site/<onderdeel>` nog niet, maar de oude plek wel, dan wordt de oude plek gebruikt.

## Een bestaande installatie omzetten
1. Stop backend en frontend (de database mag niet in gebruik zijn).
2. `cd backend && python manage.py site_init --move`
   verplaatst `Database/`, `plugins/`, `themes/`, `backend/media` en `CONTENT/` naar `site/`.
3. Start opnieuw. Controleer Admin → Plugins en Thema.

## Een nieuwe website starten
1. Clone het systeem.
2. `cd backend && python manage.py site_init` maakt `site/` met alle mappen.
3. Kopieer de gewenste plugins (`.zip`, ondertekend) en thema's naar `site/plugins` en `site/themes`, of upload ze in Admin.
4. `backend/.env` is de configuratie van deze installatie (adressen, sleutels); dit bestand zit niet in git.

## Het systeem bijwerken op een site
`git pull` van het systeem, daarna migraties (`manage.py migrate`, gebeurt bij het opstarten) en een nieuwe frontend-build. `site/` blijft zoals het is. Plugins zijn gebouwd voor een systeemversie (`system_version` in plugin.json); bouw ze opnieuw met `plugin_build` als die verandert.

## Wat nog in het systeem zit maar bij een site hoort
- `frontend/public/logos/` (logo's van RSTCC en Studio2) en `frontend/public/logo-rstcc.png`: dit zijn voorbeeld-merken. Een site kiest zijn logo's via Thema → Logo's (opgeslagen in `site/media`); de bestanden hier zijn alleen de standaardwaarden.
- `docker-compose*.yml`: gebruik `SITE_DIR` en mount `./site` als volume.
