"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconUser, IconLogout, IconHome } from "./Icons";

export default function UserMenu({ user, onLogout, showDashboard = true }) {
  const [open, setOpen] = useState(false);
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
      <button className="user-trigger" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
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
          <Link href="/dashboard/profile" role="menuitem" onClick={() => setOpen(false)}><IconUser /> Wijzig profiel</Link>
          <button role="menuitem" onClick={onLogout} className="danger"><IconLogout /> Uitloggen</button>
        </div>
      )}
    </div>
  );
}
