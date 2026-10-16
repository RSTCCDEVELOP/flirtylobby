import { tx, translateTree } from "./t";
const CONFIGURED = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Opened via a LAN address (phone, other computer)? Then "localhost" for the API would be that device itself: use the page's host.
function base() {
  if (typeof window === "undefined") return CONFIGURED;
  try {
    const u = new URL(CONFIGURED);
    if (["localhost", "127.0.0.1"].includes(u.hostname) && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return `${u.protocol}//${window.location.hostname}:${u.port || 8000}`;
    }
  } catch {}
  return CONFIGURED;
}
const BASE_CACHE = { v: null };
const getBase = () => (BASE_CACHE.v ??= base());

export const mediaUrl = (path) => (path?.startsWith("http") ? path : `${getBase()}${path}`);

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem("token"));
// Logging in or out tells the rest of the app ("token-changed"), so chat, notifications and edit mode follow without a page reload
const announce = () => { try { window.dispatchEvent(new Event("token-changed")); } catch {} };
export const setToken = (t) => { localStorage.setItem("token", t); announce(); };
export const clearToken = () => { localStorage.removeItem("token"); announce(); };

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || "Er ging iets mis.");
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${getBase()}/api${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: !body ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return translateTree(data);
}

// Flatten DRF field errors into one readable string
export function errorText(err) {
  if (!(err instanceof ApiError) || !err.data) return tx(err.message || "Er ging iets mis.");
  if (err.data.detail) return tx(err.data.detail);
  return Object.entries(err.data)
    .map(([k, v]) => `${k}: ${[].concat(v).map((m) => tx(m)).join(" ")}`)
    .join(" · ");
}
