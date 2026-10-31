// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net


// Which chapter of the manual (English, HTML) belongs to which page of the dashboard: the help icon opens that chapter.
const PLUGIN = { webshop: 7, orders: 7, finance: 7, subscriptions: 7, community: 8, "profile-themes": 8, marketplace: 8, agenda: 8, documents: 8, games: 8, "age-gates": 6, seo: 9, faq: 9, statistics: 9, siteimport: 4 };
const PAGES = [
  ["/dashboard/admin/siteimport", 4], ["/dashboard/admin/ai", 10], ["/dashboard/superadmin/ai", 10],
  ["/dashboard/admin/pages", 3], ["/dashboard/admin/sysobjects", 3], ["/dashboard/admin/helptips", 3],
  ["/dashboard/admin/media", 5], ["/dashboard/admin/theme", 5], ["/dashboard/admin/themes", 5], ["/dashboard/admin/branding", 5], ["/dashboard/admin/languages", 5],
  ["/dashboard/admin/users", 6], ["/dashboard/admin/groups", 6], ["/dashboard/admin/roles", 6], ["/dashboard/admin/security", 6], ["/dashboard/admin/notifications", 6],
  ["/dashboard/admin/subscriptions", 7], ["/dashboard/admin/donations", 7], ["/dashboard/admin/actions", 7],
  ["/dashboard/admin/community", 8],
  ["/dashboard/admin/seo", 9], ["/dashboard/admin/faq", 9], ["/dashboard/admin/statistieken", 9],
  ["/dashboard/admin/integrations", 10], ["/dashboard/admin/plugins", 11], ["/dashboard/admin/backups", 11], ["/dashboard/admin/license", 11], ["/dashboard/admin/system", 2], ["/dashboard/admin/storage", 11],
  ["/dashboard/admin/installaties", 1], ["/dashboard/superadmin/modules", 2], ["/dashboard/superadmin/prijzen", 11], ["/dashboard/superadmin/wizard", 2],
];

import { getLanguage } from "./t";

// the manual exists in English and Dutch: the one of the language that is chosen on the website (Dutch for Dutch, English for every other language)
export const manualLang = () => (getLanguage() === "nl" ? "nl" : "en");

// the page of the manual (relative to /api/manual/html/) for this address of the dashboard; "" = no help icon here
export function manualPage(pathname = "") {
  if (!pathname.startsWith("/dashboard/admin") && !pathname.startsWith("/dashboard/superadmin")) return "";
  const m = pathname.match(/^\/dashboard\/admin\/plugin\/([^/?#]+)/);
  if (m) return `chapter-${PLUGIN[m[1]] || 11}.html`;
  const hit = PAGES.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? `chapter-${hit[1]}.html` : pathname.startsWith("/dashboard/superadmin") ? "chapter-2.html" : "index.html";
}
