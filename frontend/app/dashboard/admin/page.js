"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function AdminHome() {
  const [users, setUsers] = useState(null);
  const [members, setMembers] = useState(null);

  useEffect(() => {
    api("/users/").then(setUsers).catch(() => {});
    api("/members/").then(setMembers).catch(() => {});
  }, []);

  return (
    <>
      <h1>Admin</h1>
      <p className="muted">Beheer alle onderdelen van de website.</p>
      <div className="cards">
        <Link href="/dashboard/admin/users" className="card stat link-card">
          <span>Gebruikers</span>
          <strong>{users ? users.length : "…"}</strong>
          <small>{users ? `${users.filter((u) => !u.is_active).length} geblokkeerd` : ""}</small>
        </Link>
        <Link href="/dashboard/admin/members" className="card stat link-card">
          <span>Members</span>
          <strong>{members ? members.length : "…"}</strong>
          <small>Coaches en teamleden</small>
        </Link>
        <Link href="/dashboard/admin/theme" className="card stat link-card">
          <span>Vormgeving</span>
          <strong style={{ fontSize: "1.25rem" }}>Kleuren & lettertypen</strong>
          <small>Stijl van de hele website</small>
        </Link>
      </div>
    </>
  );
}
