"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { useChat } from "../../../../components/Chat";
import DirectConnection from "../../../../components/DirectConnection";
import { api, errorText } from "../../../../lib/api";

function Invite({ room, open, onOpen, onClose }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/direct/${room.token}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { prompt("Kopieer de link:", url); } };
  const share = () => navigator.share?.({ title: "Uitnodiging", text: "Maak rechtstreeks verbinding met mij", url }).catch(() => {});
  const online = room.guest_online;
  return (
    <div className="card" style={{ marginBottom: "1rem", borderColor: open ? "var(--blue)" : undefined }}>
      <div className="invite-box">
        {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img className="qr" src={qr} alt="QR-code van de uitnodiging" />}
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", minWidth: 0 }}>
          <span>
            {room.guest_name ? <span className={`badge ${online ? "ok" : "off"}`}>{online ? `Verbonden: ${room.guest_name}` : `${room.guest_name} is weg`}</span> : <span className="badge off">Nog niemand</span>}
            {" "}<small className="muted">geldig tot {new Date(room.expires_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</small>
          </span>
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <button className="btn" onClick={copy}>{copied ? "Gekopieerd ✓" : "Link kopiëren"}</button>
            {typeof navigator !== "undefined" && navigator.share && <button className="btn" onClick={share}>Delen…</button>}
            <button className={`btn ${open ? "" : "primary"}`} onClick={onOpen}>{open ? "Sluiten" : "Openen"}</button>
            <button className="btn danger" onClick={onClose}>Uitnodiging intrekken</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Direct() {
  const chat = useChat();
  const [rooms, setRooms] = useState(null);
  const [open, setOpen] = useState(null); // {token, info}
  const [error, setError] = useState("");
  const load = useCallback(() => api("/direct/rooms/").then(setRooms).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const create = async () => {
    setError("");
    try { const l = await api("/direct/rooms/", { method: "POST" }); setRooms(l); } catch (e) { setError(errorText(e)); }
  };
  const close = async (r) => {
    if (!confirm("Deze uitnodiging intrekken? De link werkt dan niet meer.")) return;
    await api(`/direct/rooms/${r.token}/`, { method: "DELETE" });
    if (open?.token === r.token) setOpen(null);
    load();
  };
  const toggle = async (r) => {
    if (open?.token === r.token) return setOpen(null);
    try { setOpen({ token: r.token, info: await api(`/direct/${r.token}/`) }); } catch (e) { setError(errorText(e)); }
  };

  if (chat?.cfg && chat.cfg.method !== "webrtc") return <p className="muted">Directe verbinding staat uit. Een superadmin kan dit aanzetten bij Admin → Community → Chat.</p>;
  return (
    <>
      <div className="page-head">
        <h1>Directe verbinding</h1>
        <button className="btn primary" onClick={create}>+ Nieuwe uitnodiging</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>Maak een link of QR-code en stuur die naar iemand. Zodra de ander de link opent, zie je hier dat jullie verbonden zijn en kun je rechtstreeks chatten, foto&apos;s delen en videobellen. De ander heeft geen account nodig.</p>
      {error && <div className="alert">{error}</div>}
      {rooms && !rooms.length && <div className="card"><p className="muted" style={{ margin: 0 }}>Je hebt nog geen open uitnodigingen.</p></div>}
      {(rooms || []).map((r) => <Invite key={r.token} room={r} open={open?.token === r.token} onOpen={() => toggle(r)} onClose={() => close(r)} />)}
      {open && (
        <Collapsible id="direct-live" title="Verbinding" defaultOpen>
          <DirectConnection key={open.token} token={open.token} role="owner" info={open.info} onClosed={() => { setOpen(null); load(); }} />
        </Collapsible>
      )}
    </>
  );
}
