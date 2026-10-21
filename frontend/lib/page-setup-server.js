// The setup of one page (Admin -> Pagina's -> Instellingen -> Pagina-opzet): header and footer on or off and its own theme. What the page does not set follows the theme in use.
export async function getPageSetup(key) {
  const fallback = { header: true, footer: true, theme: null, css: "", fonts_url: "" };
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/pages/setup/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? { ...fallback, ...(await res.json()) } : fallback;
  } catch {
    return fallback;
  }
}
