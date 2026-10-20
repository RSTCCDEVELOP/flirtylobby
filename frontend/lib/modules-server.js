export async function getModules() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/modules/`, { cache: "no-store" });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}
