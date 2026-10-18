"use client";

import { getLanguage, tx } from "../lib/t";
import { IconChat, IconGrid, IconImage, IconPhone, IconSend, IconSmile, IconVideo } from "./Icons";
import Flag from "./Flag";
import Tabs from "./Tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBase, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import Link from "next/link";
import { useModule } from "./Modules";

const CHUNK = 16 * 1024;
// Standard chat helpers: emoticons per group and ready-made quick replies
const EMOJI = {
  "Smileys": ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳", "😉", "🙂", "🙃", "😇", "🤗", "🤔", "😅", "😢", "😭", "😡", "😴", "🤯", "😬", "🙄"],
  "Gebaren": ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👋", "✌️", "🤞", "👌", "🤙", "☝️", "👀", "🫶", "🤟"],
  "Harten": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💞", "💖", "💘", "💋", "🔥", "✨", "⭐"],
  "Overig": ["🎉", "🎂", "🍷", "☕", "🍕", "🌞", "🌧️", "🌈", "🚗", "✈️", "🏠", "📍", "📞", "💬", "✅", "❌"],
};
const QUICK = ["Hoi!", "Hoe gaat het?", "Bedankt!", "Leuk je te zien", "Een momentje", "Tot straks!"];

/**
 * One-to-one connection (WebRTC) inside an invitation room. The server only relays offers/answers/ICE;
 * text, files and video go straight between the two devices. The owner is the "polite" side (perfect negotiation).
 * props: token, role ("owner" | "guest"), secret (guest key), info (from /direct/<token>/)
 */
