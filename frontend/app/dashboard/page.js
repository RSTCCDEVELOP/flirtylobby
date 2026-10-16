"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthContext";
import { api } from "../../lib/api";

export default function DashboardHome() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);

  useEffect(() => {
    if (user.is_staff) api("/users/").then(setUsers).catch(() => {});
  }, [user]);

  return (
    <>
      <h1>Welkom{user.first_name ? `, ${user.first_name}` : ""} 👋</h1>
      <p className="muted">Dit is het beheer van RST Coaching & Consultancy.</p>
      {users && (
        <div className="cards">
          <div className="card stat"><span>Gebruikers</span><strong>{users.length}</strong></div>
          <div className="card stat"><span>Actief</span><strong>{users.filter((u) => u.is_active).length}</strong></div>
          <div className="card stat"><span>Geblokkeerd</span><strong>{users.filter((u) => !u.is_active).length}</strong></div>
        </div>
      )}
    </>
  );
}
