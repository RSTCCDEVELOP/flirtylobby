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
  const [preview, setPreview] = useState(false); // owner looks at the page the way a visitor who is not logged in sees it
  const [hidden, setHidden] = useState(null);
  // not visible anonymously? try again with the member's login (and the visitor's language)
  useEffect(() => {
    if (!ready) return;
    let lang = "";
    try { lang = localStorage.getItem("lang") || ""; } catch {}
    const pv = !!user && new URLSearchParams(window.location.search).get("preview") === "1";
    setPreview(pv);
    const qs = [lang && `lang=${lang}`, pv && "preview=public"].filter(Boolean).join("&");
    api(`/profiles/${slug}/${qs ? `?${qs}` : ""}`).then((d) => {
      if (d.preview_hidden) { setHidden(d); setP(null); setMissing(false); return; }
      setHidden(null); setP(d); setMissing(false);
    }).catch(() => { if (!initial) setMissing(true); });
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
      {preview && (
        <div className="preview-bar">
          <span>{tx("Voorbeeld: zo ziet een bezoeker die niet is ingelogd jouw openbare profiel.")}</span>
          <Link className="btn" href="/dashboard/community/profile">{tx("Terug naar bewerken")}</Link>
        </div>
      )}
      <main className="shop">
        {hidden && (
          <div className="card" style={{ padding: "1.25rem", maxWidth: 560 }}>
            <h2 style={{ marginTop: 0 }}>{tx("Bezoekers zien deze pagina niet")}</h2>
            <p className="muted">{!hidden.enabled ? tx("Je profielpagina staat uit.") : hidden.visibility === "public" ? tx("Je pagina is niet zichtbaar in de gekozen taal.") : tx("Je pagina is niet openbaar: alleen ingelogde leden met toegang zien hem.")} {tx("Kies bij Zichtbaarheid 'Openbaar' om hem voor iedereen te tonen.")}</p>
            <Link className="btn primary" href="/dashboard/community/profile">{tx("Zichtbaarheid aanpassen")}</Link>
          </div>
        )}
        {!p && !missing && !hidden && <p className="muted">{tx("Laden…")}</p>}
        {missing && !p && <p className="muted">{tx("Deze pagina bestaat niet of is niet voor jou zichtbaar.")} {!user && <Link href="/login" style={{ color: "var(--blue)" }}>{tx("Log in")}</Link>}</p>}
        {p && <ProfileLayout c={{ p, setP, user, ready, rel, chat, label, ask, answer, block, i, setI }} />}
      </main>
    </div>
  );
}
