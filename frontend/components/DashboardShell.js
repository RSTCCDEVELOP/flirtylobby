"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import FaqDrawer from "./FaqDrawer";
import { useFaqSettings } from "../lib/faq-settings";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { Logo } from "./BrandingContext";
import UserMenu from "./UserMenu";
import { ChatButton, DirectIndicator, useChat } from "./Chat";
import NotificationBell from "./NotificationBell";
import { ADMIN_PAGES, canAdmin, pageAllowed } from "../lib/perms";
import { useModules } from "./Modules";
import { menuLabel } from "./SiteMenu";
import { useUi } from "./Ui";
import { api } from "../lib/api";
import { PinButton, useAccordion } from "./Collapsible";
import { useShortcuts } from "../lib/shortcuts";
import { useNavMode } from "../lib/navmode";
import BackButton from "./BackButton";
import FindOnPage from "./FindOnPage";
import { IconEdit, IconEye, IconHome, IconUsers, IconUser, IconMenu, IconShield, IconBack, IconPalette, IconGlobe, IconKey, IconImage, IconLock, IconFolder, IconGrid, IconGroup, IconMail, IconSearch, IconFlask, IconBag, IconReceipt, IconChat, IconSettings, IconStar, IconHeart, IconHelp } from "./Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <IconHome /> },
  { href: "/dashboard/profile", label: "Mijn profiel", icon: <IconUser />, hidden: true }, // not in the left menu (it is in the user menu); the name stays for the search and the shortcut star
  { href: "/dashboard/community/mypage", label: "Mijn profielpagina", icon: <IconEye />, module: "profiles", community: true }, // the page as others see it, inside the dashboard
  { href: "/dashboard/community/profile", label: "Wijzig profiel", icon: <IconEdit />, module: "profiles", community: true }, // editing goes here
  { href: "/dashboard/subscriptions", label: "Mijn abonnementen", icon: <IconStar />, module: "subscriptions" },
  { href: "/dashboard/help", label: "Help", icon: <IconHelp />, module: "help" },
  { href: "/dashboard/faq", label: "FAQ", icon: <IconHelp />, module: "faq", faqPrivate: true },
];

// Bottom group of the main menu
const ADMIN_LINKS = [
  { href: "/dashboard/admin", label: "Admin", icon: <IconShield /> },
  { href: "/dashboard/superadmin", label: "Super admin", icon: <IconGrid /> },
];

// Everybody's own community area (module-dependent)
const COMMUNITY = [
  { href: "/dashboard/community", label: "Community", icon: <IconChat />, module: "any" },
  { href: "/dashboard/community/discover", label: "Zoeken & matchen", icon: <IconSearch />, module: "discover", badge: "discover_new" },
  { href: "/dashboard/community/messages", label: "Berichten", icon: <IconMail />, module: "messages", badge: "unread_messages" },
  { href: "/dashboard/community/chat", label: "Chat", icon: <IconChat />, module: "chat", badge: "unread_chat" },
  { href: "/dashboard/community/direct", label: "Directe verbinding", icon: <IconChat />, module: "directconnect", badge: "direct_active" },
  { href: "/dashboard/community/requests", label: "Vrienden & verzoeken", icon: <IconUsers />, module: "profiles", badge: "requests" },
  { href: "/dashboard/community/blocked", label: "Geblokkeerd", icon: <IconLock />, module: "profiles" },
];

