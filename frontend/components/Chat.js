"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, errorText, getToken, mediaUrl } from "../lib/api";
import { useSession } from "./Session";
import { useUi } from "./Ui";

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);
const CHUNK = 16 * 1024;

/**
 * Chat state for the whole app.
 *  - method "portal": messages go through the server (REST, polled).
 *  - method "webrtc": messages/files go straight from device to device over an RTCDataChannel; the server only relays the
 *    signaling (offers/answers/ICE). Both people must be online. Nothing is stored on the server.
 *  - video chat always uses WebRTC (the portal cannot relay video).
 * Perfect-negotiation pattern: the peer with the higher user id is "polite" and yields when both offer at once.
 */
export function ChatProvider({ children }) {
  const { user } = useSession();
  const [cfg, setCfg] = useState(null);
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null); // {id, name, photo}
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rtc, setRtc] = useState({}); // uid -> [{id, from_me, body, kind, url, filename, at}]
  const [peerState, setPeerState] = useState({}); // uid -> "connecting" | "open" | "closed"
  const [call, setCall] = useState(null); // {uid, name, status: "calling"|"incoming"|"active", local, remote}
  const peers = useRef({});
  const lastSignal = useRef(0);
  const incomingFiles = useRef({});
  const callRef = useRef(null);
  callRef.current = call;
  const cfgRef = useRef(null);
  cfgRef.current = cfg;

  // config (only for logged-in users)
  useEffect(() => {
    if (!user || !getToken()) return setCfg(null);
    api("/community/config/").then((d) => setCfg(d.chat)).catch(() => setCfg(null));
  }, [user]);

  const loadConvs = useCallback(() => {
    if (cfgRef.current?.method === "portal") api("/chat/conversations/").then(setConvs).catch(() => {});
  }, []);
  useEffect(() => {
    if (!cfg) return;
    loadConvs();
    const t = setInterval(loadConvs, 5000);
    return () => clearInterval(t);
  }, [cfg, loadConvs]);

  // ── signaling ────────────────────────────────────────────────────────────
  const signal = useCallback((to, kind, payload = {}) => api("/chat/signal/", { method: "POST", body: { to, kind, payload } }).catch(() => {}), []);
  const addRtc = useCallback((uid, msg) => setRtc((r) => {
    const list = [...(r[uid] || []), { id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), ...msg }];
    try { sessionStorage.setItem(`rtc:${uid}`, JSON.stringify(list.filter((m) => !m.url?.startsWith("blob:")).slice(-100))); } catch {}
    return { ...r, [uid]: list };
  }), []);

  const bindChannel = useCallback((uid, dc) => {
    dc.binaryType = "arraybuffer";
    dc.onopen = () => setPeerState((s) => ({ ...s, [uid]: "open" }));
    dc.onclose = () => setPeerState((s) => ({ ...s, [uid]: "closed" }));
    dc.onmessage = (e) => {
      if (typeof e.data === "string") {
        const m = JSON.parse(e.data);
        if (m.t === "text") addRtc(uid, { from_me: false, body: m.body });
        if (m.t === "file") incomingFiles.current[uid] = { ...m, chunks: [], got: 0 };
        if (m.t === "end") {
          const f = incomingFiles.current[uid];
          if (f) { addRtc(uid, { from_me: false, kind: f.kind, filename: f.name, url: URL.createObjectURL(new Blob(f.chunks, { type: f.mime })) }); delete incomingFiles.current[uid]; }
        }
      } else {
        const f = incomingFiles.current[uid];
        if (f && f.got + e.data.byteLength <= f.size) { f.chunks.push(e.data); f.got += e.data.byteLength; }
      }
    };
    peers.current[uid].dc = dc;
  }, [addRtc]);

  const getPeer = useCallback((uid, { channel = false } = {}) => {
    let st = peers.current[uid];
    if (!st) {
      const pc = new RTCPeerConnection({ iceServers: cfgRef.current?.ice_servers || [] });
      st = peers.current[uid] = { pc, dc: null, polite: user.id > uid, making: false, ignore: false };
      pc.onicecandidate = (e) => e.candidate && signal(uid, "ice", e.candidate.toJSON());
      pc.onnegotiationneeded = async () => {
        try { st.making = true; await pc.setLocalDescription(); await signal(uid, "sdp", pc.localDescription.toJSON()); } finally { st.making = false; }
      };
      pc.ontrack = (e) => setCall((c) => (c && c.uid === uid ? { ...c, remote: e.streams[0] } : c));
      pc.ondatachannel = (e) => bindChannel(uid, e.channel);
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") setPeerState((s) => ({ ...s, [uid]: "closed" })); };
      setPeerState((s) => ({ ...s, [uid]: "connecting" }));
    }
    if (channel && !st.dc) bindChannel(uid, st.pc.createDataChannel("chat")); // triggers the first offer
    return st;
  }, [user, signal, bindChannel]);

  const endCall = useCallback((notify = true) => {
    const c = callRef.current;
    if (!c) return;
    if (notify) signal(c.uid, "end");
    c.local?.getTracks().forEach((t) => t.stop());
    const st = peers.current[c.uid];
    st?.pc.getSenders().forEach((s) => { try { st.pc.removeTrack(s); } catch {} });
    setCall(null);
  }, [signal]);

  const attachMedia = useCallback(async (uid) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const st = getPeer(uid);
    stream.getTracks().forEach((t) => st.pc.addTrack(t, stream));
    return stream;
  }, [getPeer]);

  const handleSignal = useCallback(async (s) => {
    const { from, kind, payload } = s;
    if (kind === "call") return setCall((c) => c || { uid: from, name: s.name, status: "incoming", local: null, remote: null });
    if (kind === "accept") return setCall((c) => (c && c.uid === from ? { ...c, status: "active" } : c));
    if (kind === "decline" || kind === "end") return callRef.current?.uid === from ? endCall(false) : null;
    const st = getPeer(from);
    const pc = st.pc;
    try {
      if (kind === "sdp") {
        const collision = payload.type === "offer" && (st.making || pc.signalingState !== "stable");
        st.ignore = !st.polite && collision;
        if (st.ignore) return;
        await pc.setRemoteDescription(payload);
        if (payload.type === "offer") { await pc.setLocalDescription(); await signal(from, "sdp", pc.localDescription.toJSON()); }
      } else if (kind === "ice") {
        try { await pc.addIceCandidate(payload); } catch (e) { if (!st.ignore) console.warn("ICE", e); }
      }
    } catch (e) { console.warn("signal", e); }
  }, [getPeer, signal, endCall]);

  const needSignaling = !!cfg && (cfg.method === "webrtc" || cfg.video_chat);
  useEffect(() => {
    if (!needSignaling) return;
    const t = setInterval(async () => {
      try {
        const list = await api(`/chat/signals/?after=${lastSignal.current}`);
        for (const s of list) { lastSignal.current = Math.max(lastSignal.current, s.id); await handleSignal(s); }
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [needSignaling, handleSignal]);

  // ── actions ─────────────────────────────────────────────────────────────
  const startCall = async (partner) => {
    try {
      const local = await attachMedia(partner.id);
      setCall({ uid: partner.id, name: partner.name, status: "calling", local, remote: null });
      signal(partner.id, "call");
    } catch (e) { alert("Camera of microfoon niet beschikbaar: " + (e.message || e)); }
  };
  const acceptCall = async () => {
    const c = callRef.current;
    try {
      const local = await attachMedia(c.uid);
      setCall({ ...c, status: "active", local });
      signal(c.uid, "accept");
    } catch (e) { alert("Camera of microfoon niet beschikbaar: " + (e.message || e)); declineCall(); }
  };
  const declineCall = () => { const c = callRef.current; if (c) signal(c.uid, "decline"); setCall(null); };

  const openPartner = useCallback((partner) => {
    setActive(partner);
    if (cfgRef.current?.method === "webrtc") {
      try { const saved = JSON.parse(sessionStorage.getItem(`rtc:${partner.id}`)); if (saved) setRtc((r) => (r[partner.id] ? r : { ...r, [partner.id]: saved })); } catch {}
      getPeer(partner.id, { channel: true });
    }
  }, [getPeer]);

  const sendRtcText = (uid, body) => {
    const dc = peers.current[uid]?.dc;
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify({ t: "text", body }));
    addRtc(uid, { from_me: true, body });
    return true;
  };
  const sendRtcFile = async (uid, file) => {
    const dc = peers.current[uid]?.dc;
    const c = cfgRef.current;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!dc || dc.readyState !== "open") return "Niet verbonden.";
    if (!kind || (kind === "image" && !c.photos) || (kind === "video" && !c.videos)) return "Dit bestandstype mag niet gedeeld worden.";
    if (file.size > (kind === "image" ? c.max_image_mb : c.max_video_mb) * 1048576) return "Bestand is te groot.";
    dc.send(JSON.stringify({ t: "file", name: file.name, kind, mime: file.type, size: file.size }));
    const buf = await file.arrayBuffer();
    for (let i = 0; i < buf.byteLength; i += CHUNK) {
      while (dc.bufferedAmount > 1 << 20) await new Promise((r) => setTimeout(r, 50)); // do not flood the channel
      dc.send(buf.slice(i, i + CHUNK));
    }
    dc.send(JSON.stringify({ t: "end" }));
    addRtc(uid, { from_me: true, kind, filename: file.name, url: URL.createObjectURL(file) });
    return null;
  };

  const unread = convs.reduce((n, c) => n + c.unread, 0);
  return (
    <ChatContext.Provider value={{ cfg, convs, loadConvs, active, setActive, openPartner, widgetOpen, setWidgetOpen, rtc, peerState, call, unread,
      startCall, acceptCall, declineCall, endCall, sendRtcText, sendRtcFile, user }}>
      {children}
    </ChatContext.Provider>
  );
}

// ── UI ─────────────────────────────────────────────────────────────────────
const Dot = ({ on }) => <span className={`dot ${on ? "ok" : ""}`} style={{ width: 9, height: 9, display: "inline-block", boxShadow: "none" }} title={on ? "Online" : "Offline"} />;

function Bubble({ m }) {
  return (
    <div className={`bubble ${m.from_me ? "me" : ""}`}>
      {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url?.startsWith("blob:") ? m.url : mediaUrl(m.url)} alt={m.filename} />}
      {m.kind === "video" && <video src={m.url?.startsWith("blob:") ? m.url : mediaUrl(m.url)} controls preload="metadata" />}
      {m.body && <span>{m.body}</span>}
    </div>
  );
}

