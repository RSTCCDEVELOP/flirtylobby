// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";

// The demo users with their password, under the login form (only in demo mode, when the superadmin wants them shown). Every verification code is filled in by the screen; nothing is sent.
export default function DemoLogins({ onPick }) {
  const [users, setUsers] = useState([]);
  useEffect(() => { api("/sandbox/status/").then((s) => setUsers(s?.demo?.enabled && !s.demo.restoring ? s.demo.users || [] : [])).catch(() => {}); }, []);
  if (!users.length) return null;
  return (
    <section className="card login-card" aria-label={tx("Demo gebruikers")} style={{ marginTop: "1rem", background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 14%, var(--card, #fff))", display: "grid", gap: ".6rem" }}>
      <strong>{tx("Demo om te testen")}</strong>
      <small className="muted">{tx("Log in met een van deze gebruikers. Codes worden voor je ingevuld; er wordt geen e-mail of sms verstuurd.")}</small>
      <div style={{ display: "grid", gap: ".5rem" }}>
        {users.map((u) => (
          <div key={u.email} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: ".6rem", alignItems: "center", padding: ".55rem .7rem", borderRadius: 10, background: "color-mix(in srgb, var(--eco-green, #2f7d5b) 8%, transparent)" }}>
            <span style={{ display: "grid", lineHeight: 1.3, minWidth: 0 }}>
              <strong>{u.note || u.name || u.email}</strong>
              <small style={{ overflowWrap: "anywhere" }}>{u.email} · <code>{u.password}</code></small>
            </span>
            <button type="button" className="btn sm" onClick={() => onPick(u.email, u.password)}>{tx("Invullen")}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
