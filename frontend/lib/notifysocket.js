import { apiBase, getToken } from "./api";

// One WebSocket for the notifications (/ws/notifications/): the server says "notify" when there is news, so the bell does not have to ask every few seconds.
// It reconnects by itself (1, 2, 4 ... 64 seconds); while it is closed the parts that listen fall back on asking now and then.
const subs = new Set();
let ws = null, open = false, retry = 0, retryTimer = null, pingTimer = null;

const emit = (m) => subs.forEach((f) => { try { f(m); } catch {} });
const url = () => `${apiBase().replace(/^http/, "ws")}/ws/notifications/`;  // the token goes in the first message, not in the address (logs)

function connect() {
  if (ws || !subs.size || !getToken() || typeof WebSocket === "undefined") return;
  let sock;
  try { sock = new WebSocket(url()); } catch { return; }
  ws = sock;
  sock.onopen = () => { try { sock.send(JSON.stringify({ auth: getToken() })); } catch {} open = true; retry = 0; clearInterval(pingTimer); pingTimer = setInterval(() => { try { sock.send("ping"); } catch {} }, 25000); };
  sock.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m && (m.type === "notify" || m.type === "hello")) emit(m); } catch {} };
  sock.onclose = (ev) => {
    open = false; ws = null; clearInterval(pingTimer);
    emit({ type: "closed" });
    if (subs.size && ev.code !== 4401) { retry = Math.min(retry + 1, 6); clearTimeout(retryTimer); retryTimer = setTimeout(connect, 1000 * 2 ** retry); }
  };
}

export const notifySocketOpen = () => open;
export function subscribeNotify(fn) {
  subs.add(fn);
  connect();
  return () => { subs.delete(fn); if (!subs.size) { clearTimeout(retryTimer); if (ws) ws.close(); } };
}
