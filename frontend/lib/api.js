const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem("token"));
export const setToken = (t) => localStorage.setItem("token", t);
export const clearToken = () => localStorage.removeItem("token");

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || "Er ging iets mis.");
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: !body ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Flatten DRF field errors into one readable string
export function errorText(err) {
  if (!(err instanceof ApiError) || !err.data) return err.message || "Er ging iets mis.";
  if (err.data.detail) return err.data.detail;
  return Object.entries(err.data)
    .map(([k, v]) => `${k}: ${[].concat(v).join(" ")}`)
    .join(" · ");
}
