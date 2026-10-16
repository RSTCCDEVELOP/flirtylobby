"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { alertDialog } from "../lib/dialog";
import { api, errorText, mediaUrl } from "../lib/api";
import { cardFieldsText } from "./ProfileFields";
import { useChat } from "./Chat";
import { IconHeart, IconMail, IconRefresh, IconX } from "./Icons";
import VerifyBadge from "./VerifyBadge";

const THRESHOLD = 110;

// Swipe deck like Tinder: drag the top card right to like, left to pass (or use the buttons / arrow keys).
// A short message can go along with the like. When both like each other it is a match and chatting is possible.
export default function Swiper() {
  const chat = useChat();
  const [cards, setCards] = useState(null);
  const [locked, setLocked] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [drag, setDrag] = useState(null); // {x, y} while dragging
  const [fly, setFly] = useState(0); // -1 / 1 while a card flies away
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const start = useRef(null);
  const seen = useRef(new Set());

  const load = useCallback(async (append = false) => {
    let lang = "";
    try { lang = localStorage.getItem("lang") || ""; } catch {}
    try {
      const d = await api(`/discover/deck/${lang ? `?lang=${lang}` : ""}`);
      setLocked(!!d.locked);
      setCards((cur) => {
        const base = append ? cur || [] : [];
        const have = new Set(base.map((c) => c.id));
        return [...base, ...d.cards.filter((c) => !have.has(c.id))];
      });
    } catch (e) { setCards((c) => c || []); await alertDialog(errorText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const top = cards?.[0];
  useEffect(() => { setPhoto(0); setMsgOpen(false); setMsg(""); }, [top?.id]);

  const next = (id) => {
    seen.current.add(id);
    setCards((cur) => {
      const rest = (cur || []).filter((c) => c.id !== id);
      if (rest.length < 3) setTimeout(() => load(true), 0); // refill before the deck runs dry
      return rest;
    });
    setDrag(null); setFly(0); setBusy(false);
  };
  const decide = async (like, message = "") => {
    if (!top || busy) return;
    setBusy(true); setFly(like ? 1 : -1); setMsgOpen(false);
    const c = top;
    try {
      if (like) {
        const r = await api("/discover/like/", { method: "POST", body: { user: c.id, message } });
        if (r.match) setMatch(c);
      } else await api(`/discover/pass/${c.id}/`, { method: "POST", body: {} });
      setTimeout(() => next(c.id), 220);
    } catch (e) { setFly(0); setBusy(false); setDrag(null); await alertDialog(errorText(e)); }
  };

  useEffect(() => {
    const key = (e) => {
      if (match || msgOpen || /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const onDown = (e) => { if (busy) return; start.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 6) start.current.moved = true;
    setDrag({ x: dx, y: dy });
  };
  const onUp = (e) => {
    const s = start.current; start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved) { // tap: next / previous photo
      const r = e.currentTarget.getBoundingClientRect();
      const n = top.photos.length;
      if (n > 1) setPhoto((p) => (e.clientX - r.left > r.width / 2 ? (p + 1) % n : (p - 1 + n) % n));
      setDrag(null);
      return;
    }
    if (Math.abs(dx) > THRESHOLD) decide(dx > 0); else setDrag(null);
  };

  if (!cards) return <p className="muted">{tx("Laden…")}</p>;
  if (locked) return <div className="alert">{tx("Swipen is alleen voor leden die zelf meedoen.")} <Link href="/dashboard/community/profile" style={{ textDecoration: "underline" }}>{tx("Doe mee via je profiel")}</Link>.</div>;

  const x = fly ? fly * 700 : drag?.x || 0, y = fly ? 0 : (drag?.y || 0) * 0.25;
  const style = { transform: `translate(${x}px, ${y}px) rotate(${x / 18}deg)`, transition: drag && !fly ? "none" : "transform .22s ease" };
  const likeOp = Math.min(1, Math.max(0, x / THRESHOLD)), passOp = Math.min(1, Math.max(0, -x / THRESHOLD));

  return (
    <div className="swipe">
      {top ? (
        <>
          <div className="swipe-stack">
            {cards[1] && <div className="swipe-card back" aria-hidden="true">{cards[1].photos[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(cards[1].photos[0])} alt="" />}</div>}
            <div className="swipe-card" style={style} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; setDrag(null); }}>
              {top.photos.length ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(top.photos[photo] || top.photos[0])} alt={top.name} draggable={false} /> : <span className="swipe-nophoto muted">{tx("Geen foto")}</span>}
              {top.photos.length > 1 && <span className="swipe-dots">{top.photos.map((_, i) => <i key={i} className={i === photo ? "on" : ""} />)}</span>}
              <span className="swipe-stamp like" style={{ opacity: likeOp }}>{tx("LEUK")}</span>
              <span className="swipe-stamp pass" style={{ opacity: passOp }}>{tx("NEE")}</span>
              {top.likes_me && <span className="badge ok swipe-likesme"><IconHeart fill="currentColor" width={13} height={13} /> {tx("Vindt jou al leuk")}</span>}
              <div className="swipe-info">
                <strong>{top.name}{top.age ? `, ${top.age}` : ""} <VerifyBadge status={top.verification} size={16} /></strong>
                <span>{[top.city, top.distance_km ? `${top.distance_km} km` : null].filter(Boolean).join(" · ")}</span>
                {top.headline && <span>{top.headline}</span>}
                {top.card_fields?.length > 0 && <span className="swipe-fields">{cardFieldsText(top.card_fields)}</span>}
                <Link href={`/leden/${top.slug}`} className="swipe-more" onPointerDown={(e) => e.stopPropagation()}>{tx("Bekijk profiel")}</Link>
              </div>
            </div>
          </div>

          {msgOpen && (
            <div className="swipe-msg card">
              <label>{tx("Kort bericht bij je like")} <small className="muted">{msg.length}/140</small>
                <input value={msg} maxLength={140} autoFocus onChange={(e) => setMsg(e.target.value)} placeholder={tx("Zeg hoi…")} onKeyDown={(e) => e.key === "Enter" && msg.trim() && decide(true, msg.trim())} />
              </label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setMsgOpen(false)}>{tx("Annuleren")}</button>
                <button className="btn primary" disabled={!msg.trim() || busy} onClick={() => decide(true, msg.trim())}>{tx("Leuk vinden en versturen")}</button>
              </div>
            </div>
          )}

          <div className="swipe-actions">
            <button className="swipe-btn pass" onClick={() => decide(false)} disabled={busy} aria-label={tx("Niet interessant")} title={tx("Niet interessant")}><IconX width={26} height={26} /></button>
            {top.accept_messages && <button className="swipe-btn msg" onClick={() => setMsgOpen(!msgOpen)} disabled={busy} aria-label={tx("Leuk vinden met een bericht")} title={tx("Leuk vinden met een bericht")}><IconMail width={22} height={22} /></button>}
            <button className="swipe-btn like" onClick={() => decide(true)} disabled={busy} aria-label={tx("Leuk vinden")} title={tx("Leuk vinden")}><IconHeart width={26} height={26} fill="currentColor" /></button>
          </div>
          <small className="muted swipe-hint">{tx("Sleep de kaart naar rechts om te liken, naar links om over te slaan. Of gebruik de pijltjestoetsen.")}</small>
        </>
      ) : (
        <div className="card swipe-empty">
          <h2>{tx("Je hebt iedereen gezien")}</h2>
          <p className="muted">{tx("Kom later terug voor nieuwe profielen, of pas je zoekvoorkeuren aan.")}</p>
          <button className="btn primary" onClick={() => load()}><IconRefresh /> {tx("Opnieuw laden")}</button>
        </div>
      )}

      {match && (
        <div className="overlay" role="dialog" aria-modal="true" style={{ zIndex: 4200 }} onClick={() => setMatch(null)}>
          <div className="card modal swipe-match" onClick={(e) => e.stopPropagation()}>
            <IconHeart width={44} height={44} fill="currentColor" style={{ color: "var(--blue)" }} />
            <h2 style={{ margin: 0 }}>{tx("Het is een match!")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Jij en {0} vinden elkaar leuk. Zeg hoi!", match.name)}</p>
            {match.photos[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(match.photos[0])} alt={match.name} className="swipe-match-img" />}
            <div className="row" style={{ justifyContent: "center" }}>
              {match.accept_chat && chat?.cfg && <button className="btn primary" onClick={() => { chat.openPartner({ id: match.id, name: match.name }); chat.setWidgetOpen(true); setMatch(null); }}>{tx("Chat starten")}</button>}
              {match.accept_messages && <Link className="btn" href="/dashboard/community/messages" onClick={() => setMatch(null)}>{tx("Bericht sturen")}</Link>}
              <button className="btn" onClick={() => setMatch(null)}>{tx("Verder swipen")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
