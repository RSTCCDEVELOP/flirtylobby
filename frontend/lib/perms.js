// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Access helpers. Levels per module: 0 geen, 1 gebruik, 2 bewerken, 3 beheer (superadmin = 3 everywhere).
// Module access is given by roles (backend/apps/accounts/perms.py) and by grants (Admin -> Modules -> poppetje).
export const lvl = (user, module) => (!user ? 0 : user.is_staff ? 3 : user.module_levels?.[module] || 0);
export const can = (user, perm) => !!user && (user.is_staff || (user.permissions || []).includes(perm));

// Admin pages: module whose access level decides, or superadmin-only
export const ADMIN_PAGES = [
  { href: "/dashboard/admin/users", module: "users" },
  { href: "/dashboard/admin/groups", module: "users" },
  { href: "/dashboard/admin/roles", module: "roles" },
  { href: "/dashboard/admin/languages", module: "languages" },
  { href: "/dashboard/admin/integrations", module: "integrations" },
  { href: "/dashboard/admin/communication", module: "communication" },
  { href: "/dashboard/admin/branding", module: "branding" },
  { href: "/dashboard/admin/media", module: "media" },
  { href: "/dashboard/admin/security", modules: ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"] },
  { href: "/dashboard/admin/community", modules: ["profiles", "discover", "messages", "chat", "directconnect"] },
  { href: "/dashboard/admin/seo", module: "seo" },
  { href: "/dashboard/admin/sandbox", module: "sandbox" },
  { href: "/dashboard/admin/installaties", module: "system", always: true },
  { href: "/dashboard/admin/pages", module: "pages" },
  { href: "/dashboard/admin/siteimport", module: "siteimport" },
  { href: "/dashboard/admin/sysobjects", module: "sysobjects" },
  { href: "/dashboard/admin/subscriptions", module: "subscriptions" },
  { href: "/dashboard/admin/donations", module: "donations" },
  { href: "/dashboard/admin/faq", module: "faq" },
  { href: "/dashboard/admin/notifications", module: "notifications" },
  { href: "/dashboard/admin/helptips", module: "pages" },
  { href: "/dashboard/admin/actions", modules: ["subscriptions", "donations"] },
  { href: "/dashboard/admin/system", module: "system" },
  { href: "/dashboard/admin/storage", module: "storage" },
  { href: "/dashboard/admin/backups", module: "backups" },
  { href: "/dashboard/admin/statistieken", module: "stats" },
  { href: "/dashboard/admin/license", module: "system" },
  { href: "/dashboard/admin/theme", modules: ["theme", "branding"] },
  { href: "/dashboard/admin/themes", modules: ["theme", "branding"] },
  { href: "/dashboard/admin/plugins", module: "plugins" },
];

export const pageAllowed = (user, page, mods = {}) => {
  if (page.superadmin) return !!user?.is_staff;
  if (page.always) return !!user?.is_staff || lvl(user, "system") >= 1;  // not tied to a module that an installation can switch off (the page that sets the installations)
  const keys = page.modules || [page.module];
  return keys.some((m) => mods[m] !== false && lvl(user, m) >= 1);
};

export const canAdmin = (user, mods = {}) => ADMIN_PAGES.some((p) => pageAllowed(user, p, mods));

export const canOpen = (user, pathname, mods = {}) => {
  const page = ADMIN_PAGES.find((p) => pathname === p.href || pathname.startsWith(p.href + "/"));
  return page ? pageAllowed(user, page, mods) : canAdmin(user, mods);
};