export default function DirectConnection({ token, role, secret, info, onClosed, onChat }) {
  const [peer, setPeer] = useState({ owner_online: false, guest_online: false, owner_name: "", guest_name: "", owner_gender: "", guest_gender: "" });
  const [link, setLink] = useState("connecting"); // connecting | open | closed
  // text messages survive a page reload (e.g. switching language): kept per room in this tab
  const store = `dc:${token}`;
  const saved = useRef(null);
  if (saved.current === null) { try { saved.current = JSON.parse(sessionStorage.getItem(store)) || {}; } catch { saved.current = {}; } }
  const [msgs, setMsgs] = useState(saved.current.msgs || []);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [call, setCall] = useState(null); // {status: calling|incoming|active, local, remote}
  const [chatOn, setChatOn] = useState(!!saved.current.msgs?.length); // the connection comes first; chat, media or video only open once one of the two picks it
  const fails = useRef(0);
  useEffect(() => { onChat?.(role === "owner" ? peer.guest_online : peer.owner_online); }, [role, peer.guest_online, peer.owner_online, onChat]);
  const [tab, setTab] = useState("chat"); // chat | media | video | game
  const [games, setGames] = useState([]);   // the games (plugin Spelletjes) that may be played in the direct mode
  const [gameOpen, setGameOpen] = useState(null); // the game both are playing
  const gameFrame = useRef(null);
  useEffect(() => { fetch(`${apiBase()}/api/plugins/run/games/direct/list?lang=${encodeURIComponent(getLanguage())}`).then((r) => (r.ok ? r.json() : { games: [] })).then((d) => setGames(d.games || [])).catch(() => {}); }, []);
  const tabRef = useRef("chat");
  const [unseen, setUnseen] = useState({ chat: 0, media: 0 });
  const [over, setOver] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState("Smileys");
  const area = useRef(null);
  useEffect(() => { try { sessionStorage.setItem(store, JSON.stringify({ msgs: msgs.filter((m) => !m.kind).slice(-200), last: st.current.last })); } catch {} }, [msgs, store]);
  const pickTab = (k) => { tabRef.current = k; setTab(k); setUnseen((u) => (k === "video" ? u : { ...u, [k]: 0 })); };
  // a screen the admin switched off (Community -> Directe verbinding -> Acties) is never the open one
  useEffect(() => {
    const chatOk = info.chat.chat !== false;
    const ok = { chat: chatOk, media: chatOk && !!(info.chat.photos || info.chat.videos), video: chatOk && !!info.chat.video_chat };
    if (!ok[tab]) { const f = ["chat", "media", "video"].find((k) => ok[k]); if (f) pickTab(f); }
  }, [tab, info.chat.chat, info.chat.photos, info.chat.videos, info.chat.video_chat]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useRef({ pc: null, dc: null, making: false, ignore: false, file: null, last: saved.current.last || 0, call: null });
  const fileInput = useRef(null), lv = useRef(null), rv = useRef(null), box = useRef(null);
  const polite = role === "owner";
  st.current.call = call;

  const send = useCallback((kind, payload = {}) =>
    api(`/direct/${token}/signal/`, { method: "POST", body: { kind, payload, key: secret } }).catch(() => {}), [token, secret]);
  const add = useCallback((m) => {
    setMsgs((l) => [...l, { id: `${Date.now()}-${Math.random()}`, ...m }]);
    if (!m.me) { // something new for the other tab: show a counter on it
      const k = m.kind === "image" || m.kind === "video" ? "media" : "chat";
      if (tabRef.current !== k) setUnseen((u) => ({ ...u, [k]: u[k] + 1 }));
    }
  }, []);

  const bind = useCallback((dc) => {
    dc.binaryType = "arraybuffer";
    st.current.dc = dc;
    dc.onopen = () => setLink("open");
    dc.onclose = () => setLink("closed");
    dc.onmessage = (e) => {
      const s = st.current;
      if (typeof e.data === "string") {
        const m = JSON.parse(e.data);
        if (m.t === "chat" || m.t === "text" || m.t === "file") { setChatOn(true); if (m.t === "chat") { try { st.current.dc?.send(JSON.stringify({ t: "ack" })); } catch {} } }
        if (m.t === "ack") st.current.acked = true;
        if (m.t === "text") add({ me: false, body: m.body });
        if (m.t === "file") s.file = { ...m, chunks: [], got: 0 };
        if (m.t === "end" && s.file) { add({ me: false, kind: s.file.kind, name: s.file.name, url: URL.createObjectURL(new Blob(s.file.chunks, { type: s.file.mime })) }); s.file = null; }
      } else if (st.current.file && st.current.file.got + e.data.byteLength <= st.current.file.size) {
        st.current.file.chunks.push(e.data); st.current.file.got += e.data.byteLength;
      }
    };
  }, [add]);

  const ensurePeer = useCallback(() => {
    const s = st.current;
    if (s.pc) return s;
    const pc = new RTCPeerConnection({ iceServers: info.ice_servers || [] });
    s.pc = pc;
    pc.onicecandidate = (e) => e.candidate && send("ice", e.candidate.toJSON());
    pc.onnegotiationneeded = async () => {
      try { s.making = true; await pc.setLocalDescription(); await send("sdp", pc.localDescription.toJSON()); } finally { s.making = false; }
    };
    pc.ontrack = (e) => setCall((c) => (c ? { ...c, remote: e.streams[0] } : c));
    pc.ondatachannel = (e) => bind(e.channel);
    pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(pc.connectionState)) setLink("closed"); else if (pc.connectionState === "connected") setLink("open"); };
    return s;
  }, [info, send, bind]);

  const hangup = useCallback((notify = true) => {
    const c = st.current.call;
    if (!c) return;
    if (notify) send("end");
    c.local?.getTracks().forEach((t) => t.stop());
    st.current.pc?.getSenders().forEach((x) => { try { st.current.pc.removeTrack(x); } catch {} });
    setCall(null);
  }, [send]);

  const media = async () => {
    // browsers only give camera and microphone on a secure (https) page: over a plain http address mediaDevices does not exist at all
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(tx("Camera en microfoon werken alleen op een beveiligde (https) verbinding. Open de site via https; op het lokale netwerk (http) kan de browser dit niet toestaan."));
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const s = ensurePeer();
    stream.getTracks().forEach((t) => s.pc.addTrack(t, stream));
    return stream;
  };
  const startCall = async () => {
    try { const local = await media(); setCall({ status: "calling", local, remote: null }); send("call"); }
    catch (e) { setError(navigator.mediaDevices?.getUserMedia ? tx("Camera of microfoon niet beschikbaar: ") + (e.message || e) : e.message); }
  };
  // guest: ask the owner to chat (he gets a notice and accepts or declines)

  const accept = async () => {
    try { const local = await media(); setCall({ status: "active", local, remote: null }); send("accept"); }
    catch (e) { setError(navigator.mediaDevices?.getUserMedia ? tx("Camera of microfoon niet beschikbaar: ") + (e.message || e) : e.message); send("decline"); setCall(null); }
  };

  const handle = useCallback(async (sig) => {
    const { kind, payload } = sig;
    if (kind === "chat") { setChatOn(true); send("ack"); return; } // the owner started the chat: open it here too
    if (kind === "ack") { st.current.acked = true; return; }
    if (kind === "game") {  // a game of two: opened, a message of the game, or closed
      if (payload?.op === "open") { setChatOn(true); setGameOpen(payload.game || null); pickTab("game"); }
      else if (payload?.op === "msg") gameFrame.current?.contentWindow?.postMessage({ game: "room", event: "msg", from: payload.from, data: payload.data }, "*");
      else if (payload?.op === "close") setGameOpen(null);
      return;
    }
    if (kind === "text") { setChatOn(true); add({ me: false, body: payload?.body || "" }); return; }
    if (kind === "call") { setChatOn(true); return setCall((c) => c || { status: "incoming", local: null, remote: null }); }
    if (kind === "accept") return setCall((c) => (c ? { ...c, status: "active" } : c));
    if (kind === "decline" || kind === "end") return hangup(false);
    const s = ensurePeer(), pc = s.pc;
    try {
      if (kind === "sdp") {
        const collision = payload.type === "offer" && (s.making || pc.signalingState !== "stable");
        s.ignore = !polite && collision;
        if (s.ignore) return;
        await pc.setRemoteDescription(payload);
        if (payload.type === "offer") { await pc.setLocalDescription(); await send("sdp", pc.localDescription.toJSON()); }
      } else if (kind === "ice") {
        try { await pc.addIceCandidate(payload); } catch (e) { if (!s.ignore) console.warn("ICE", e); }
      }
    } catch (e) { console.warn("signal", e); }
  }, [ensurePeer, polite, send, hangup]);

  // the guest opens the data channel (that makes the first offer); the owner answers
  useEffect(() => {
    if (role === "guest") bind(ensurePeer().pc.createDataChannel("direct"));
    return () => { const s = st.current; s.call?.local?.getTracks().forEach((t) => t.stop()); s.pc?.close(); s.pc = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await api(`/direct/${token}/signals/?after=${st.current.last}${secret ? `&key=${encodeURIComponent(secret)}` : ""}`);
        setPeer(r);
        for (const s of r.signals) { st.current.last = Math.max(st.current.last, s.id); await handle(s); }
        fails.current = 0;
      } catch (e) { // a short hiccup (network, phone sleeping) must not end the connection: only give up after several misses in a row
        if (stop) return;
        if (e.status === 404 || ++fails.current >= 5) { setError(errorText(e)); onClosed?.(); stop = true; }
      }
    };
    tick();
    const t = setInterval(() => !stop && tick(), 1500);
    return () => { stop = true; clearInterval(t); };
  }, [token, secret, handle, onClosed]);

  useEffect(() => { if (lv.current) lv.current.srcObject = call?.local || null; }, [call?.local, tab]);
  useEffect(() => { if (rv.current) rv.current.srcObject = call?.remote || null; }, [call?.remote, call?.status, tab]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, tab]);

  const disconnect = async () => {
    if (!(await confirmDialog(role === "owner" ? tx("De verbinding met {0} verbreken? De link blijft werken voor iemand anders.", peer.guest_name || tx("de ander")) : tx("De verbinding verbreken?"), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken"), danger: true }))) return;
    hangup(false);
    const body = { key: secret };
    try { await api(role === "owner" ? (secret ? `/direct/${token}/owner-leave/` : `/direct/rooms/${token}/disconnect/`) : `/direct/${token}/leave/`, { method: "POST", body }); } catch {}
    st.current.dc?.close(); st.current.pc?.close(); st.current.pc = null;
    onClosed?.("left");
  };
  // whoever picks an activity tells the other side, until it confirms with an "ack". Goes through the server (works before the direct line is up)
  // and through the direct line when that is open.
  const bothHere = role === "owner" ? peer.guest_online : peer.owner_online;
  useEffect(() => {
    if (!chatOn || !bothHere) return;
    st.current.acked = false;
    const tell = () => {
      if (st.current.acked) return;
      send("chat");
      try { if (st.current.dc?.readyState === "open") st.current.dc.send(JSON.stringify({ t: "chat" })); } catch {}
    };
    tell();
    const t = setInterval(tell, 2500);
    return () => clearInterval(t);
  }, [chatOn, bothHere, peer.guest_name, send]);
  const choose = (k) => { setChatOn(true); pickTab(k); };
  const other = role === "owner" ? peer.guest_name : peer.owner_name;
  const otherG = role === "owner" ? peer.guest_gender : peer.owner_gender;
  const meG = role === "owner" ? peer.owner_gender : peer.guest_gender;
  // the video chat may be locked behind a subscription or donation: say so and offer the way to get it
  const donOn = useModule("donations"), subsOn = useModule("subscriptions");
  const [videoLock, setVideoLock] = useState("");
  useEffect(() => {
    if (role !== "owner" || tab !== "video") return;
    api("/subscriptions/access/?key=video_chat").then((r) => setVideoLock(r.ok ? "" : r.message || "Videobellen kan met een abonnement.")).catch(() => {});
  }, [role, tab]);
  const otherOnline = role === "owner" ? peer.guest_online : peer.owner_online;
  const connected = link === "open";
  const canWrite = connected || otherOnline; // text also works through the server
  const texts = msgs.filter((m) => !m.kind), gallery = msgs.filter((m) => m.kind === "image" || m.kind === "video");
  useEffect(() => { if (call) pickTab("video"); }, [!!call]); // eslint-disable-line react-hooks/exhaustive-deps

  // put an emoticon (or a ready-made line) where the cursor is
  const insert = (s) => {
    const el = area.current;
    const a = el ? el.selectionStart : text.length, b = el ? el.selectionEnd : text.length;
    setText((t) => t.slice(0, a) + s + t.slice(b));
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = a + s.length; } }, 0);
  };
  // text goes over the direct line when it is open, otherwise through the server, so chatting never waits for the direct line
  const deliver = (body) => {
    const dc = st.current.dc;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify({ t: "text", body }));
    else send("text", { body });
    add({ me: true, body });
  };
  const sendQuick = (s) => deliver(s);
  const sendText = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    deliver(text.trim());
    setText("");
    setEmojiOpen(false);
  };
  const sendFile = async (f) => {
    const dc = st.current.dc, c = info.chat;
    const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
    if (!dc || dc.readyState !== "open") return setError(tx("Niet verbonden."));
    if (!kind || (kind === "image" && !c.photos) || (kind === "video" && !c.videos)) return setError(tx("Dit bestandstype mag niet gedeeld worden."));
    if (f.size > (kind === "image" ? c.max_image_mb : c.max_video_mb) * 1048576) return setError(tx("Bestand is te groot."));
    setError("");
    dc.send(JSON.stringify({ t: "file", name: f.name, kind, mime: f.type, size: f.size }));
    const buf = await f.arrayBuffer();
    for (let i = 0; i < buf.byteLength; i += CHUNK) {
      while (dc.bufferedAmount > 1 << 20) await new Promise((r) => setTimeout(r, 50));
      dc.send(buf.slice(i, i + CHUNK));
    }
    dc.send(JSON.stringify({ t: "end" }));
    add({ me: true, kind, name: f.name, url: URL.createObjectURL(f) });
  };

  return (
    <div className="direct-room">
      <div className={`direct-status ${connected ? "on" : ""}`}>
        <span className={`dot ${connected ? "ok" : ""}`} style={{ width: 10, height: 10, display: "inline-block", boxShadow: "none" }} />
        {connected ? <strong>{tx("Verbonden met")} <span className="gname" data-g={otherG || undefined}>{other || tx("de ander")}</span>{(role === "owner" ? peer.guest_langs : peer.owner_langs)?.map((c) => <span key={c} style={{ marginLeft: ".35rem", verticalAlign: "middle" }}><Flag code={c} width={18} /></span>)}</strong>
          : otherOnline ? <span>{other || tx("De ander")} {tx("is online, verbinding maken…")}</span>
          : <span>{role === "owner" ? tx("Wachten tot iemand de uitnodiging opent…") : tx("Wachten op {0}…", peer.owner_name || tx("de uitnodiger"))}</span>}
        {link === "closed" && !connected && <small className="muted"> {tx("De verbinding is verbroken.")}</small>}
        {(connected || otherOnline) && <button type="button" className="btn sm danger" style={{ marginLeft: "auto" }} onClick={disconnect}>{tx("Verbreek verbinding")}</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      {!chatOn && !call && connected && (
        <div className="card direct-wait">
          <span className="live-dot" aria-hidden="true" />
          <h2 style={{ margin: 0 }}>{tx("Verbonden met {0}", other || tx("de ander"))}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("Wat wil je samen doen?")}</p>
          {info.chat.chat !== false && <button type="button" className="btn primary" onClick={() => choose("chat")}>{tx("Chatten")}</button>}
          {info.chat.chat === false && <small className="muted">{tx("Er is niets aangezet.")}</small>}
        </div>
      )}
      {!chatOn && !call && !connected && role === "guest" && (
        <div className="card direct-wait">
          <span className="live-dot off" aria-hidden="true" />
          <h2 style={{ margin: 0 }}>{tx("Verbinding maken met {0}…", other || tx("de ander"))}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("Een moment geduld…")}</p>
          <button type="button" className="btn danger" onClick={disconnect}>{tx("Verbreek verbinding")}</button>
        </div>
      )}

      {(chatOn || call) && (
        <>
          <Tabs value={tab} onChange={pickTab} tabs={[
            info.chat.chat !== false && ["chat", "Chat", <IconChat key="c" />, unseen.chat || undefined],
            info.chat.chat !== false && (info.chat.photos || info.chat.videos) && ["media", "Media", <IconImage key="m" />, unseen.media || undefined],
            (info.chat.chat !== false && info.chat.video_chat || call) && ["video", "Videochat", <IconVideo key="v" />, call ? "●" : undefined],
            games.length > 0 && ["game", "Spel", <IconGrid key="g" />, gameOpen ? "●" : undefined],
          ].filter(Boolean)} />

          {/* 1. chat: text messages */}
          <div className="direct-chat card" hidden={tab !== "chat"}>
            <div className="chat-msgs" ref={box} style={{ minHeight: 220, maxHeight: 420, overflow: "auto", display: "flex", flexDirection: "column", gap: ".4rem" }}>
              {!texts.length && <p className="muted" style={{ margin: "auto" }}>{canWrite ? tx("Zeg hallo") : tx("Je kunt schrijven zodra de ander online is.")}</p>}
              {texts.map((m) => <div key={m.id} className={`bubble gbubble ${m.me ? "me" : ""}`} data-g={(m.me ? meG : otherG) || undefined} data-dark={!m.me && meG && meG === otherG ? "1" : undefined}><span>{m.body}</span></div>)}
            </div>
            <div className="chat-quick">
              {QUICK.map((q) => <button key={q} type="button" className="chip" disabled={!canWrite} onClick={() => sendQuick(tx(q))}>{tx(q)}</button>)}
            </div>
            <form className="chat-compose" onSubmit={sendText}>
              <textarea ref={area} rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={!canWrite} placeholder={tx("Typ een bericht…")}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
              {emojiOpen && (
                <div className="emoji-panel">
                  <div className="emoji-tabs">{Object.keys(EMOJI).map((g) => <button key={g} type="button" className={emojiGroup === g ? "on" : ""} onClick={() => setEmojiGroup(g)}>{tx(g)}</button>)}</div>
                  <div className="emoji-grid">{EMOJI[emojiGroup].map((e) => <button key={e} type="button" onClick={() => insert(e)}>{e}</button>)}</div>
                </div>
              )}
              <div className="chat-tools">
                <button type="button" className={`btn ${emojiOpen ? "primary" : ""}`} disabled={!connected} onClick={() => setEmojiOpen(!emojiOpen)} title={tx("Emoticons")} aria-label={tx("Emoticons")}><IconSmile /></button>
                <small className="muted grow">{tx("Enter verstuurt, Shift+Enter is een nieuwe regel.")}</small>
                <button className="btn primary" disabled={!canWrite || !text.trim()}><IconSend /> {tx("Verstuur")}</button>
              </div>
            </form>
          </div>

          {/* 3. game: two play together (the plugin Spelletjes) */}
          <div className="direct-chat card" hidden={tab !== "game"}>
            {!gameOpen ? (
              <>
                <p className="muted" style={{ margin: 0 }}>{tx("Kies een spel om samen te spelen. De ander ziet het meteen.")}</p>
                <div className="lay-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                  {games.map((g) => (
                    <button key={g.slug} type="button" className="card" style={{ textAlign: "left", cursor: "pointer", display: "grid", gap: ".3rem" }} disabled={!connected} onClick={() => { setGameOpen(g); send("game", { op: "open", game: g }); }}>
                      <strong>{g.title}</strong><small className="muted">{g.description}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <GameStage g={gameOpen} me={role === "owner" ? 0 : 1} names={[peer.owner_name || tx("Uitnodiger"), peer.guest_name || tx("Gast")]} frame={gameFrame} send={send} onClose={() => { send("game", { op: "close" }); setGameOpen(null); }} />
            )}
          </div>

          {/* 2. media: photos and videos, sent and received */}
          <div className="direct-chat card" hidden={tab !== "media"}>
            <div className={`dropzone ${over ? "over" : ""}`} role="button" tabIndex={0} aria-disabled={!connected}
              onClick={() => connected && fileInput.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && connected && fileInput.current.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); if (connected) [...e.dataTransfer.files].forEach(sendFile); }}>
              <span>{connected ? tx("Sleep foto's of video's hierheen of klik om te kiezen") : tx("Je kunt bestanden sturen zodra jullie verbonden zijn.")}</span>
              <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { [...e.target.files].forEach(sendFile); e.target.value = ""; }} />
            </div>
            {!(info.chat.photos || info.chat.videos) && <small className="muted">{tx("Foto's en video's sturen staat uit.")}</small>}
            <div className="direct-gallery">
              {gallery.map((m) => (
                <figure key={m.id} className={m.me ? "me" : ""}>
                  {m.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.name} /> : <video src={m.url} controls preload="metadata" />}
                  <figcaption><span className="gname" data-g={(m.me ? meG : otherG) || undefined}>{m.me ? tx("Jij") : other || tx("De ander")}</span> · {m.name}</figcaption>
                </figure>
              ))}
              {!gallery.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen foto's of video's gedeeld.")}</p>}
            </div>
          </div>

          {/* 3. video chat */}
          <div hidden={tab !== "video"}>
            {call?.status === "incoming" && (
              <div className="card" style={{ textAlign: "center" }}>
                <strong><IconPhone /> {other || tx("De ander")} {tx("belt je")}</strong>
                <div className="row" style={{ justifyContent: "center", marginTop: ".5rem" }}><button className="btn danger" onClick={() => { send("decline"); setCall(null); }}>{tx("Weigeren")}</button><button className="btn primary" onClick={accept}>{tx("Opnemen")}</button></div>
              </div>
            )}
            {call && call.status !== "incoming" && (
              <div className="direct-video">
                <video ref={rv} autoPlay playsInline className="remote" />
                <video ref={lv} autoPlay playsInline muted className="local" />
                <div className="call-bar"><span>{call.status === "calling" ? tx("Bellen naar {0}…", other || tx("de ander")) : tx("Videochat met {0}", other || tx("de ander"))}</span><button className="btn danger" onClick={() => hangup(true)}>{tx("Ophangen")}</button></div>
              </div>
            )}
            {!call && (
              <div className="card direct-wait">
                <IconVideo width={36} height={36} />
                <h2 style={{ margin: 0 }}>{tx("Videochat")}</h2>
                <p className="muted" style={{ margin: 0 }}>{info.chat.video_chat ? tx("Bel {0} met beeld en geluid, rechtstreeks tussen jullie apparaten.", other || tx("de ander")) : tx("Videochat staat uit.")}</p>
                {info.chat.video_chat && videoLock && (
                  <>
                    <div className="alert" style={{ margin: 0 }}>{tx(videoLock)}</div>
                    <div className="row" style={{ justifyContent: "center" }}>
                      {donOn && <Link className="btn primary" href="/doneren">{tx("Doneren")}</Link>}
                      {subsOn && <Link className="btn" href="/abonnementen">{tx("Abonnementen bekijken")}</Link>}
                    </div>
                  </>
                )}
                {info.chat.video_chat && !videoLock && <button className="btn primary" disabled={!connected} onClick={startCall}>{tx("Start videochat")}</button>}
              </div>
            )}
          </div>
          <small className="muted">{tx("Rechtstreeks tussen jullie twee apparaten. Er wordt niets op de server bewaard en alles verdwijnt als je de pagina sluit.")}</small>
        </>
      )}
    </div>
  );
}


