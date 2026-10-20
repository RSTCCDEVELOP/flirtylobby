"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { IconEye } from "./Icons";
import PageVisibility from "./PageVisibility";
import ProfileBlock from "./ProfileBlock";

// "Mijn profiel" -> public profile: who sees my profile page (public / members / friends / selected / off) and a preview of it.
// Hidden when the profile module is off for this user.
export default function PublicProfileBlock() {
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/profile/me/").then(setP).catch(() => {}); }, []);
  if (!p) return null;

  async function setMode(m) {
    setBusy(true); setMsg(null);
    try {
      const d = await api("/profile/me/", { method: "PUT", body: m === "off" ? { enabled: false } : { enabled: true, visibility: m } });
      setP((cur) => ({ ...cur, enabled: d.enabled, visibility: d.visibility }));
      setMsg({ ok: true, text: m === "off" ? tx("Je profielpagina staat uit.") : tx("Zichtbaarheid opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }

  return (
    <ProfileBlock id="p-public" icon={<IconEye />} title={tx("Openbaar profiel")} hint={tx("Wie ziet je profielpagina? Een wijziging geldt direct.")}>
      <PageVisibility p={p} busy={busy} onChange={setMode} onPreview={() => window.open(`/leden/${p.slug}?preview=1`, "_blank")} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div><Link className="btn" href="/dashboard/community/profile">{tx("Profielpagina bewerken")}</Link></div>
    </ProfileBlock>
  );
}