function CallView() {
  const { call, endCall } = useChat();
  const lv = useRef(null), rv = useRef(null);
  useEffect(() => { if (lv.current) lv.current.srcObject = call?.local || null; }, [call?.local]);
  useEffect(() => { if (rv.current) rv.current.srcObject = call?.remote || null; }, [call?.remote]);
  if (!call || call.status === "incoming") return null;
  return (
    <div className="call-view">
      <video ref={rv} autoPlay playsInline className="remote" />
      <video ref={lv} autoPlay playsInline muted className="local" />
      <div className="call-bar"><span>{call.status === "calling" ? `Bellen naar ${call.name}…` : `Videochat met ${call.name}`}</span><button className="btn danger" onClick={() => endCall(true)}>Ophangen</button></div>
    </div>
  );
}

export function ChatPanel({ compact = false }) {
  const c = useChat();
  const { cfg, active, setActive, openPartner, convs, rtc, peerState, loadConvs } = c;
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);
  const last = useRef(0);
  const box = useRef(null);
  const files = useRef(null);
  const portal = cfg?.method === "portal";

  // portal: poll the thread
  useEffect(() => {
    if (!active || !portal) return;
    last.current = 0;
    setMsgs([]);
    let stop = false;
    const tick = async () => {
      try {
        const d = await api(`/chat/with/${active.id}/?after=${last.current}`);
        if (stop || !d.messages.length) return;
        last.current = d.messages[d.messages.length - 1].id;
        setMsgs((m) => [...m, ...d.messages]);
        loadConvs();
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [active, portal, loadConvs]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, rtc, active]);
  useEffect(() => { if (q.trim().length > 0) api(`/people/?q=${encodeURIComponent(q)}`).then(setPeople).catch(() => {}); else setPeople([]); }, [q]);

  if (!cfg) return null;
  const list = portal ? msgs : rtc[active?.id] || [];
  const state = peerState[active?.id];

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr("");
    if (portal) {
      try { const d = await api(`/chat/with/${active.id}/`, { method: "POST", body: { body } }); setText(""); last.current = d.messages.length ? Math.max(last.current, d.messages[d.messages.length - 1].id) : last.current; setMsgs((m) => [...m, ...d.messages.filter((x) => x.id > (m[m.length - 1]?.id || 0))]); loadConvs(); } catch (ex) { setErr(errorText(ex)); }
    } else if (c.sendRtcText(active.id, body)) setText("");
    else setErr("Nog niet verbonden. De ander moet online zijn.");
  }

  async function sendFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    if (portal) {
      const fd = new FormData();
      fd.append("file", f);
      try { const d = await api(`/chat/with/${active.id}/`, { method: "POST", body: fd }); setMsgs((m) => [...m, ...d.messages.filter((x) => x.id > (m[m.length - 1]?.id || 0))]); last.current = Math.max(last.current, ...d.messages.map((x) => x.id)); } catch (ex) { setErr(errorText(ex)); }
    } else setErr((await c.sendRtcFile(active.id, f)) || "");
  }

  const accept = [cfg.photos && "image/*", cfg.videos && "video/*"].filter(Boolean).join(",");
  return (
    <div className={`chat ${compact ? "compact" : ""}`}>
      {(!compact || !active) && (
        <div className="chat-list">
          <input placeholder="Zoek een lid om te chatten…" value={q} onChange={(e) => setQ(e.target.value)} />
          {people.filter((p) => p.accept_chat).map((p) => <button key={p.id} className="chat-row" onClick={() => { openPartner(p); setQ(""); }}><Dot on={p.online} /> {p.name} <small className="muted">nieuw gesprek</small></button>)}
          {convs.map((cv) => (
            <button key={cv.user.id} className={`chat-row ${active?.id === cv.user.id ? "active" : ""}`} onClick={() => openPartner(cv.user)}>
              <Dot on={cv.user.online} /> <span><strong>{cv.user.name}</strong><small className="muted">{cv.last}</small></span>{cv.unread > 0 && <span className="cart-count">{cv.unread}</span>}
            </button>
          ))}
          {!portal && <small className="muted" style={{ padding: ".5rem" }}>Directe verbinding (WebRTC): zoek een lid; berichten worden niet opgeslagen.</small>}
          {portal && !convs.length && !people.length && <small className="muted" style={{ padding: ".5rem" }}>Nog geen gesprekken. Zoek hierboven een lid.</small>}
        </div>
      )}
      {active && (
        <div className="chat-thread">
          <div className="chat-head">
            {compact && <button className="btn sm" onClick={() => setActive(null)}>←</button>}
            <strong>{active.name}</strong>
            {!portal && <small className="muted">{state === "open" ? "verbonden" : state === "connecting" ? "verbinden…" : "niet verbonden"}</small>}
            <span style={{ marginLeft: "auto" }}>
              {cfg.video_chat && <button className="btn sm" title="Videochat" onClick={() => c.startCall(active)} disabled={!!c.call}>🎥 Bel</button>}
            </span>
          </div>
          <div className="chat-msgs" ref={box}>
            {list.map((m) => <Bubble key={m.id} m={m} />)}
            {!list.length && <p className="muted" style={{ textAlign: "center" }}>Zeg hallo 👋</p>}
          </div>
          {err && <div className="alert" style={{ margin: ".25rem" }}>{err}</div>}
          <form className="chat-input" onSubmit={send}>
            {accept && <><input ref={files} type="file" accept={accept} hidden onChange={sendFile} /><button type="button" className="btn sm" title="Foto of video delen" onClick={() => files.current.click()}>📎</button></>}
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Typ een bericht…" />
            <button className="btn primary sm">Stuur</button>
          </form>
        </div>
      )}
      {!active && !compact && <div className="chat-thread" style={{ display: "grid", placeItems: "center" }}><p className="muted">Kies een gesprek of zoek een lid.</p></div>}
      <CallView />
    </div>
  );
}

