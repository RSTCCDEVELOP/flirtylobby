"use client";

import { tx } from "../lib/t";
import { IconPaperclip, IconPhone, IconVideo } from "./Icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";

const CHUNK = 16 * 1024;

/**
 * One-to-one connection (WebRTC) inside an invitation room. The server only relays offers/answers/ICE;
 * text, files and video go straight between the two devices. The owner is the "polite" side (perfect negotiation).
 * props: token, role ("owner" | "guest"), secret (guest key), info (from /direct/<token>/)
 */
export default function DirectConnection({ token, role, secret, info, onClosed }) {
  const [peer, setPeer] = useState({ owner_online: false, guest_online: false, owner_name: "", guest_name: "" });
  const [link, setLink] = useState("connecting"); // connecting | open | closed
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [call, setCall] = useState(null); // {status: calling|incoming|active, local, remote}
  const st = useRef({ pc: null, dc: null, making: false, ignore: false, file: null, last: 0, call: null });
  const fileInput = useRef(null), lv = useRef(null), rv = useRef(null), box = useRef(null);
  const polite = role === "owner";
  st.current.call = call;

  const send = useCallback((kind, payload = {}) =>
    api(`/direct/${token}/signal/`, { method: "POST", body: { kind, payload, key: secret } }).catch(() => {}), [token, secret]);
  const add = useCallback((m) => setMsgs((l) => [...l, { id: `${Date.now()}-${Math.random()}`, ...m }]), []);

  const bind = useCallback((dc) => {
    dc.binaryType = "arraybuffer";
    st.current.dc = dc;
    dc.onopen = () => setLink("open");
    dc.onclose = () => setLink("closed");
    dc.onmessage = (e) => {
      const s = st.current;
      if (typeof e.data === "string") {
        const m = JSON.parse(e.data);
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
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const s = ensurePeer();
    stream.getTracks().forEach((t) => s.pc.addTrack(t, stream));
    return stream;
  };
  const startCall = async () => {
    try { const local = await media(); setCall({ status: "calling", local, remote: null }); send("call"); }
    catch (e) { setError(tx("Camera of microfoon niet beschikbaar: ") + (e.message || e)); }
  };
  const accept = async () => {
    try { const local = await media(); setCall({ status: "active", local, remote: null }); send("accept"); }
    catch (e) { setError(tx("Camera of microfoon niet beschikbaar: ") + (e.message || e)); send("decline"); setCall(null); }
  };

  const handle = useCallback(async (sig) => {
    const { kind, payload } = sig;
    if (kind === "call") return setCall((c) => c || { status: "incoming", local: null, remote: null });
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
      } catch (e) { if (!stop) { setError(errorText(e)); onClosed?.(); } stop = true; }
    };
    tick();
    const t = setInterval(() => !stop && tick(), 1500);
    return () => { stop = true; clearInterval(t); };
  }, [token, secret, handle, onClosed]);

  useEffect(() => { if (lv.current) lv.current.srcObject = call?.local || null; }, [call?.local]);
  useEffect(() => { if (rv.current) rv.current.srcObject = call?.remote || null; }, [call?.remote, call?.status]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs]);

  const disconnect = async () => {
    if (!(await confirmDialog(role === "owner" ? tx("De verbinding met {0} verbreken? De link blijft werken voor iemand anders.", peer.guest_name || tx("de ander")) : tx("De verbinding verbreken?"), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken"), danger: true }))) return;
    hangup(false);
    const body = { key: secret };
    try { await api(role === "owner" ? `/direct/rooms/${token}/disconnect/` : `/direct/${token}/leave/`, { method: "POST", body }); } catch {}
    st.current.dc?.close(); st.current.pc?.close(); st.current.pc = null;
    onClosed?.("left");
  };
  const other = role === "owner" ? peer.guest_name : peer.owner_name;
  const otherOnline = role === "owner" ? peer.guest_online : peer.owner_online;
  const connected = link === "open";

  const sendText = (e) => {
    e.preventDefault();
    const dc = st.current.dc;
    if (!text.trim() || !dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify({ t: "text", body: text.trim() }));
    add({ me: true, body: text.trim() });
    setText("");
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
        {connected ? <strong>{tx("Verbonden met")} {other || tx("de ander")}</strong>
          : otherOnline ? <span>{other || tx("De ander")} {tx("is online, verbinding maken…")}</span>
          : <span>{role === "owner" ? tx("Wachten tot iemand de uitnodiging opent…") : tx("Wachten op {0}…", peer.owner_name || tx("de uitnodiger"))}</span>}
        {link === "closed" && !connected && <small className="muted"> {tx("De verbinding is verbroken.")}</small>}
        {(connected || otherOnline) && <button type="button" className="btn sm danger" style={{ marginLeft: "auto" }} onClick={disconnect}>{tx("Verbreek verbinding")}</button>}
      </div>
      {error && <div className="alert">{error}</div>}

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

      <div className="direct-chat card">
        <div className="chat-msgs" ref={box} style={{ minHeight: 220, maxHeight: 420, overflow: "auto", display: "flex", flexDirection: "column", gap: ".4rem" }}>
          {!msgs.length && <p className="muted" style={{ margin: "auto" }}>{connected ? tx("Zeg hallo") : tx("Je kunt schrijven zodra jullie verbonden zijn.")}</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.me ? "me" : ""}`}>
              {m.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.name} />}
              {m.kind === "video" && <video src={m.url} controls preload="metadata" />}
              {m.body && <span>{m.body}</span>}
            </div>
          ))}
        </div>
        <form className="row" style={{ flexWrap: "nowrap", marginTop: ".5rem" }} onSubmit={sendText}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tx("Typ een bericht…")} disabled={!connected} />
          <input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) sendFile(f); }} />
          {(info.chat.photos || info.chat.videos) && <button type="button" className="btn" disabled={!connected} title={tx("Foto of video sturen")} onClick={() => fileInput.current.click()}><IconPaperclip /></button>}
          {info.chat.video_chat && <button type="button" className="btn" disabled={!connected || !!call} title={tx("Videobellen")} onClick={startCall} aria-label={tx("Videobellen")}><IconVideo /></button>}
          <button className="btn primary" disabled={!connected || !text.trim()}>{tx("Verstuur")}</button>
        </form>
        <small className="muted">{tx("Rechtstreeks tussen jullie twee apparaten. Er wordt niets op de server bewaard en alles verdwijnt als je de pagina sluit.")}</small>
      </div>
    </div>
  );
}
