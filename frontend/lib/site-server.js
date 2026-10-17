// The website's own data (name, domains, footer, maintenance) from Systeem -> Basisgegevens.
export async function getSite() {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/site/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
