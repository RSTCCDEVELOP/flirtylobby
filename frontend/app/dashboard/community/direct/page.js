"use client";

import { tx } from "../../../../lib/t";
import { IconCheck } from "../../../../components/Icons";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { useChat } from "../../../../components/Chat";
import DirectConnection from "../../../../components/DirectConnection";
import { api, errorText } from "../../../../lib/api";

function Invite({ room, open, onOpen, onClose, onDisconnect }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/direct/${room.token}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { (await promptDialog(tx("Kopieer de link:"), url)); } };
  const share = () => navigator.share?.({ title: tx("Uitnodiging"), text: tx("Maak rechtstreeks verbinding met mij"), url }).catch(() => {});
  const online = room.guest_online;
  return (
    <div className="card" style={{ marginBottom: "1rem", borderColor: open ? "var(--blue)" : undefined }}>
      <div className="invite-box">
        {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img className="qr" src={qr} alt={tx("QR-code van de uitnodiging")} />}
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", minWidth: 0 }}>
          <span>
            {room.guest_name ? <span className={`badge ${online ? "ok" : "off"}`}>{online ? tx("Verbonden: {0}", room.guest_name) : tx("{0} is weg", room.guest_name)}</span> : <span className="badge off">{tx("Nog niemand")}</span>}
            {" "}<small className="muted">{tx("geldig tot")} {new Date(room.expires_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</small>
          </span>
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <button className="btn" onClick={copy}>{copied ? <>{tx("Gekopieerd")} <IconCheck /></> : tx("Link kopiëren")}</button>
            {typeof navigator !== "undefined" && navigator.share && <button className="btn" onClick={share}>{tx("Delen…")}</button>}
            <button className={`btn ${open ? "" : "primary"}`} onClick={onOpen}>{open ? tx("Sluiten") : tx("Openen")}</button>
            {room.guest_name && <button className="btn" onClick={onDisconnect}>{tx("Verbreek verbinding")}</button>}
            <button className="btn danger" onClick={onClose}>{tx("Uitnodiging intrekken")}</button>
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
    if (!(await confirmDialog(tx("Deze uitnodiging intrekken? De link werkt dan niet meer."), { danger: true }))) return;
    await api(`/direct/rooms/${r.token}/`, { method: "DELETE" });
    if (open?.token === r.token) setOpen(null);
    load();
  };
  useEffect(() => { // coming from the dashboard block or the "connected" popup
    const t = new URLSearchParams(window.location.search).get("room");
    if (t) api(`/direct/${t}/`).then((info) => setOpen({ token: t, info })).catch(() => {});
  }, []);
  const disconnect = async (r) => {
    if (!(await confirmDialog(tx("De verbinding met {0} verbreken? De link blijft werken voor iemand anders.", r.guest_name), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken"), danger: true }))) return;
    await api(`/direct/rooms/${r.token}/disconnect/`, { method: "POST" }).catch(() => {});
    if (open?.token === r.token) setOpen(null);
    load();
  };
  const toggle = async (r) => {
    if (open?.token === r.token) return setOpen(null);
    try { setOpen({ token: r.token, info: await api(`/direct/${r.token}/`) }); } catch (e) { setError(errorText(e)); }
  };

  if (chat?.cfg && chat.cfg.method !== "webrtc") return <p className="muted">{tx("Directe verbinding staat uit. Een superadmin kan dit aanzetten bij Admin → Community → Chat.")}</p>;
  return (
    <>
      <div className="page-head">
        <h1>{tx("Directe verbinding")}</h1>
        <button className="btn primary" onClick={create}>{tx("+ Nieuwe uitnodiging")}</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Maak een link of QR-code en stuur die naar iemand. Zodra de ander de link opent, zie je hier dat jullie verbonden zijn en kun je rechtstreeks chatten, foto's delen en videobellen. De ander heeft geen account nodig.")}</p>
      {error && <div className="alert">{error}</div>}
      {rooms && !rooms.length && <div className="card"><p className="muted" style={{ margin: 0 }}>{tx("Je hebt nog geen open uitnodigingen.")}</p></div>}
      {(rooms || []).map((r) => <Invite key={r.token} room={r} open={open?.token === r.token} onOpen={() => toggle(r)} onClose={() => close(r)} onDisconnect={() => disconnect(r)} />)}
      {open && (
        <Collapsible id="direct-live" title={tx("Verbinding")} defaultOpen>
          <DirectConnection key={open.token} token={open.token} role="owner" info={open.info} onClosed={() => { setOpen(null); load(); }} />
        </Collapsible>
      )}
    </>
  );
}
