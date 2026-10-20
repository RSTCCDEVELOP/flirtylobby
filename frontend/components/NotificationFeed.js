"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { IconBell, IconCheck, IconX } from "./Icons";
import { useSession } from "./Session";

export const KIND_LABEL = { system: "Bericht van de beheerder", message: "Nieuw bericht", chat: "Nieuw chatbericht", like: "Nieuwe like", match: "Nieuwe match", request: "Verzoek", direct: "Verzoek om te chatten", donation: "Donatie", subscription: "Abonnement", order: "Bestelling", security: "Beveiliging", plugin: "Plugin" };

export function ago(at) {
  const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (s < 60) return tx("zojuist");
  if (s < 3600) return `${Math.floor(s / 60)} ${tx("min")}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${tx("uur")}`;
  return new Date(at).toLocaleDateString();
}

// Bell in the header for the notifications module: the administrator chooses how it works (list under the bell, side panel, only pop-ups or a page).
export default function NotificationFeed() {
  const { user } = useSession();
  const router = useRouter();
  const [data, setData] = useState({ unread: 0, items: [], settings: { layout: "bell", toasts: true, toast_position: "top-right", toast_seconds: 6, bell_max: 8, group: true } });
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const last = useRef(null);
  const box = useRef(null);
  const cfg = data.settings;

  const load = useCallback(async () => {
    try {
      const d = await api("/notify/?limit=50");
      const top = d.items.reduce((m, n) => Math.max(m, n.id), 0);
      if (last.current !== null && d.settings.toasts) {
        const fresh = d.items.filter((n) => !n.read && n.id > last.current).slice(0, 3);
        if (fresh.length) {
          setToasts((t) => [...t, ...fresh]);
          fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), Math.max(2, d.settings.toast_seconds) * 1000));
        }
      }
      last.current = Math.max(last.current ?? 0, top);
      setData(d);
    } catch {}
  }, []);
  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, load]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  if (!user) return null;

  const read = async (ids) => { try { const r = await api("/notify/mark/", { method: "POST", body: ids ? { ids } : { all: true } }); setData((d) => ({ ...d, unread: r.unread, items: d.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)) })); } catch {} };
  const remove = async (n) => { try { await api(`/notify/${n.id}/`, { method: "DELETE" }); setData((d) => ({ ...d, unread: d.unread - (n.read ? 0 : 1), items: d.items.filter((x) => x.id !== n.id) })); } catch {} };
  const go = (n) => { read([n.id]); setOpen(false); setToasts((t) => t.filter((x) => x.id !== n.id)); if (n.url) (/^https?:/.test(n.url) ? (window.location.href = n.url) : router.push(n.url)); };
  const toggle = () => {
    if (cfg.layout === "page" || cfg.layout === "toasts") { router.push("/dashboard/notifications"); return; }
    setOpen(!open);
  };

  // many of the same kind in a row are shown as one line
  let rows = data.items;
  if (cfg.group) {
    const seen = {};
    rows = [];
    data.items.forEach((n) => {
      if (n.read) { rows.push(n); return; }
      if (seen[n.kind]) { seen[n.kind].count++; seen[n.kind].ids.push(n.id); return; }
      seen[n.kind] = { ...n, count: 1, ids: [n.id] };
      rows.push(seen[n.kind]);
    });
  }
  rows = rows.slice(0, cfg.bell_max);
  const list = (
    <>
      <div className="notif-head">
        <strong>{tx("Meldingen")}</strong>
        <span>
          {data.unread > 0 && <button type="button" className="btn sm ghost" onClick={() => read(null)} title={tx("Alles gelezen")}><IconCheck /></button>}
          {cfg.layout === "panel" && <button type="button" className="btn sm ghost" onClick={() => setOpen(false)} aria-label={tx("Sluiten")}><IconX /></button>}
        </span>
      </div>
      {!rows.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen meldingen.")}</p>}
      {rows.map((n) => (
        <div key={n.id} className={`notif-item ${n.read ? "" : "new"} lvl-${n.level}`}>
          <button type="button" className="notif-main" onClick={() => go(n)}>
            <strong>{n.count > 1 ? `${n.count}× ${tx(KIND_LABEL[n.kind] || n.kind)}` : n.title}</strong>
            {n.count > 1 ? <small>{n.title}</small> : n.body && <small>{n.body}</small>}
            <small className="muted">{ago(n.created_at)}</small>
          </button>
          <button type="button" className="btn sm ghost" onClick={() => (n.ids ? Promise.all(n.ids.map((i) => remove({ ...n, id: i }))) : remove(n))} aria-label={tx("Verwijderen")} title={tx("Verwijderen")}><IconX /></button>
        </div>
      ))}
      <Link href="/dashboard/notifications" className="btn sm" onClick={() => setOpen(false)}>{tx("Alle meldingen en instellingen")}</Link>
    </>
  );

  return (
    <div className="notif" ref={box}>
      <button type="button" className="btn sm notif-btn" onClick={toggle} title={tx("Meldingen")} aria-label={tx("Meldingen")} aria-expanded={open}>
        <IconBell />{data.unread > 0 && <span className="cart-count">{data.unread}</span>}
      </button>
      {open && cfg.layout === "bell" && <div className="notif-pop card">{list}</div>}
      {open && cfg.layout === "panel" && <div className="notif-panel card">{list}</div>}
      {toasts.length > 0 && (
        <div className={`notif-toasts ${cfg.toast_position}`}>
          {toasts.map((n) => (
            <div key={n.id} className={`notif-toast2 lvl-${n.level}`}>
              <button type="button" className="notif-main" onClick={() => go(n)}><strong>{n.title}</strong>{n.body && <small>{n.body}</small>}</button>
              <button type="button" className="btn sm ghost" onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))} aria-label={tx("Sluiten")}><IconX /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