// Where is the visitor? Admin setting "Chat -> Waar tonen" decides on which of these the chat is available.
export function chatArea(path) {
  if (path === "/") return "home";
  if (path.startsWith("/dashboard/admin") || path.startsWith("/dashboard/superadmin")) return "backend";
  if (path.startsWith("/dashboard")) return "dashboard";
  return "website";
}
const chatVisible = (cfg, path) => !!cfg && cfg.show_on.includes(chatArea(path));

// Launcher in a header (style "button"): opens the popup or goes to the chat page
export function ChatButton() {
  const c = useChat();
  const path = usePathname();
  const { chat_label: label } = useUi();
  if (!c?.cfg || c.cfg.style !== "button" || !chatVisible(c.cfg, path)) return null;
  const onClick = () => (c.cfg.display === "page" ? (window.location.href = "/dashboard/community/chat") : c.setWidgetOpen(!c.widgetOpen));
  return (
    <button className="btn sm chat-btn" onClick={onClick} title="Chat" aria-label="Chat">
      💬{label === "text" && <span> Chat</span>}{c.unread > 0 && <span className="cart-count">{c.unread}</span>}
    </button>
  );
}

// Popup panel (+ the floating button when style is "floating") + incoming call dialog
export function ChatWidget() {
  const c = useChat();
  const path = usePathname();
  const { chat_label: label } = useUi();
  if (!c?.cfg) return null;
  const popup = c.cfg.display !== "page";
  const onChatPage = path.startsWith("/dashboard/community/chat");
  const visible = chatVisible(c.cfg, path);
  const floating = c.cfg.style === "floating";
  return (
    <>
      {popup && !onChatPage && visible && (
        <div className="chat-widget">
          {c.widgetOpen && <div className="card chat-pop"><div className="chat-pop-head"><strong>Chat</strong><button className="btn sm" onClick={() => c.setWidgetOpen(false)}>Sluiten</button></div><ChatPanel compact /></div>}
          {floating && (
            <button className={`chat-fab ${label === "text" ? "with-text" : ""}`} onClick={() => c.setWidgetOpen(!c.widgetOpen)} aria-label="Chat">
              💬{label === "text" && <span> Chat</span>}{c.unread > 0 && <span className="cart-count">{c.unread}</span>}
            </button>
          )}
        </div>
      )}
      {floating && !popup && visible && !onChatPage && (
        <div className="chat-widget"><button className={`chat-fab ${label === "text" ? "with-text" : ""}`} onClick={() => (window.location.href = "/dashboard/community/chat")} aria-label="Chat">💬{label === "text" && <span> Chat</span>}{c.unread > 0 && <span className="cart-count">{c.unread}</span>}</button></div>
      )}
      {c.call?.status === "incoming" && (
        <div className="overlay" style={{ zIndex: 2000 }}>
          <div className="card modal form" style={{ textAlign: "center" }}>
            <h2>📞 {c.call.name} belt je</h2>
            <p className="muted">Videochat</p>
            <div className="row" style={{ justifyContent: "center" }}><button className="btn danger" onClick={c.declineCall}>Weigeren</button><button className="btn primary" onClick={c.acceptCall}>Opnemen</button></div>
          </div>
        </div>
      )}
      {(!popup || onChatPage) && c.call && c.call.status !== "incoming" && <CallView />}
    </>
  );
}