// A game of two in the direct mode: the game runs in its own sealed frame; this component answers it. Messages between the players go through the direct line.
function GameStage({ g, me, names, frame, send, onClose }) {
  const players = [{ idx: 0, name: names[0], online: true }, { idx: 1, name: names[1], online: true }];
  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data || {}, reply = (data) => frame.current?.contentWindow?.postMessage({ game: "reply", id: d.id, ok: true, data }, "*");
      if (d.game === "hello") {
        frame.current.contentWindow.postMessage({ game: "init", user: { id: 0, name: names[me] }, best: null, state: null, lang: "nl", config: g.config || {}, settings: {}, players: { mode: "multi", max: 2, chat: false, direct: true } }, "*");
        frame.current.contentWindow.postMessage({ game: "room", event: "players", players, me, code: "direct" }, "*");
      } else if (d.game === "room" && d.op === "send") send("game", { op: "msg", from: me, data: d.data, to: d.to });
      else if (d.game === "score") reply({ best: d.score, rank: 1, isBest: true, top: [] });   // no login in the direct mode: nothing is kept
      else if (d.game === "save" || d.game === "load") reply(null);
      else if (d.game === "fullscreen") { try { frame.current.requestFullscreen(); } catch {} }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [g, me]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}><strong>{g.title}</strong><button type="button" className="btn sm" onClick={onClose}>{tx("Sluit het spel")}</button></div>
      <div style={{ position: "relative", height: "min(62vh, 560px)", background: "#000", borderRadius: 12, overflow: "hidden" }}>
        <iframe ref={frame} title={g.title} sandbox="allow-scripts allow-pointer-lock" allow="fullscreen" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          src={`${apiBase()}/api/plugins/run/games/play/${g.slug}/${(g.entry || "index.html").split("/").map(encodeURIComponent).join("/")}`} />
      </div>
      <small className="muted">{g.controls}</small>
    </div>
  );
}
