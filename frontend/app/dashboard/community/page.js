"use client";

import { tx } from "../../../lib/t";
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
      <h1>{tx("Community")}</h1>
      <p className="muted">{tx("Je eigen pagina, berichten en chat met andere leden, en wie je geblokkeerd hebt.")}</p>
      <div className="cards" style={{ marginTop: "1.25rem" }}>
        {on("profiles") && (
          <Link href="/dashboard/community/profile" className="card stat link-card">
            <span>{tx("Mijn profielpagina")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{s?.profile.enabled ? tx("Actief") : tx("Nog niet actief")}</strong>
            <small>{s ? tx("{0} foto's · zichtbaar voor {1}", s.profile.photos, { public: tx("iedereen"), members: tx("alle leden"), selected: tx("geselecteerde leden") }[s.profile.visibility] || tx("niemand (nog niet ingesteld)")) : "…"}</small>
          </Link>
        )}
        {on("discover") && (
          <Link href="/dashboard/community/discover" className="card stat link-card">
            <span>{tx("Zoeken & matchen")}</span>
            <strong>{s?.discover ? s.discover.matches : "…"}</strong>
            <small>{s?.discover ? tx("matches · {0} nieuwe likes · {1} favorieten", s.discover.likes_new, s.discover.favorites) : tx("Vind andere leden")}</small>
          </Link>
        )}
        {on("messages") && (
          <Link href="/dashboard/community/messages" className="card stat link-card">
            <span>{tx("Berichten")}</span>
            <strong>{s ? s.unread_messages : "…"}</strong>
            <small>{tx("ongelezen")}</small>
          </Link>
        )}
        {on("chat") && (
          <Link href="/dashboard/community/chat" className="card stat link-card">
            <span>{tx("Chat")}</span>
            <strong>{s ? s.unread_chat : "…"}</strong>
            <small>{tx("ongelezen chatberichten")}</small>
          </Link>
        )}
        {on("profiles") && (
          <Link href="/dashboard/community/blocked" className="card stat link-card">
            <span>{tx("Geblokkeerd")}</span>
            <strong>{s ? s.blocked : "…"}</strong>
            <small>{tx("users die je niet meer kunnen zien of vinden")}</small>
          </Link>
        )}
        {on("profiles") && (
          <Link href="/leden" className="card stat link-card">
            <span>{tx("Ledenlijst")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{tx("Leden zoeken")}</strong>
            <small>{tx("Bekijk profielen waar je bij mag")}</small>
          </Link>
        )}
      </div>
    </>
  );
}
