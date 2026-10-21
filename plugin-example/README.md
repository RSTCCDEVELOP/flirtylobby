# Plugins

**Alleen door onze ontwikkelaar.** Een plugin draait pas als hij met de privésleutel van de ontwikkelaar is ondertekend (`plugin_build`); het systeem controleert elk bestand. Een plugin is gemaakt voor één versie van het systeem (`system_version`) en gebruikt de database en de talen van het systeem.

Een plugin is een los programma dat met het systeem samenwerkt. Het staat in `plugins/<naam>/` (die map zit **niet** in Git) en wordt als (ondertekend) zipbestand geüpload bij **Admin → Systeem → Plugins**; tijdens het ontwikkelen zet je hem direct in die map, de pluginpagina vindt hem vanzelf.

```
plugins/hello/
├── plugin.json        verplicht: naam, titel, versies, instellingen, menu, gebeurtenissen
├── plugin.py          optioneel: het programma (draait in het systeem)
├── web/index.html     optioneel: een eigen pagina in het dashboard
├── lang/<code>.json   de vertalingen (gemaakt door plugin_translate)
└── plugin.sig         de ondertekening (gemaakt door plugin_build)
```

## Ontwikkelen en bouwen (alleen de ontwikkelaar)
```
python manage.py plugin_keygen            # eenmalig: maakt de sleutel (privé in ~/.easy2edit/, publiek in apps/plugins/developer_public.pem)
# werk in plugins/<naam>/ ; in de ontwikkelomgeving (DEBUG) draait een niet-ondertekende map
python manage.py plugin_translate <naam>  # verzamelt de teksten (t("…") in de pagina, T("…") in plugin.py, plugin.json) en vult lang/<code>.json voor ALLE talen
python manage.py plugin_build <naam>      # zet system_version op de huidige systeemversie (bestand backend/VERSION), controleert de talen, ondertekent, maakt plugins/.dist/<naam>-<versie>.zip
python manage.py plugin_build --all       # na een update van het systeem: alle plugins opnieuw bouwen
```
Het zipbestand uit `plugins/.dist/` upload je bij Admin → Systeem → Plugins. Niet-ondertekende of gewijzigde zips worden geweigerd.

## Versies
Elke plugin heeft twee versienummers: `version` (van de plugin zelf) en `system_version` (de versie van het systeem waarvoor hij is gebouwd). Beide staan in de pluginlijst naast de versie van het systeem.
Wordt het systeem bijgewerkt (nieuw nummer in `backend/VERSION`), dan krijgt een plugin met een oudere `system_version` een **waarschuwing "niet meer up-to-date"**; bij een nieuwe hoofdversie start hij niet meer. Bouw hem dan opnieuw met `plugin_build`.

## Database
Een plugin gebruikt de database van het systeem. Definieer Django-modellen in `register(system)` met `Meta.app_label = system.app_label` en `Meta.db_table = system.db_prefix + "naam"` en roep `system.sync_models(Model, …)` aan: ontbrekende tabellen worden gemaakt (`plg_<naam>_…`). Wijzigt het schema, verhoog dan `schema` in plugin.json en schrijf `def migrate(system, old, new)` in plugin.py. Eigen bestanden (zoals afbeeldingen) komen in `system.data_dir`, dat een update van de plugin overleeft.

## Talen
Teksten schrijf je in het Nederlands: `t("Tekst {0}", x)` in de pagina (`system.t`), `T("Tekst {0}", x)` in plugin.py (`T = system.t`). Het systeem levert de vertaling in de taal van de bezoeker: eerst `lang/<code>.json` van de plugin, dan de eigen teksten van het systeem. `plugin_translate` vult die bestanden voor alle talen van het systeem (de teksten die het systeem al kent, de rest met Claude als die gekoppeld is) en `plugin_build` weigert een plugin die niet in alle talen is vertaald.

## plugin.json
| veld | betekenis |
|---|---|
| `name` | mapnaam: a-z, 0-9 en `-` (3-40 tekens) |
| `title`, `version`, `description`, `author` | tekst in de lijst; `version` is `1.2.3` |
| `system_version` | de systeemversie waarvoor hij is gebouwd (zet `plugin_build`) |
| `schema` | versie van de tabellen in de database (0 = geen eigen tabellen) |
| `section` | het onderdeel van het beheer waar de plugin bij hoort: `users`, `website`, `community`, `shop`, `subscription` of `system`. Zijn pagina komt in het menu van dat onderdeel (voor community: bij Contact) en zijn beheerpagina in de groep van dat onderdeel in het beheer |
| `python` / `web` | bestanden in de plugin (`plugin.py`, `web/index.html`) |
| `menu` | `{ "label": "Hello", "access": "admin" \| "members" }`: menu-item voor de pagina van de plugin |
| `config` | instellingen: `{ key, label, type: text\|textarea\|number\|bool\|select\|secret, default, options, hint }` |
| `events`, `permissions` | wat de plugin gebruikt, ter informatie voor de beheerder |