const SUPER_NAV = [
  { href: "/dashboard/superadmin", label: "Overzicht", icon: <IconHome /> },
  { href: "/dashboard/superadmin/modules", label: "Modules", icon: <IconGrid /> },
  { href: "/dashboard/superadmin/help", label: "Help", icon: <IconHelp /> },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Overzicht", icon: <IconHome /> },
  { href: "/dashboard/admin/users", label: "Users", icon: <IconUsers />, perm: "users.manage" },
  { href: "/dashboard/admin/groups", label: "User groups", icon: <IconGroup /> },
  { href: "/dashboard/admin/roles", label: "Rollen", icon: <IconShield />, perm: "roles.manage" },
  { href: "/dashboard/admin/languages", label: "Talen", icon: <IconGlobe />, perm: "languages.manage" },
  { href: "/dashboard/admin/pages", label: "Pagina's", icon: <IconFolder /> },
  { href: "/dashboard/admin/siteimport", label: "Site importeren", icon: <IconGlobe /> },
  { href: "/dashboard/admin/sysobjects", label: "Systeemobjecten", icon: <IconGrid /> },
  { href: "/dashboard/admin/communication", label: "Communicatie", icon: <IconMail /> },
  { href: "/dashboard/admin/integrations", label: "API keys", icon: <IconKey />, perm: "integrations.manage" },
  { href: "/dashboard/admin/orders", label: "Orders", icon: <IconReceipt /> },
  { href: "/dashboard/admin/subscriptions", label: "Abonnementen", icon: <IconStar /> },
  { href: "/dashboard/admin/donations", label: "Donaties", icon: <IconHeart /> },
  { href: "/dashboard/admin/faq", label: "FAQ", icon: <IconHelp /> },
  { href: "/dashboard/admin/help", label: "Help", icon: <IconHelp />, helpLayer: true },
  { href: "/dashboard/admin/helptips", label: "Help-teksten", icon: <IconEdit /> },
  { href: "/dashboard/admin/actions", label: "Actions", icon: <IconLock /> },
  { href: "/dashboard/admin/media", label: "Media", icon: <IconFolder />, perm: "media.manage" },
  { href: "/dashboard/admin/security", label: "Beveiliging", icon: <IconLock />, perm: "security.manage" },
  { href: "/dashboard/admin/community", label: "Community", icon: <IconChat /> },
  { href: "/dashboard/admin/seo", label: "SEO", icon: <IconSearch /> },
  { href: "/dashboard/admin/system", label: "Basisgegevens", icon: <IconSettings />, perm: "system.manage" },
  { href: "/dashboard/admin/storage", label: "Mappenstructuur", icon: <IconFolder />, perm: "storage.manage" },
  { href: "/dashboard/admin/sandbox", label: "Sandbox", icon: <IconFlask /> },
  { href: "/dashboard/admin/plugins", label: "Plugins", icon: <IconGrid /> },
  { href: "/dashboard/admin/theme", label: "Thema", icon: <IconPalette />, perm: "theme.manage" },
];

// Menu groups (collapsible). Items are assigned by href; items without a group stay at the top.
const COMMUNITY_GROUPS = [{ id: "c-mine", title: "Mijn community" }, { id: "c-contact", title: "Contact" }];
const COMMUNITY_GROUP_OF = {
  "/dashboard/community": "c-mine", "/dashboard/community/requests": "c-mine", "/dashboard/community/blocked": "c-mine",
  "/dashboard/community/discover": "c-contact", "/dashboard/community/messages": "c-contact", "/dashboard/community/chat": "c-contact", "/dashboard/community/direct": "c-contact",
};
const ADMIN_SECTION_GROUP = { users: "a-people", website: "a-site", community: "a-community", shop: "a-shop", subscription: "a-subs", system: "a-system" };
const ADMIN_GROUPS = [
  { id: "a-people", title: "Gebruikers" }, { id: "a-site", title: "Website" }, { id: "a-community", title: "Community" },
  { id: "a-shop", title: "Webshop" }, { id: "a-subs", title: "Subscription" }, { id: "a-system", title: "Systeem" },
];
const ADMIN_GROUP_OF = {
  "/dashboard/admin/users": "a-people", "/dashboard/admin/groups": "a-people", "/dashboard/admin/roles": "a-people",
  "/dashboard/admin/pages": "a-site", "/dashboard/admin/siteimport": "a-site", "/dashboard/admin/sysobjects": "a-site", "/dashboard/admin/languages": "a-site", "/dashboard/admin/theme": "a-site", "/dashboard/admin/themes": "a-site", "/dashboard/admin/branding": "a-site", "/dashboard/admin/media": "a-site", "/dashboard/admin/seo": "a-site",
  "/dashboard/admin/community": "a-community",
  "/dashboard/admin/orders": "a-shop", "/dashboard/admin/faq": "a-site", "/dashboard/admin/help": "a-site", "/dashboard/admin/helptips": "a-site",
  "/dashboard/admin/subscriptions": "a-subs", "/dashboard/admin/donations": "a-subs", "/dashboard/admin/actions": "a-subs",
  "/dashboard/admin/security": "a-system", "/dashboard/admin/communication": "a-system", "/dashboard/admin/integrations": "a-system", "/dashboard/admin/sandbox": "a-system", "/dashboard/admin/plugins": "a-system", "/dashboard/admin/storage": "a-system", "/dashboard/admin/system": "a-system",
};

