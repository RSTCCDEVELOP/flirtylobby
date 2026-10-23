# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""
Permission catalog. Roles are sets of these keys; beheerders (is_staff) have all of them.
To protect a new feature: add a key here, then guard the view with `has_perm("key")` (backend)
and check `can("key")` (frontend).
"""

# (key, label, group)
PERMISSIONS = [
    ("content.edit", "Website in bewerkmodus bewerken", "Content"),
    ("moderation.access", "Moderatie (toegang)", "Content"),
    ("users.manage", "Gebruikers en members beheren", "Beheer"),
    ("roles.manage", "Rollen beheren", "Beheer"),
    ("languages.manage", "Talen beheren", "Beheer"),
    ("seo.manage", "SEO beheren", "Beheer"),
    ("community.manage", "Community beheren (profielen, berichten, chat)", "Community"),
    ("products.manage", "Producten beheren", "Webshop"),
    ("orders.manage", "Orders beheren", "Webshop"),
    ("orders.documents", "Documenten van orders verwijderen (pakbon, factuur, retourbon, creditfactuur)", "Webshop"),
    ("sandbox.manage", "Sandbox beheren", "Beheer"),
    ("integrations.manage", "API keys beheren", "Beheer"),
    ("communication.manage", "Communicatie beheren", "Beheer"),
    ("branding.manage", "Logo's en beeld beheren", "Beheer"),
    ("media.manage", "Mediabibliotheek beheren (S3/lokaal)", "Beheer"),
    ("theme.manage", "Vormgeving beheren", "Beheer"),
    ("pages.manage", "Pagina's en menu beheren", "Beheer"),
    ("security.manage", "Beveiliging beheren", "Beheer"),
]
KEYS = [p[0] for p in PERMISSIONS]
# Permissions that give access to the admin area of the dashboard
ADMIN_KEYS = [k for k in KEYS if k.endswith(".manage")]

DEFAULT_ROLES = [
    ("content-manager", "Content manager", "Mag de website bewerken via de bewerkmodus.", ["content.edit"]),
    ("moderator", "Moderator", "Heeft toegang tot moderatie.", ["moderation.access"]),
    ("gebruiker", "Gebruiker", "Alleen een eigen dashboard en profiel.", []),
]


def catalog():
    groups = {}
    for key, label, group in PERMISSIONS:
        groups.setdefault(group, []).append({"key": key, "label": label})
    return [{"group": g, "permissions": p} for g, p in groups.items()]
