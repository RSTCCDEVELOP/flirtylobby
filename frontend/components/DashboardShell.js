"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { IconHome, IconUsers, IconUser, IconMenu, IconShield, IconBack, IconPalette } from "./Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <IconHome /> },
  { href: "/dashboard/profile", label: "Mijn profiel", icon: <IconUser /> },
  { href: "/dashboard/admin", label: "Admin", icon: <IconShield />, staff: true, section: "Beheer" },
];

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Overzicht", icon: <IconHome /> },
  { href: "/dashboard/admin/users", label: "Gebruikers", icon: <IconUsers /> },
  { href: "/dashboard/admin/members", label: "Members", icon: <IconUser /> },
  { href: "/dashboard/admin/theme", label: "Vormgeving", icon: <IconPalette /> },
];

export default function DashboardShell({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar") === "collapsed"); } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebar", next ? "collapsed" : "open"); } catch {}
  }

  const inAdmin = pathname.startsWith("/dashboard/admin");
  const NavLink = ({ n, exact }) => (
    <Link href={n.href} title={n.label} className={(exact ? pathname === n.href : pathname.startsWith(n.href)) ? "active" : ""} onClick={() => setOpen(false)}>
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
          <Image src="/logo-rstcc.png" alt="RST Coaching & Consultancy" width={316} height={346} priority />
        </Link>
        <nav className="topnav">
          <Link href="/" target="_blank">Website</Link>
        </nav>
        <div className="topbar-user">
          <ThemeToggle />
          <UserMenu user={user} onLogout={logout} showDashboard={false} />
        </div>
      </header>

      <aside className={`sidebar ${open ? "open" : ""}`}>
        {inAdmin ? (
          <>
            <Link href="/dashboard" className="back" title="Terug naar dashboard" onClick={() => setOpen(false)}><IconBack /> <span className="label">Terug naar dashboard</span></Link>
            <div className="side-title">Admin</div>
            {ADMIN_NAV.map((n) => <NavLink key={n.href} n={n} exact={n.href === "/dashboard/admin"} />)}
          </>
        ) : (
          NAV.filter((n) => !n.staff || user.is_staff).map((n) => (
            <div key={n.href} className={n.section ? "side-bottom" : undefined}>
              {n.section && <div className="side-title">{n.section}</div>}
              <NavLink n={n} exact={n.href === "/dashboard"} />
            </div>
          ))
        )}
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
