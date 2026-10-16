"use client";

import { tx } from "../../../lib/t";
import { alertDialog, confirmDialog, promptDialog } from "../../../lib/dialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChat } from "../../../components/Chat";
import ProfileLayout from "../../../components/ProfileLayouts";
import SiteHeader from "../../../components/SiteHeader";
import { useSession } from "../../../components/Session";
import { api, mediaUrl } from "../../../lib/api";

export default function ProfileView({ slug, initial }) {
  const { user, ready } = useSession();
  const chat = useChat();
  const [p, setP] = useState(initial);
  const [i, setI] = useState(0);
  const [missing, setMissing] = useState(false);
  // not visible anonymously? try again with the member's login (and the visitor's language)
  useEffect(() => {
    if (!ready) return;
    let lang = "";
    try { lang = localStorage.getItem("lang") || ""; } catch {}
    api(`/profiles/${slug}/${lang ? `?lang=${lang}` : ""}`).then((d) => { setP(d); setMissing(false); }).catch(() => { if (!initial) setMissing(true); });
  }, [slug, ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ask for friendship / photos / profile; the member accepts or declines
  const ask = async (kind) => {
    const message = (await promptDialog(tx("Wil je een bericht meesturen? (optioneel)"), ""));
    if (message === null) return;
    try {
      const r = await api("/connections/", { method: "POST", body: { user: p.id, kind, message } });
      setP({ ...p, relation: r.relation });
    } catch (e) { (await alertDialog(e.message)); }
  };
  const answer = async (action) => {
    await api(`/connections/${p.relation.incoming_friend_id}/respond/`, { method: "POST", body: { action } });
    window.location.reload();
  };
  const rel = p?.relation;
  const label = (st, text) => (st === "pending" ? tx("Verzoek verstuurd…") : st === "declined" ? tx("Geweigerd") : text);

  const block = async () => {
    if (!(await confirmDialog(tx("{0} blokkeren? Jullie kunnen elkaar dan niet meer zien, vinden, berichten of chatten.", p.name)))) return;
    await api("/blocks/", { method: "POST", body: { user: p.id } });
    window.location.href = "/leden";
  };

  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        {!p && !missing && <p className="muted">{tx("Laden…")}</p>}
        {missing && !p && <p className="muted">{tx("Deze pagina bestaat niet of is niet voor jou zichtbaar.")} {!user && <Link href="/login" style={{ color: "var(--blue)" }}>{tx("Log in")}</Link>}</p>}
        {p && <ProfileLayout c={{ p, setP, user, ready, rel, chat, label, ask, answer, block, i, setI }} />}
      </main>
    </div>
  );
}
