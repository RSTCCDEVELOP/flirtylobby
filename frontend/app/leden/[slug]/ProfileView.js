"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useChat } from "../../../components/Chat";
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
    const message = prompt("Wil je een bericht meesturen? (optioneel)", "");
    if (message === null) return;
    try {
      const r = await api("/connections/", { method: "POST", body: { user: p.id, kind, message } });
      setP({ ...p, relation: r.relation });
    } catch (e) { alert(e.message); }
  };
  const answer = async (action) => {
    await api(`/connections/${p.relation.incoming_friend_id}/respond/`, { method: "POST", body: { action } });
    window.location.reload();
  };
  const rel = p?.relation;
  const label = (st, text) => (st === "pending" ? "Verzoek verstuurd…" : st === "declined" ? "Geweigerd" : text);

  const block = async () => {
    if (!confirm(`${p.name} blokkeren? Jullie kunnen elkaar dan niet meer zien, vinden, berichten of chatten.`)) return;
    await api("/blocks/", { method: "POST", body: { user: p.id } });
    window.location.href = "/leden";
  };

  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        {!p && !missing && <p className="muted">Laden…</p>}
        {missing && !p && <p className="muted">Deze pagina bestaat niet of is niet voor jou zichtbaar. {!user && <Link href="/login" style={{ color: "var(--blue)" }}>Log in</Link>}</p>}
        {p && (
          <div className="profile-hero">
            <div className="gallery">
              {p.photos.length > 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="photo-lock">
                    <img className="main" src={mediaUrl(p.photos[Math.min(i, p.photos.length - 1)].url)} alt={p.name} />
                    {p.photos[Math.min(i, p.photos.length - 1)].blurred && <span className="lock-badge">🔒 Wazig · vraag toegang</span>}
                  </div>
                  {p.photos.length > 1 && <div className="thumbs">{p.photos.map((ph, n) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={n} src={mediaUrl(ph.url)} alt="" onClick={() => setI(n)} style={{ cursor: "pointer", borderColor: n === i ? "var(--blue)" : undefined }} />)}</div>}
                </>
              ) : <div className="card" style={{ aspectRatio: "4/3", display: "grid", placeItems: "center" }}><span className="muted">{p.locked ? "🔒 Alleen voor geselecteerde leden" : "Geen foto's"}</span></div>}
            </div>
            <div>
              <h1>{p.name}{p.age ? `, ${p.age}` : ""}</h1>
              {(p.city || p.interests?.length > 0) && <p className="muted">{[p.city].filter(Boolean).join(" · ")}</p>}
              {p.interests?.length > 0 && <p className="chips">{p.interests.map((t) => <span key={t} className="chip" style={{ cursor: "default" }}>{t}</span>)}</p>}
              {p.locked && <p className="alert" style={{ background: "var(--bg)" }}>Dit profiel is alleen zichtbaar voor geselecteerde leden en vrienden. Vraag toegang om het te bekijken.</p>}
              {p.headline && <p style={{ fontSize: "1.1rem" }}>{p.headline}</p>}
              {p.bio && <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>}
              {p.is_self && <p className="alert ok" style={{ background: "var(--bg)" }}>Dit is je eigen pagina{!p.enabled && " (nog niet actief, alleen jij ziet hem)"}. <Link href="/dashboard/community/profile" style={{ color: "var(--blue)" }}>Bewerken</Link></p>}
              {user && !p.is_self && rel?.enabled && (
                <div className="request-bar">
                  {rel.incoming_friend_id && <><button className="btn primary" onClick={() => answer("accept")}>Vriendschap accepteren</button><button className="btn" onClick={() => answer("decline")}>Weigeren</button></>}
                  {!rel.incoming_friend_id && !rel.friends && <button className="btn" disabled={rel.friend === "pending" || rel.friend === "declined"} onClick={() => ask("friend")}>🤝 {label(rel.friend, "Vriend worden")}</button>}
                  {rel.friends && <span className="badge ok">🤝 Vrienden</span>}
                  {!rel.friends && p.has_private && p.photos.some((ph) => ph.blurred) && <button className="btn" disabled={rel.photos === "pending" || rel.photos === "declined"} onClick={() => ask("photos")}>🖼 {label(rel.photos, "Foto's bekijken aanvragen")}</button>}
                  {p.locked && !rel.friends && <button className="btn" disabled={rel.profile === "pending" || rel.profile === "declined"} onClick={() => ask("profile")}>👤 {label(rel.profile, "Profiel bekijken aanvragen")}</button>}
                </div>
              )}
              {user && !p.is_self && !p.locked && (
                <div className="row" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
                  {p.can_like && <button className={`btn ${p.liked ? "primary" : ""}`} onClick={async () => { try { const r = p.liked ? await api(`/discover/like/${p.id}/`, { method: "DELETE" }) : await api("/discover/like/", { method: "POST", body: { user: p.id } }); setP({ ...p, liked: r.liked, match: r.match }); if (r.match && !p.match) alert("Het is een match! 🎉"); } catch (e) { alert(e.message); } }}>{p.liked ? "♥ Leuk" : "♡ Leuk vinden"}</button>}
                  {p.can_like && <button className="btn" onClick={async () => { await api(`/discover/favorite/${p.id}/`, { method: p.favorite ? "DELETE" : "POST" }); setP({ ...p, favorite: !p.favorite }); }}>{p.favorite ? "★ Favoriet" : "☆ Favoriet"}</button>}
                  {p.can_message && <Link className="btn primary" href={`/dashboard/community/messages`}>Bericht sturen</Link>}
                  {p.can_chat && chat?.cfg && <button className="btn" onClick={() => { chat.openPartner({ id: p.id, name: p.name }); chat.setWidgetOpen(true); }}>Chatten</button>}
                  <button className="btn danger" onClick={block}>Blokkeren</button>
                </div>
              )}
              {!user && ready && <p className="muted" style={{ marginTop: "1rem" }}><Link href="/login" style={{ color: "var(--blue)" }}>Log in</Link> om dit lid een bericht te sturen.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
