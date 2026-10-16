"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { Logo } from "./BrandingContext";
import UserMenu from "./UserMenu";
import { ChatButton, DirectIndicator, useChat } from "./Chat";
import { ADMIN_PAGES, canAdmin, pageAllowed } from "../lib/perms";
import { useModules } from "./Modules";
import { useUi } from "./Ui";
import { api } from "../lib/api";
import { IconHome, IconUsers, IconUser, IconMenu, IconShield, IconBack, IconPalette, IconGlobe, IconKey, IconImage, IconLock, IconFolder, IconGrid, IconGroup, IconMail, IconSearch, IconFlask, IconBag, IconReceipt, IconChat } from "./Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <IconHome /> },
  { href: "/dashboard/profile", label: "Mijn profiel", icon: <IconUser /> },
];

// Bottom group of the main menu
const ADMIN_LINKS = [
  { href: "/dashboard/admin", label: "Admin", icon: <IconShield /> },
  { href: "/dashboard/superadmin", label: "Super admin", icon: <IconGrid /> },
];

// Everybody's own community area (module-dependent)
const COMMUNITY = [
  { href: "/dashboard/community", label: "Community", icon: <IconChat />, module: "any" },
  { href: "/dashboard/community/profile", label: "Mijn profielpagina", icon: <IconUser />, module: "profiles" },
  { href: "/dashboard/community/discover", label: "Zoeken & matchen", icon: <IconSearch />, module: "discover", badge: "discover_new" },
  { href: "/dashboard/community/messages", label: "Berichten", icon: <IconMail />, module: "messages", badge: "unread_messages" },
  { href: "/dashboard/community/chat", label: "Chat", icon: <IconChat />, module: "chat", badge: "unread_chat" },
  { href: "/dashboard/community/direct", label: "Directe verbinding", icon: <IconChat />, module: "chat", needs: "webrtc", badge: "direct_active" },
  { href: "/dashboard/community/requests", label: "Vrienden & verzoeken", icon: <IconUsers />, module: "profiles", badge: "requests" },
  { href: "/dashboard/community/blocked", label: "Geblokkeerd", icon: <IconLock />, module: "profiles" },
];

const SUPER_NAV = [
  { href: "/dashboard/superadmin", label: "Overzicht", icon: <IconHome /> },
  { href: "/dashboard/superadmin/modules", label: "Modules", icon: <IconGrid /> },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Overzicht", icon: <IconHome /> },
  { href: "/dashboard/admin/users", label: "Users", icon: <IconUsers />, perm: "users.manage" },
  { href: "/dashboard/admin/groups", label: "User groups", icon: <IconGroup /> },
  { href: "/dashboard/admin/roles", label: "Rollen", icon: <IconShield />, perm: "roles.manage" },
  { href: "/dashboard/admin/languages", label: "Talen", icon: <IconGlobe />, perm: "languages.manage" },
  { href: "/dashboard/admin/pages", label: "Pagina's", icon: <IconFolder /> },
  { href: "/dashboard/admin/communication", label: "Communicatie", icon: <IconMail /> },
  { href: "/dashboard/admin/integrations", label: "API keys", icon: <IconKey />, perm: "integrations.manage" },
  { href: "/dashboard/admin/products", label: "Producten", icon: <IconBag /> },
  { href: "/dashboard/admin/orders", label: "Orders", icon: <IconReceipt /> },
  { href: "/dashboard/admin/media", label: "Media", icon: <IconFolder />, perm: "media.manage" },
  { href: "/dashboard/admin/branding", label: "Logo's & beeld", icon: <IconImage />, perm: "branding.manage" },
  { href: "/dashboard/admin/security", label: "Beveiliging", icon: <IconLock />, perm: "security.manage" },
  { href: "/dashboard/admin/community", label: "Community", icon: <IconChat /> },
  { href: "/dashboard/admin/seo", label: "SEO", icon: <IconSearch /> },
  { href: "/dashboard/admin/sandbox", label: "Sandbox", icon: <IconFlask /> },
  { href: "/dashboard/admin/theme", label: "Vormgeving", icon: <IconPalette />, perm: "theme.manage" },
];

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
  const communityLinks = COMMUNITY.filter((n) => (n.module === "any" ? communityOn : mods[n.module] !== false) && (!n.needs || chat?.cfg?.method === n.needs));
  const inSuper = pathname.startsWith("/dashboard/superadmin");
  const inAdmin = pathname.startsWith("/dashboard/admin");
  const allowedAdminNav = ADMIN_NAV.filter((n) => { const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); });
  const closeMenu = () => { setOpen(false); if (auto === "after_click") setCollapsed(true); };
  const NavLink = ({ n, exact }) => (
    <Link href={n.href} title={tx(n.label)} className={(exact ? pathname === n.href : pathname.startsWith(n.href)) ? "active" : ""} onClick={closeMenu}>
      {n.icon}
      <span className="label">{tx(n.label)}</span>
      {n.badgeCount > 0 && (n.badge === "direct_active" ? <span className="nav-live" title={tx("Directe verbinding actief")}><span className="live-dot" />{n.badgeCount}</span> : <span className="cart-count" style={{ marginLeft: "auto" }}>{n.badgeCount}</span>)}
    </Link>
  );

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
          <Link href="/">{tx("Homepage")}</Link>
        </nav>
        <div className="topbar-user">
          <DirectIndicator />
          <ChatButton />
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu user={user} onLogout={logout} showDashboard={false} />
        </div>
      </header>

      <aside
        className={`sidebar ${open ? "open" : ""}`}
        onMouseLeave={() => auto === "on_leave" && window.innerWidth > 860 && setCollapsed(true)}
      >
        {inSuper ? (
          <>
            <Link href="/dashboard" className="back" title={tx("Terug naar dashboard")} onClick={closeMenu}><IconBack /> <span className="label">{tx("Terug naar dashboard")}</span></Link>
            <div className="side-title">{tx("Super admin")}</div>
            {SUPER_NAV.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/superadmin"} />)}
            <div className="side-title">{tx("Alle beheerpagina's")}</div>
            {allowedAdminNav.filter((n) => n.href !== "/dashboard/admin").map((n) => <NavLink key={n.href} n={n} />)}
          </>
        ) : inAdmin ? (
          <>
            <Link href="/dashboard" className="back" title={tx("Terug naar dashboard")} onClick={closeMenu}><IconBack /> <span className="label">{tx("Terug naar dashboard")}</span></Link>
            <div className="side-title">{tx("Admin")}</div>
            {allowedAdminNav.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/admin"} />)}
          </>
        ) : (
          <>
            {NAV.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard"} />)}
            {communityLinks.length > 0 && <div className="side-title">{tx("Community")}</div>}
            {communityLinks.map((n) => <NavLink key={n.href} n={{ ...n, badgeCount: n.badge === "direct_active" ? (chat?.directActive?.length || 0) : n.badge && summary ? (n.badge === "discover_new" ? summary.discover?.likes_new || 0 : summary[n.badge]) : 0 }} exact={n.href === "/dashboard/community"} />)}
          </>
        )}
        {(canAdmin(user, mods) || user.is_staff) && (
          <div className="side-bottom">
            <div className="side-title">{tx("Beheer")}</div>
            {canAdmin(user, mods) && <NavLink n={ADMIN_LINKS[0]} />}
            {user.is_staff && <NavLink n={ADMIN_LINKS[1]} />}
          </div>
        )}
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
