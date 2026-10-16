"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { canAdmin } from "../lib/perms";
import { useModules } from "./Modules";
import { IconUser, IconLogout, IconHome, IconShield, IconHistory } from "./Icons";

export default function UserMenu({ user, onLogout, showDashboard = true }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(null);
  const pathname = usePathname();
  const mods = useModules();
  const ref = useRef(null);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const initials = (user.first_name?.[0] || user.email[0]).toUpperCase();

  useEffect(() => {
    const close = (e) => (e.type === "keydown" ? e.key === "Escape" && setOpen(false) : !ref.current?.contains(e.target) && setOpen(false));
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-trigger" onClick={() => {
        // last visited back-office page (saved by the dashboard shell)
        try { setLast(localStorage.getItem("lastBackendUrl")); } catch {}
        setOpen(!open);
      }} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials}</span>
        <span className="who">{name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          {showDashboard && (
            <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)}><IconHome /> Dashboard</Link>
          )}
          {last && last !== pathname && (
            <Link href={last} role="menuitem" onClick={() => setOpen(false)}><IconHistory /> Laatste pagina</Link>
          )}
          {user.is_staff && !pathname.startsWith("/dashboard/superadmin") && (
            <Link href="/dashboard/superadmin" role="menuitem" onClick={() => setOpen(false)}><IconShield /> Super admin</Link>
          )}
          {canAdmin(user, mods) && !pathname.startsWith("/dashboard/admin") && (
            <Link href="/dashboard/admin" role="menuitem" onClick={() => setOpen(false)}><IconShield /> Admin</Link>
          )}
          <Link href="/dashboard/profile" role="menuitem" onClick={() => setOpen(false)}><IconUser /> Wijzig profiel</Link>
          <button role="menuitem" onClick={onLogout} className="danger"><IconLogout /> Uitloggen</button>
        </div>
      )}
    </div>
  );
}
