import "./globals.css";

export const metadata = { title: "RST Coaching & Consultancy" };
export const dynamic = "force-dynamic"; // theme comes from the API on every request

// Runs before first paint: saved choice, else the OS preference (prevents a light flash)
const themeScript = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

// Design settings ("Vormgeving") are validated server-side, so the CSS is safe to inline
async function getTheme() {
  try {
    const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
    const res = await fetch(`${base}/api/theme/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const theme = await getTheme();
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {theme?.fonts_url && <link rel="stylesheet" href={theme.fonts_url} />}
        {theme?.css && <style id="theme-live" dangerouslySetInnerHTML={{ __html: theme.css }} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
