"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { Logo } from "./BrandingContext";
import UserMenu from "./UserMenu";
import { ADMIN_PAGES, canAdmin, pageAllowed } from "../lib/perms";
import { useModules } from "./Modules";
import { useUi } from "./Ui";
import { IconHome, IconUsers, IconUser, IconMenu, IconShield, IconBack, IconPalette, IconGlobe, IconKey, IconImage, IconLock, IconFolder, IconGrid, IconGroup, IconMail, IconSearch, IconFlask } from "./Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <IconHome /> },
  { href: "/dashboard/profile", label: "Mijn profiel", icon: <IconUser /> },
];

// Bottom group of the main menu
const ADMIN_LINKS = [
  { href: "/dashboard/admin", label: "Admin", icon: <IconShield /> },
  { href: "/dashboard/superadmin", label: "Super admin", icon: <IconGrid /> },
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
  { href: "/dashboard/admin/communication", label: "Communicatie", icon: <IconMail /> },
  { href: "/dashboard/admin/integrations", label: "API keys", icon: <IconKey />, perm: "integrations.manage" },
  { href: "/dashboard/admin/media", label: "Media", icon: <IconFolder />, perm: "media.manage" },
  { href: "/dashboard/admin/branding", label: "Logo's & beeld", icon: <IconImage />, perm: "branding.manage" },
  { href: "/dashboard/admin/security", label: "Beveiliging", icon: <IconLock />, perm: "security.manage" },
  { href: "/dashboard/admin/seo", label: "SEO", icon: <IconSearch /> },
  { href: "/dashboard/admin/sandbox", label: "Sandbox", icon: <IconFlask /> },
  { href: "/dashboard/admin/theme", label: "Vormgeving", icon: <IconPalette />, perm: "theme.manage" },
];

export default function DashboardShell({ children }) {
  const { user, logout } = useAuth();
  const mods = useModules();
  const { sidebar_auto: auto } = useUi();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // default: collapsed, until the user opens it once

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

  const inSuper = pathname.startsWith("/dashboard/superadmin");
  const inAdmin = pathname.startsWith("/dashboard/admin");
  const allowedAdminNav = ADMIN_NAV.filter((n) => { const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); });
  const closeMenu = () => { setOpen(false); if (auto === "after_click") setCollapsed(true); };
  const NavLink = ({ n, exact }) => (
    <Link href={n.href} title={n.label} className={(exact ? pathname === n.href : pathname.startsWith(n.href)) ? "active" : ""} onClick={closeMenu}>
      {n.icon}
      <span className="label">{n.label}</span>
    </Link>
  );

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <header className="topbar">
        <button className="icon-btn menu-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          <IconMenu />
        </button>
        <button className="icon-btn collapse-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Menu uitklappen" : "Menu inklappen"} title={collapsed ? "Menu uitklappen" : "Menu inklappen"}>
          <IconMenu />
        </button>
        <Link href="/dashboard" className="brand">
          <Logo />
        </Link>
        <nav className="topnav">
          <Link href="/">Homepage</Link>
        </nav>
        <div className="topbar-user">
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
            <Link href="/dashboard" className="back" title="Terug naar dashboard" onClick={closeMenu}><IconBack /> <span className="label">Terug naar dashboard</span></Link>
            <div className="side-title">Super admin</div>
            {SUPER_NAV.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/superadmin"} />)}
            <div className="side-title">Alle beheerpagina's</div>
            {allowedAdminNav.filter((n) => n.href !== "/dashboard/admin").map((n) => <NavLink key={n.href} n={n} />)}
          </>
        ) : inAdmin ? (
          <>
            <Link href="/dashboard" className="back" title="Terug naar dashboard" onClick={closeMenu}><IconBack /> <span className="label">Terug naar dashboard</span></Link>
            <div className="side-title">Admin</div>
            {allowedAdminNav.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/admin"} />)}
          </>
        ) : (
          <>
            {NAV.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard"} />)}
            {(canAdmin(user, mods) || user.is_staff) && (
              <div className="side-bottom">
                <div className="side-title">Beheer</div>
                {canAdmin(user, mods) && <NavLink n={ADMIN_LINKS[0]} />}
                {user.is_staff && <NavLink n={ADMIN_LINKS[1]} />}
              </div>
            )}
          </>
        )}
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