export { ADMIN_NAV, ADMIN_GROUPS, ADMIN_GROUP_OF, ADMIN_SECTION_GROUP, COMMUNITY, COMMUNITY_GROUPS, COMMUNITY_GROUP_OF };
const GROUP_ICON = { "a-people": <IconUsers />, "a-site": <IconGlobe />, "a-community": <IconChat />, "a-shop": <IconBag />, "a-subs": <IconStar />, "a-system": <IconSettings />, "c-mine": <IconUser />, "c-contact": <IconMail /> };

// Switch of the left menu: work with the menu (groups with their pages) or with tiles (one tile page per group)
function NavModeSwitch({ mode, set }) {
  const other = mode === "menu" ? "tiles" : "menu";
  return (
    <div className="navmode" role="group" aria-label={tx("Werken met")}>
      <button type="button" className="navmode-one" title={mode === "menu" ? tx("Wissel naar tegels") : tx("Wissel naar menu")} onClick={() => set(other)}>{mode === "menu" ? <IconGrid /> : <IconMenu />}</button>
      <button type="button" className={mode === "menu" ? "on" : ""} aria-pressed={mode === "menu"} title={tx("Menu")} onClick={() => set("menu")}><IconMenu /><span className="label">{tx("Menu")}</span></button>
      <button type="button" className={mode === "tiles" ? "on" : ""} aria-pressed={mode === "tiles"} title={tx("Tegels")} onClick={() => set("tiles")}><IconGrid /><span className="label">{tx("Tegels")}</span></button>
    </div>
  );
}

