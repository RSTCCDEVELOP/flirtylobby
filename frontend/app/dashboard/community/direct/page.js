"use client";

import { tx } from "../../../../lib/t";
import { IconCheck, IconRefresh } from "../../../../components/Icons";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { useChat } from "../../../../components/Chat";
import { DirectSlot, useDirectHost } from "../../../../components/DirectHost";
import { api, errorText } from "../../../../lib/api";

// The guest asks to chat: accept (the chat opens) or decline
function ChatRequest({ room, onAnswer }) {
  if (room.chat_request !== "asked" || !room.guest_name) return null;
  return (
    <div className="alert chat-request" style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
      <strong className="gname" data-g={room.guest_gender || undefined}>{room.guest_name}</strong> {tx("wil chatten.")}
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".4rem" }}>
        <button type="button" className="btn sm primary" onClick={() => onAnswer(true)}>{tx("Accepteren")}</button>
        <button type="button" className="btn sm danger" onClick={() => onAnswer(false)}>{tx("Weigeren")}</button>
      </span>
    </div>
  );
}

function Invite({ room, open, onOpen, onChat, onClose, onDisconnect, onRenew, onAnswer }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/direct/${room.token}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { (await promptDialog(tx("Kopieer de link:"), url)); } };
  const share = () => navigator.share?.({ title: tx("Uitnodiging"), text: tx("Maak rechtstreeks verbinding met mij"), url }).catch(() => {});
  const online = room.guest_online;
  return (
    <div className="card" style={{ marginBottom: "1rem", borderColor: open ? "var(--blue)" : undefined }}>
      <ChatRequest room={room} onAnswer={onAnswer} />
      <div className="invite-box">
        {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img className="qr" src={qr} alt={tx("QR-code van de uitnodiging")} />}
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", minWidth: 0 }}>
          <span>
            {room.guest_name ? <span className={`badge ${online ? "ok" : "off"}`}>{online ? tx("Verbonden: {0}", room.guest_name) : tx("{0} is weg", room.guest_name)}</span> : <span className="badge off">{tx("Nog niemand")}</span>}
            {" "}<small className="muted">{tx("geldig tot")} {new Date(room.expires_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</small>
          </span>
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
          {room.code && <span className="invite-code" title={tx("Verbinden zonder link: voer deze code in op de pagina Verbind opnieuw")}><small className="muted">{tx("Code")}</small> <strong>{room.code.slice(0, 3)} {room.code.slice(3)}</strong> <small className="muted">· {tx("verbinden zonder link")}</small></span>}
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <button className="btn" onClick={copy}>{copied ? <>{tx("Gekopieerd")} <IconCheck /></> : tx("Link kopiëren")}</button>
            {typeof navigator !== "undefined" && navigator.share && <button className="btn" onClick={share}>{tx("Delen…")}</button>}
            {room.guest_name && <button className="btn danger" onClick={onDisconnect}>{tx("Verbreek verbinding")}</button>}
            {online && !open && <button className="btn primary" onClick={onChat}>{tx("Start chat")}</button>}
            <button className={`btn ${open || online ? "" : "primary"}`} onClick={onOpen}>{open ? tx("Sluiten") : tx("Openen")}</button>
            <button className="btn" onClick={onRenew} title={tx("Maakt een nieuwe link en QR-code; de oude werkt dan niet meer")}>{tx("Nieuwe code")}</button>
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
  const host = useDirectHost();
  const open = host?.session || null; // {token, info, mode}: lives in the host, so it keeps running when you leave this page
  const setOpen = (s) => (s ? host.open(s) : host.close());
  const [error, setError] = useState("");
  const [view, setView] = useState("popup"); // where "Start chat" opens the connection: popup (bottom right) or on this page
  const [mini, setMini] = useState(false); // popup folded to a bar (the connection stays)
  useEffect(() => { try { setView(localStorage.getItem("directView") === "page" ? "page" : "popup"); } catch {} }, []);
  const pickView = (v) => { setView(v); try { localStorage.setItem("directView", v); } catch {} };
  const load = useCallback(() => api("/direct/rooms/").then(setRooms).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const answer = async (r, yes) => {
    try { await api(`/direct/rooms/${r.token}/chat-request/`, { method: "POST", body: { accept: yes } }); if (yes) toggle(r, view); load(); }
    catch (e) { setError(errorText(e)); }
  };

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
    if (t) api(`/direct/${t}/`).then((info) => host.open({ token: t, info, mode: "page" })).catch(() => {});
  }, []);
  // new code: the old link and QR stop working, a fresh invitation takes its place
  const renew = async (r) => {
    setError("");
    try {
      await api(`/direct/rooms/${r.token}/`, { method: "DELETE" });
      if (open?.token === r.token) setOpen(null);
      setRooms(await api("/direct/rooms/", { method: "POST" }));
    } catch (e) { setError(errorText(e)); load(); }
  };
  // first end the connection, then a new code is made so a new connection can be set up
  const disconnect = async (r) => {
    if (!(await confirmDialog(tx("De verbinding met {0} verbreken? Daarna maken we een nieuwe code aan, zodat je opnieuw verbinding kunt maken.", r.guest_name), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken en nieuwe code"), danger: true }))) return;
    await api(`/direct/rooms/${r.token}/disconnect/`, { method: "POST" }).catch(() => {});
    await renew(r);
  };
  const toggle = async (r, mode = "page") => {
    if (open?.token === r.token) return setOpen(null);
    try { setOpen({ token: r.token, mode, info: await api(`/direct/${r.token}/`) }); setMini(false); } catch (e) { setError(errorText(e)); }
  };

  if (chat?.cfg && chat.cfg.method !== "webrtc") return <p className="muted">{tx("Directe verbinding staat uit. Een superadmin kan dit aanzetten bij Admin → Community → Chat.")}</p>;
  return (
    <>
      <div className="page-head">
        <h1>{tx("Directe verbinding")}</h1>
        <div className="row">
          <label className="inline-field">{tx("Chat openen als")}
            <select style={{ width: "auto" }} value={view} onChange={(e) => pickView(e.target.value)}><option value="popup">{tx("Popup")}</option><option value="page">{tx("Op de pagina")}</option></select>
          </label>
          <button className="btn" onClick={load} title={tx("Verversen")}><IconRefresh /> {tx("Verversen")}</button>
          {!(rooms || []).length && <button className="btn primary" onClick={create}>{tx("+ Nieuwe uitnodiging")}</button>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Maak een link of QR-code en stuur die naar iemand. Zodra de ander de link opent, zie je hier dat jullie verbonden zijn en kun je rechtstreeks chatten, foto's delen en videobellen. De ander heeft geen account nodig.")}</p>
      {error && <div className="alert">{error}</div>}
      {rooms && !rooms.length && <div className="card"><p className="muted" style={{ margin: 0 }}>{tx("Je hebt nog geen open uitnodigingen.")}</p></div>}
      {(rooms || []).map((r) => <Invite key={r.token} room={r} open={open?.token === r.token} onOpen={() => toggle(r, "page")} onChat={() => toggle(r, view)} onClose={() => close(r)} onAnswer={(yes) => answer(r, yes)} onDisconnect={() => disconnect(r)} onRenew={() => renew(r)} />)}
      {open && open.mode === "popup" && (
        <div className={`direct-pop card ${mini ? "mini" : ""}`}>
          <div className="chat-pop-head">
            <strong>{tx("Chat met {0}", open.info?.guest_name || rooms?.find((x) => x.token === open.token)?.guest_name || tx("de ander"))}</strong>
            <span className="row" style={{ gap: ".3rem", flexWrap: "nowrap" }}>
              <button className="btn sm" onClick={() => setMini(!mini)} aria-label={mini ? tx("Uitklappen") : tx("Inklappen")}>{mini ? "▴" : "▾"}</button>
              <button className="btn sm" onClick={() => setOpen(null)} aria-label={tx("Sluiten")}>✕</button>
            </span>
          </div>
          <div className="direct-pop-body" hidden={mini}>
            <DirectSlot />
          </div>
        </div>
      )}
      {open && open.mode !== "popup" && (
        <Collapsible id="direct-live" title={tx("Verbinding")} defaultOpen>
          <DirectSlot />
        </Collapsible>
      )}
    </>
  );
}
