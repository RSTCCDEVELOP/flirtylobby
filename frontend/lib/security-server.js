// Server-side helpers (SSR pages and layout)
export async function getSecurity() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/security/public/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
