# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Where the GO button of a help item leads: the page, the tab(s) and the foldable block that hold the setting.
id -> (page address, [tabs, outer one first], [foldable blocks to open]).  A tab or block id that a page does not have is simply ignored, so a page that was changed
never breaks a link. Items about the edit mode open the home page in edit mode (?edit=1)."""
EDIT = "/?edit=1"
PAGES = "/dashboard/admin/pages"
THEME = "/dashboard/admin/theme"
SUPER = "/dashboard/superadmin"
PLUGINS = "/dashboard/admin/plugins"
COMMUNITY = "/dashboard/community"

GO = {
    # ── user ──
    "what": ("/dashboard", [], []), "dash": ("/dashboard", [], []), "search": ("/dashboard", [], []), "short": ("/dashboard", [], []), "tiles": ("/dashboard", [], []),
    "lang": ("/dashboard/profile", [], []), "mode": ("/dashboard/profile", [], []), "twofa": ("/dashboard/profile", [], []),
    "easy": ("/", [], []),
    "mysubs": ("/dashboard/subscriptions", [], []), "subsuser": ("/dashboard/subscriptions", [], []),
    "profile": (f"{COMMUNITY}/profile", [], []), "available": (f"{COMMUNITY}/profile", [], []), "visible": (f"{COMMUNITY}/profile", [], []),
    "discover": (f"{COMMUNITY}/discover", [], []), "swipe": (f"{COMMUNITY}/discover", [], []), "hide": (f"{COMMUNITY}/discover", [], []), "dating": (f"{COMMUNITY}/discover", [], []),
    "messages": (f"{COMMUNITY}/messages", [], []), "chat": (f"{COMMUNITY}/chat", [], []),
    "direct": (f"{COMMUNITY}/direct", [], ["direct-live"]), "chat2": (f"{COMMUNITY}/direct", [], ["direct-live"]),
    "friends": (f"{COMMUNITY}/requests", [], ["req-in"]),
    "gameuser": ("/dashboard/plugins/games", [], []), "shopuser": ("/producten", [], []), "ordersuser": ("/dashboard/plugins/orders", [], []), "donateuser": ("/doneren", [], []),
    # ── admin: pages and menu ──
    "pages": (PAGES, ["public"], ["pages-overview-public"]), "webpages": (PAGES, ["public"], ["pages-overview-public"]), "slug": (PAGES, ["public"], ["pages-overview-public"]),
    "adminpagepack": (PAGES, ["public"], ["pages-overview-public"]), "adminsecurity": (PAGES, ["public"], ["pages-overview-public"]),
    "private": (PAGES, ["private"], ["pages-overview-private"]),
    "newitem": (PAGES, ["public", "menu"], ["pages-menu-public"]), "menu": (PAGES, ["public", "menu"], ["pages-menu-public"]),
    "menuset": (PAGES, ["public", "settings"], ["pages-menu-public"]), "header": (PAGES, ["public", "settings"], ["pages-menu-public"]),
    "objects": ("/dashboard/admin/sysobjects", [], []),
    # ── admin: edit mode (on the website) ──
    **{k: (EDIT, [], []) for k in ("editmode", "blocks", "layout", "hero", "lists", "imgsize", "bg", "heroblock", "padding", "columns", "fullwidth", "blockfx", "heroalign", "blockstyle",
                                    "textsettings", "movefixed", "undo", "helpmode")},
    "admineditmode": ("/dashboard", [], []),
    # ── admin: theme ──
    "theme": (f"{THEME}?tab=packs", ["packs"], []), "themepack": (f"{THEME}?tab=packs", ["packs"], ["theme-pack-all"]), "themeupload": (f"{THEME}?tab=packs", ["packs"], ["theme-pack-upload"]),
    "adminthemeai": (f"{THEME}?tab=packs", ["packs"], ["theme-pack-all"]), "superexport": (f"{THEME}?tab=packs", ["packs"], ["theme-pack-all"]),
    "branding": (f"{THEME}?tab=brand", ["brand"], ["brand-assets"]), "email": (f"{THEME}?tab=email", ["email"], []),
    "textstyles": (f"{THEME}?tab=look", ["look"], []),
    "loader": (f"{THEME}?tab=loader", ["loader"], ["loader-page"]), "loaderpct": (f"{THEME}?tab=loader", ["loader"], ["loader-page"]),
    "transition": (f"{THEME}?tab=loader", ["loader"], ["loader-transition"]), "transswitch": (f"{THEME}?tab=loader", ["loader"], ["loader-transition"]),
    # ── admin: the rest ──
    "media": ("/dashboard/admin/media", [], []),
    "seo": ("/dashboard/admin/seo", [], ["seo-site"]),
    "shop": ("/dashboard/admin/plugin/webshop", [], []), "orders": ("/dashboard/admin/plugin/orders", [], []),
    "subs": ("/dashboard/admin/subscriptions", ["plans"], []), "donate": ("/dashboard/admin/donations", ["campaigns"], []), "actions": ("/dashboard/admin/actions", [], []),
    "comm": ("/dashboard/admin/community", ["settings", "how"], ["comm-general"]),
    "games": (f"{PLUGINS}/games", [], []), "gamemanage": (f"{PLUGINS}/games", [], []), "gameupload": (f"{PLUGINS}/games", ["content"], []), "gameset": (f"{PLUGINS}/games", [], []),
    "users": ("/dashboard/admin/users", [], ["users-list"]), "roles": ("/dashboard/admin/roles", [], ["roles-list"]),
    "security": ("/dashboard/admin/security", [], ["sec-basic"]),
    "maint": ("/dashboard/admin/system", [], ["sys-site"]),
    "apikeys": ("/dashboard/admin/integrations", [], ["integrations-list"]),
    "faqown": ("/dashboard/admin/faq", ["website"], []),
    "adminmenu": ("/dashboard/admin", [], ["admin-overview"]), "admintiles": ("/dashboard/admin/groep/a-system", [], []),
    "adminlangs": ("/dashboard/admin/languages", [], ["languages-packages"]),
    "adminbackup": ("/dashboard/admin/backups", [], ["backup-now"]),
    # ── super admin ──
    "modules": (f"{SUPER}/modules", [], []), "helplayers": (f"{SUPER}/help", [], []), "supermenu": (SUPER, [], ["super-system"]),
    "plugins": (PLUGINS, ["installed"], []), "pluginupload": (PLUGINS, ["upload"], []), "pluginset": (PLUGINS, ["installed"], []),
    "pluginpages": (PLUGINS, ["installed"], []), "pluginlang": (PLUGINS, ["installed"], []),
    "themes": (SUPER, [], ["super-themes"]), "themeswitch": (SUPER, [], ["super-themes"]),
    "backup": (SUPER, [], ["super-backup"]), "superlicense": (SUPER, [], ["super-license"]), "superstandard": (SUPER, [], ["super-presets"]),
    "superbackup": ("/dashboard/admin/backups", [], ["backup-limits"]),
}


def go_of(item_id):
    g = GO.get(item_id)
    return {"href": g[0], "tab": g[1], "open": g[2]} if g else None
