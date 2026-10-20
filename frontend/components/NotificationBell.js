"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { IconBell, IconHeart, IconMail } from "./Icons";
import { useModule } from "./Modules";
import { useSession } from "./Session";
import NotificationFeed from "./NotificationFeed";

const LINK = { like: "/dashboard/community/discover?tab=likedme", match: "/dashboard/community/discover?tab=matches", message: "/dashboard/community/messages", dchat: "/dashboard/community/direct" };

// Bell in the header: who liked you, new matches and short messages. A new one also pops up as a notice for a moment.
export default function NotificationBell() {
  const generic = useModule("notifications");
  return generic ? <NotificationFeed /> : <LegacyBell />;
}

function LegacyBell() {
  const { user } = useSession();
  const on = useModule("profiles");
  const [data, setData] = useState({ unseen: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const lastId = useRef(null);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/notifications/");
      const fresh = d.items.filter((n) => !n.seen && (lastId.current === null ? false : n.id > lastId.current));
      if (d.items.length) lastId.current = Math.max(lastId.current ?? 0, ...d.items.map((n) => n.id)); else if (lastId.current === null) lastId.current = 0;
      if (fresh.length) { setToast(fresh[0]); setTimeout(() => setToast(null), 6000); }
      setData(d);
    } catch {}
  }, []);
  useEffect(() => {
    if (!user || !on) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, on, load]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  if (!user || !on) return null;

  const text = (n) => {
    const who = n.from?.name;
    if (n.kind === "match") return who ? tx("Het is een match met {0}!", who) : tx("Het is een match!");
    if (n.kind === "dchat") return tx("{0} wil chatten via de directe verbinding. Accepteren of weigeren?", n.text || tx("Iemand"));
    if (n.kind === "message") return who ? tx("{0} stuurde je een bericht: {1}", who, n.text) : n.text;
    return who ? tx("{0} vindt je leuk", who) : tx("Iemand vindt je leuk");
  };
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data.unseen) { try { await api("/notifications/seen/", { method: "POST", body: {} }); setData((d) => ({ ...d, unseen: 0 })); } catch {} }
  };

  return (
    <div className="notif" ref={box}>
      <button type="button" className="btn sm notif-btn" onClick={toggle} title={tx("Meldingen")} aria-label={tx("Meldingen")} aria-expanded={open}>
        <IconBell />{data.unseen > 0 && <span className="cart-count">{data.unseen}</span>}
      </button>
      {open && (
        <div className="notif-pop card">
          <strong>{tx("Meldingen")}</strong>
          {!data.items.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen meldingen.")}</p>}
          {data.items.map((n) => (
            <Link key={n.id} href={n.kind === "match" && n.from?.slug ? `/leden/${n.from.slug}` : LINK[n.kind]} className={`notif-item ${n.seen ? "" : "new"}`} onClick={() => setOpen(false)}>
              <span className="notif-av">{n.from?.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(n.from.photo)} alt="" /> : n.kind === "message" ? <IconMail /> : <IconHeart />}</span>
              <span>{text(n)}</span>
            </Link>
          ))}
        </div>
      )}
      {toast && <Link href={LINK[toast.kind]} className="notif-toast" onClick={() => setToast(null)}><IconHeart fill="currentColor" width={16} height={16} /> {text(toast)}</Link>}
    </div>
  );
}
