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
import { IconInfo } from "./Icons";
import { NoteFiles, NoteText } from "./Notes";
import ProfileBlock from "./ProfileBlock";

// Mijn profiel -> Notities: the notes that the administrators made visible for me (on my account or on a company I am linked to). Only there when there are any.
export default function MyNotes() {
  const [notes, setNotes] = useState([]);
  useEffect(() => { api("/notes/mine/").then((r) => setNotes(r.notes || [])).catch(() => setNotes([])); }, []);
  if (!notes.length) return null;
  return (
    <ProfileBlock id="p-notes" icon={<IconInfo />} title={tx("Notities")} hint={tx("Berichten van de beheerders voor jou.")}>
      <div style={{ display: "grid", gap: ".9rem" }}>
        {notes.map((n) => (
          <article key={n.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", padding: ".8rem .9rem", display: "grid", gap: ".5rem", background: "var(--card)" }}>
            <div><strong>{n.title || tx("Notitie")}</strong>{n.about ? <span className="muted"> · {n.about}</span> : null}<br /><small className="muted">{new Date(n.created_at).toLocaleString()}</small></div>
            <NoteText body={n.body} />
            <NoteFiles files={n.files} />
          </article>
        ))}
      </div>
    </ProfileBlock>
  );
}