// A collapsible group of menu items. Open state is remembered; the group with the current page opens by itself.
// In the icon-only (collapsed) sidebar all items stay visible as icons.
function NavGroup({ id, title, active, badge, children, defaultOpen = false }) {
  // like the blocks on a page: opening a group closes the others, unless they are pinned (pin: green = stays open, red = closes)
  const { open, toggle, pinned, togglePin, openNow } = useAccordion(id, defaultOpen, "nav");
  useEffect(() => { if (active) openNow(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`nav-group ${open ? "open" : ""} ${active ? "has-active" : ""}`}>
      <div className="nav-group-row">
        <button type="button" className="nav-group-head" aria-expanded={open} onClick={toggle}>
          <span className="label">{tx(title)}</span>
          {!open && badge > 0 && <span className="cart-count">{badge}</span>}
          <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <PinButton pinned={pinned} onClick={togglePin} />
      </div>
      <div className="nav-group-body">{children}</div>
    </div>
  );
}

// Name of the page the user is on (from the menus), for a shortcut tile
const pageTitle = (path) => [...NAV, ...COMMUNITY, ...ADMIN_NAV, ...SUPER_NAV].filter((n) => path === n.href).map((n) => n.label)[0]
  || [...NAV, ...COMMUNITY, ...ADMIN_NAV, ...SUPER_NAV].filter((n) => n.href !== "/dashboard" && path.startsWith(n.href + "/")).sort((a, b) => b.href.length - a.href.length).map((n) => n.label)[0] || "";

// Star in the header: make this page a shortcut tile on the dashboard (or take it away again)
function ShortcutStar({ title, pathname }) {
  const sc = useShortcuts();
  if (!title || pathname === "/dashboard") return null;
  const on = sc.has(pathname);
  const label = on ? tx("Snelkoppeling op het dashboard verwijderen") : tx("Snelkoppeling op het dashboard maken");
  return (
    <button type="button" className={`icon-btn shortcut-star ${on ? "on" : ""}`} onClick={() => sc.toggle(pathname, title)} aria-pressed={on} aria-label={label} title={label}>
      <IconStar />
    </button>
  );
}

export default function DashboardShell({ children }) {
  const { user, logout } = useAuth();
  const chat = useChat();
  const mods = useModules();
  const { sidebar_auto: auto } = useUi();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [summary, setSummary] = useState(null); // default: collapsed, until the user opens it once

  // remember where the user was, for "Laatste pagina" in the user menu
  useEffect(() => {
    try { localStorage.setItem("lastBackendUrl", pathname); } catch {}
  }, [pathname]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar") !== "open"); } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebar", next ? "collapsed" : "open"); } catch {}
  }

  const communityOn = ["profiles", "discover", "messages", "chat"].some((m) => mods[m] !== false);
  useEffect(() => {
    if (!communityOn) return;
    const load = () => api("/community/summary/").then(setSummary).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [communityOn, pathname]);
  // plugins with a page of their own (switched on, and for this user)
  const [pluginMenu, setPluginMenu] = useState([]);
  const [privMenu, setPrivMenu] = useState([]); // the private pages (Admin -> Pagina's, tab Privé): a menu in the header of the dashboard
  useEffect(() => {
    const load = () => api("/pages/private-menu/").then((d) => setPrivMenu(d.items || [])).catch(() => setPrivMenu([]));
    if (user) load(); else setPrivMenu([]);
    window.addEventListener("pages-changed", load);
    return () => window.removeEventListener("pages-changed", load);
  }, [user]);
  useEffect(() => {
    if (mods.plugins === false || !user) return setPluginMenu([]);
    const load = () => api("/plugins/menu/").then(setPluginMenu).catch(() => setPluginMenu([]));
    load();
    window.addEventListener("plugins-changed", load);
    return () => window.removeEventListener("plugins-changed", load);
  }, [mods.plugins, user]);
  // admin menu: every plugin that is on gets an admin page of its own (superadmins)
  const [pluginAdmin, setPluginAdmin] = useState([]);
  useEffect(() => {
    if (mods.plugins === false || !user?.is_staff) return setPluginAdmin([]);
    const load = () => api("/plugins/menu/?scope=admin").then(setPluginAdmin).catch(() => setPluginAdmin([]));
    load();
    window.addEventListener("plugins-changed", load);
    return () => window.removeEventListener("plugins-changed", load);
  }, [mods.plugins, user]);
  // a plugin belongs to a section (plugin.json): its page sits in that part of the menu, its admin page in that part of the admin menu
  const pluginUser = pluginMenu.map((x) => ({ href: x.path ? `/dashboard/${x.path}` : `/dashboard/plugins/${x.name}`, label: x.label, icon: <IconGrid />, section: x.section, group: x.group }));
  const pluginUserGroup = Object.fromEntries(pluginUser.filter((n) => n.group === "mine" || n.group === "contact").map((n) => [n.href, n.group === "mine" ? "c-mine" : "c-contact"]));
  const pluginAdminItems = pluginAdmin.map((x) => ({ href: `/dashboard/admin/plugins/${x.name}`, label: x.label, icon: <IconGrid />, section: x.section }));
  const pluginAdminGroup = Object.fromEntries(pluginAdminItems.map((n) => [n.href, ADMIN_SECTION_GROUP[n.section] || "a-system"]));
  const communityLinks = COMMUNITY.filter((n) => (n.module === "any" ? communityOn : mods[n.module] !== false));
  const inSuper = pathname.startsWith("/dashboard/superadmin");
  const inAdmin = pathname.startsWith("/dashboard/admin");
  const faqSet = useFaqSettings(); // Admin → FAQ → Instellingen: is the Help link shown in the left menus
  const allowedAdminNav = ADMIN_NAV.filter((n) => { if (n.helpLayer) return mods.help !== false && faqSet.nav_link; const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); });
  const closeMenu = () => { setOpen(false); if (auto === "after_click") setCollapsed(true); };
  const NavLink = ({ n, exact }) => (
    <Link href={n.href} title={tx(n.label)} className={(exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/")) ? "active" : ""} onClick={closeMenu}>
      {n.icon}
      <span className="label">{n.badge === "direct_active" && n.badgeCount > 0 ? (chat?.directActive || []).map((x) => x.name).join(", ") : tx(n.label)}</span>
      {n.badgeCount > 0 && (n.badge === "direct_active" ? <span className="nav-live" title={tx("Directe verbinding actief")}><span className="live-dot" />{n.badgeCount}</span> : <span className="cart-count" style={{ marginLeft: "auto" }}>{n.badgeCount}</span>)}
    </Link>
  );

  const withBadge = (n) => ({ ...n, badgeCount: n.badge === "direct_active" ? (chat?.directActive?.length || 0) : n.badge && summary ? (n.badge === "discover_new" ? summary.discover?.likes_new || 0 : summary[n.badge]) || 0 : 0 });
  const isActive = (n) => (n.href === "/dashboard/community" || n.href === "/dashboard/admin" ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"));
  const [navMode, setNavMode] = useNavMode();
  // where "back" goes when there is no earlier page: the main menu of this area (tiles mode: the tile page of the group)
  const backFallback = (() => {
    if (pathname.startsWith("/dashboard/admin/groep/") || pathname === "/dashboard/admin") return "/dashboard";
    if (pathname.startsWith("/dashboard/groep/")) return "/dashboard";
    if (pathname.startsWith("/dashboard/superadmin/")) return "/dashboard/superadmin";
    if (pathname === "/dashboard/superadmin") return "/dashboard";
    if (pathname.startsWith("/dashboard/admin/")) {
      const base = "/" + pathname.split("/").slice(0, 5).join("/").replace(/^\//, "");
      const g = { ...ADMIN_GROUP_OF, ...pluginAdminGroup }[pathname.split("/").slice(0, 4).join("/")] || pluginAdminGroup[base];
      return navMode === "tiles" && g ? `/dashboard/admin/groep/${g}` : "/dashboard/admin";
    }
    const cg = { ...COMMUNITY_GROUP_OF, ...pluginUserGroup }[pathname];
    return navMode === "tiles" && cg ? `/dashboard/groep/${cg}` : "/dashboard";
  })();
  const renderGroups = (items, groups, groupOf) => groups.map((g) => {
    const list = items.filter((n) => groupOf[n.href] === g.id);
    if (!list.length) return null;
    if (navMode === "tiles") {  // one item per group: it opens the page with the tiles of that group
      const href = g.id.startsWith("a-") ? `/dashboard/admin/groep/${g.id}` : `/dashboard/groep/${g.id}`;
      return <NavLink key={g.id} n={{ href, label: g.title, icon: GROUP_ICON[g.id] || <IconGrid />, badgeCount: list.reduce((a, n) => a + (n.badgeCount || 0), 0), badge: "sum" }} />;
    }
    return (
      <NavGroup key={g.id} id={g.id} title={g.title} active={list.some(isActive)} badge={list.reduce((a, n) => a + (n.badgeCount || 0), 0)}>
        {list.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/community" || n.href === "/dashboard/admin"} />)}
      </NavGroup>
    );
  });

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <header className="topbar">
        <button className="icon-btn menu-toggle" onClick={() => setOpen(!open)} aria-label={tx("Menu")}>
          <IconMenu />
        </button>
        <button className="icon-btn collapse-toggle" onClick={toggleCollapsed} aria-label={collapsed ? tx("Menu uitklappen") : tx("Menu inklappen")} title={collapsed ? tx("Menu uitklappen") : tx("Menu inklappen")}>
          <IconMenu />
        </button>
        <Link href="/dashboard" className="brand">
          <Logo />
        </Link>
        <nav className="topnav">
          {(() => {
            // the private pages (Mijn community, Mijn abonnementen, Mijn bestellingen, Mijn donaties ...) hang under "Homepage" as a drop-down
            const flat = privMenu.flatMap((it) => (it.kind === "menu" ? [{ ...it, heading: true }, ...(it.children || []).map((c) => ({ ...c, sub: true }))] : [it, ...(it.children || [])]));
            const link = (it) => {
              const label = menuLabel(it.titles);
              if (it.heading) return <span key={it.id} className="nav-group-label">{label}</span>;
              return /^https?:/.test(it.url) ? <a key={it.id} href={it.url} target={it.new_tab ? "_blank" : undefined} rel="noopener noreferrer">{label}</a> : <Link key={it.id} href={it.url} className={pathname === it.url || pathname.startsWith(it.url + "/") ? "active" : ""}>{label}</Link>;
            };
            if (!flat.length) return <Link href="/">{tx("Homepage")}</Link>;
            return (
              <span className="nav-drop">
                <Link href="/">{tx("Homepage")}</Link>
                <span className="nav-drop-menu">{flat.map(link)}</span>
              </span>
            );
          })()}
        </nav>
        <div className="topbar-user">
          <ShortcutStar title={pageTitle(pathname)} pathname={pathname} />
          <DirectIndicator />
          <NotificationBell />
          <ChatButton />
          <LanguageSwitcher />
          <FaqDrawer dashboard />
          <ThemeToggle />
          <UserMenu user={user} onLogout={logout} showDashboard={false} />
        </div>
      </header>

      <aside
        className={`sidebar ${open ? "open" : ""}`}
        onMouseLeave={() => auto === "on_leave" && window.innerWidth > 860 && setCollapsed(true)}
      >
        <NavModeSwitch mode={navMode} set={setNavMode} />
        {inSuper ? (
          <>
            <Link href="/dashboard" className="back" title={tx("Terug naar dashboard")} onClick={closeMenu}><IconBack /> <span className="label">{tx("Terug naar dashboard")}</span></Link>
            <div className="side-title">{tx("Super admin")}</div>
            {SUPER_NAV.filter((n) => !n.href.endsWith("/help") || faqSet.nav_link).map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/superadmin"} />)}
            <div className="side-title">{tx("Alle beheerpagina's")}</div>
            {renderGroups(allowedAdminNav.filter((n) => n.href !== "/dashboard/admin"), ADMIN_GROUPS, ADMIN_GROUP_OF)}
          </>
        ) : inAdmin ? (
          <>
            <Link href="/dashboard" className="back" title={tx("Terug naar dashboard")} onClick={closeMenu}><IconBack /> <span className="label">{tx("Terug naar dashboard")}</span></Link>
            <div className="side-title">{tx("Admin")}</div>
            <NavLink n={allowedAdminNav[0]} exact />
            {renderGroups([...allowedAdminNav.slice(1), ...pluginAdminItems], ADMIN_GROUPS, { ...ADMIN_GROUP_OF, ...pluginAdminGroup })}
          </>
        ) : (
          <>
            {NAV.filter((n) => !n.hidden && (n.href !== "/dashboard/help" || faqSet.nav_link) && (!n.faqPrivate || (faqSet.nav_link && faqSet.page_scope === "private")) && (!n.module || mods[n.module] !== false) && (!n.community || communityOn) ).map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard"} />)}
            {renderGroups([...communityLinks.map(withBadge), ...pluginUser], COMMUNITY_GROUPS, { ...COMMUNITY_GROUP_OF, ...pluginUserGroup })}
            {pluginUser.filter((n) => !pluginUserGroup[n.href]).map((n) => <NavLink key={n.href} n={n} />)}
          </>
        )}
        {(canAdmin(user, mods) || user.is_staff) && (
          <div className="side-bottom">
            <NavGroup id="a-manage" title="Beheer" active={inAdmin || inSuper} badge={0}>
              {canAdmin(user, mods) && <NavLink n={ADMIN_LINKS[0]} />}
              {user.is_staff && <NavLink n={ADMIN_LINKS[1]} />}
            </NavGroup>
          </div>
        )}
      </aside>

      <main className="content">
        <FindOnPage />
        {pathname !== "/dashboard" && <div className="back-row"><BackButton pathname={pathname} fallback={backFallback} /></div>}
        {children}
      </main>
    </div>
  );
}