## plugin.py
```python
def register(system):
    T = system.t
    @system.route("GET", "hello")                     # GET /api/plugins/run/<naam>/hello (public=True: ook zonder login); <id> in het pad komt als argument
    def hello(request): return {"hi": system.config["greeting"]}

    @system.on("user_registered")                     # user_registered, user_login, listing_created, bid_placed, booking_created
    def welcome(user, **kw): system.send_mail(user.email, T("Welkom"), T("Fijn dat je er bent"))
```
`system`: `name`, `dir`, `data_dir`, `config` (de instellingen; geheime velden ontsleuteld), `log`, `User`, `t()`, `send_mail()`, `on()`, `route()`, `emit()`, `sync_models()`, `app_label`, `db_prefix`, `version`, `system_version`.
De plugin draait als vertrouwde code in het systeem: je mag alles importeren (`from apps.accounts.models import User`, de services en modellen).

## web/index.html
De pagina draait in een afgeschermd frame (geen toegang tot de login of de opslag van het systeem). Het systeem zet `window.system` in elke pagina:
`system.ready` (met de ingelogde gebruiker), `system.api("/pad", { method, body })` (een aanroep van de API namens de ingelogde gebruiker), `system.t()`, `system.confirm()` (het bevestigingsvenster van het systeem) en `system.resize()`. De kleuren van de site komen als CSS-variabelen (`--bg`, `--card`, `--text`, `--muted`, `--line`, `--blue`).

## Let op
- Alleen superadmins installeren plugins; na het uploaden staat een plugin uit.
- Een plugin heeft geen afscherming van het systeem: houd de privésleutel veilig.
- Draai je meerdere serverprocessen, dan pakt elk proces een aan- of uitgezette plugin binnen een paar seconden op.
- Gebruik je Docker: zet `PLUGINS_DIR` (standaard `/app/plugins`) op een volume, anders zijn de plugins en hun bestanden na een nieuwe container weg.

## Pagina's voor bezoekers, kop-link en aanbod aan het systeem

Een plugin kan pagina's op de website zelf zetten (zonder login, in de kop en voet van de site). Voorbeeld: de plugin `webshop`.

```json
"public_pages": [
  { "path": "producten", "file": "web/products.html", "title": "Producten" },
  { "path": "producten/<slug>", "file": "web/product.html", "title": "Product" },
  { "path": "winkelwagen", "file": "web/cart.html", "title": "Winkelwagen", "noindex": true }
],
"site_link": { "label": "Winkelwagen", "path": "/winkelwagen", "icon": "cart", "count_store": "cart" },
"provides": ["catalog"],
"page_object": true
```

- `public_pages`: het adres (een deel als `<slug>` komt in `ctx.route.params`), het bestand en de titel. Een routes in `plugin.py` die de pagina nodig heeft zet je met `public=True` open. Gereserveerde adressen (`api`, `dashboard`, `login`, `leden`, …) zijn niet toegestaan.
- `site_link`: een link in de kop van de website; `count_store` is de sleutel in de opslag van de plugin waarvan de aantallen (`[{id, qty}]`) als teller worden getoond.
- `provides: ["catalog"]`: de plugin biedt de producten aan het systeem aan (abonnementen, dashboard, sitemap). In `register`: `system.provide("catalog", obj)` met `products()`, `product(pk)`, `low_stock()`, `sitemap()` en `restock(order)`.
- `page_object`: de plugin mag als systeemobject op een pagina (ook in te stellen op de tab Plaatsing).

In de pagina (`window.system`) komen erbij:

- `system.ready` geeft ook `route: {path, query, params}` en `siteOrigin`.
- `system.store.get/set/remove(sleutel)`: opslag van de plugin in de browser van de bezoeker (de pagina zelf heeft geen opslag).
- `system.go(adres)`: open een adres van de website (of een volledige link).
- `system.pickMedia()`: de mediabibliotheek van het systeem; geeft `{id, url}` of `null`.
- `system.editHtml(html, {title})`: de tekstbewerker van het systeem; geeft de nieuwe html of `null`.

Let op: de eigen tabellen van een plugin hebben geen omgekeerde namen in queries (`Count("products")`): gebruik een tweede query. Na elke wijziging van een bestand de plugin opnieuw bouwen (`plugin_build`), anders klopt de ondertekening niet meer.

## Bestanden versturen en routes met een pad

- `system.upload(pad, bestand, velden)`: stuurt een bestand (multipart) naar het systeem als het ingelogde lid, bijvoorbeeld naar een route van de plugin zelf: `system.upload("/plugins/run/<naam>/admin/upload", file)`.
- Een route mag als laatste deel `<*naam>` hebben: dat krijgt de rest van het pad (ook met mappen), bijvoorbeeld `system.route("GET", "play/<slug>/<*rest>", fn, public=True)`.
- Een plugin kan zelf een Django-antwoord teruggeven (HttpResponse) met eigen kopregels, bijvoorbeeld om bestanden uit zijn datamap te tonen.
- Een pagina van een plugin mag in het kader van de website; downloaden (`allow-downloads`) en schermvullend (`allow="fullscreen"`) zijn toegestaan.

## Spelletjes: de plugin `games`

De plugin `games` is een spelletjeshal. Elk spel is een eigen pakket (zip met `game.json`) dat bij Admin → Plugins → Spelletjes → Spel uploaden wordt geladen. Zie daar de handleiding (game.json en `window.game`). Een spel draait afgeschermd (geen login, geen internet, geen opslag van de browser) en bewaart scores en voortgang via de SDK.
