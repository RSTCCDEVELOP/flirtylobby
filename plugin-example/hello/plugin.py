"""Voorbeeldplugin. `register(system)` wordt aangeroepen als de plugin aan gaat (en na elke start van het systeem).
De plugin draait in het systeem en mag alles gebruiken: `from apps.accounts.models import User`, de services, de modellen …
Teksten voor de gebruiker schrijf je in het Nederlands met T("…"): het systeem levert ze in alle talen (zie README)."""


def register(system):
    T = system.t

    # 1. een route: GET /api/plugins/run/hello/hello  (alleen voor ingelogde leden; public=True voor iedereen)
    @system.route("GET", "hello")
    def hello(request):
        text = system.config["greeting"]
        name = request.user.first_name or request.user.email
        return {"message": f"{text.upper() if system.config['loud'] else text}, {name}!", "members": system.User.objects.count()}

    # 2. gebeurtenissen van het systeem: user_registered, user_login, listing_created, bid_placed, booking_created
    @system.on("user_registered")
    def welcome(user, **kw):
        system.log.info("Nieuw lid: %s", user.email)
        if system.config["notify_email"]:
            system.send_mail(system.config["notify_email"], T("Nieuw lid"), T("{0} heeft zich aangemeld.", user.email))
