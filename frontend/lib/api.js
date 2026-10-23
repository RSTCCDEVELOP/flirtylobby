// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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

export const apiBase = () => getBase();
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
  if (res.status === 402 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("payment-required", { detail: data?.detail }));  // a subscription is needed: see PaymentRequired
  // the login is not valid any more (the account was removed, or logged out elsewhere): log out here too. Only when it is still the token this call used: a call that started before logging in must not log the new login out again
  if (res.status === 401 && token && /token/i.test(data?.detail || "") && getToken() === token) clearToken();
  if (!res.ok) throw new ApiError(res.status, data);
  return translateTree(data);
}

// Download a file the API makes (with the login of the member): the browser saves it under `filename`
export async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${getBase()}/api${path}`, { headers: token ? { Authorization: `Token ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Download a file the API makes from a POST (with a body): returns the response headers. The file is made in memory by the server, nothing stays there.
export async function downloadPost(path, body, filename) {
  const token = getToken();
  const res = await fetch(`${getBase()}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || filename;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return res.headers;
}

// Flatten DRF field errors into one readable string
export function errorText(err) {
  if (!(err instanceof ApiError) || !err.data) return tx(err.message || "Er ging iets mis.");
  if (err.data.detail) return tx(err.data.detail);
  return Object.entries(err.data)
    .map(([k, v]) => `${k}: ${[].concat(v).map((m) => tx(m)).join(" ")}`)
    .join(" · ");
}
