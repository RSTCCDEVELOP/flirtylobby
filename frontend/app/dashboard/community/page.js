"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useModules } from "../../../components/Modules";
import { api } from "../../../lib/api";

// Community dashboard: everything about your profile, messages, chat and blocked people
export default function Community() {
  const mods = useModules();
  const [s, setS] = useState(null);
  useEffect(() => { api("/community/summary/").then(setS).catch(() => {}); }, []);
  const on = (m) => mods[m] !== false;
  return (
    <>
      <h1>Community</h1>
      <p className="muted">Je eigen pagina, berichten en chat met andere leden, en wie je geblokkeerd hebt.</p>
      <div className="cards" style={{ marginTop: "1.25rem" }}>
        {on("profiles") && (
          <Link href="/dashboard/community/profile" className="card stat link-card">
            <span>Mijn profielpagina</span>
            <strong style={{ fontSize: "1.25rem" }}>{s?.profile.enabled ? "Actief" : "Nog niet actief"}</strong>
            <small>{s ? `${s.profile.photos} foto's · zichtbaar voor ${{ public: "iedereen", members: "alle leden", selected: "geselecteerde leden" }[s.profile.visibility] || "niemand (nog niet ingesteld)"}` : "…"}</small>
          </Link>
        )}
        {on("discover") && (
          <Link href="/dashboard/community/discover" className="card stat link-card">
            <span>Zoeken & matchen</span>
            <strong>{s?.discover ? s.discover.matches : "…"}</strong>
            <small>{s?.discover ? `matches · ${s.discover.likes_new} nieuwe likes · ${s.discover.favorites} favorieten` : "Vind andere leden"}</small>
          </Link>
        )}
        {on("messages") && (
          <Link href="/dashboard/community/messages" className="card stat link-card">
            <span>Berichten</span>
            <strong>{s ? s.unread_messages : "…"}</strong>
            <small>ongelezen</small>
          </Link>
        )}
        {on("chat") && (
          <Link href="/dashboard/community/chat" className="card stat link-card">
            <span>Chat</span>
            <strong>{s ? s.unread_chat : "…"}</strong>
            <small>ongelezen chatberichten</small>
          </Link>
        )}
        {on("profiles") && (
          <Link href="/dashboard/community/blocked" className="card stat link-card">
            <span>Geblokkeerd</span>
            <strong>{s ? s.blocked : "…"}</strong>
            <small>users die je niet meer kunnen zien of vinden</small>
          </Link>
        )}
        {on("profiles") && (
          <Link href="/leden" className="card stat link-card">
            <span>Ledenlijst</span>
            <strong style={{ fontSize: "1.25rem" }}>Leden zoeken</strong>
            <small>Bekijk profielen waar je bij mag</small>
          </Link>
        )}
      </div>
    </>
  );
}
