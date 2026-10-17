import { notFound } from "next/navigation";
import PluginPublic from "../../components/PluginPublic";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

// A page that a plugin adds to the website (public_pages in its plugin.json), at an address of its own, e.g. /producten.
async function find(path) {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/plugins/public/?path=${encodeURIComponent("/" + path.join("/"))}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const pg = await find((await params).path);
  return pg ? { title: pg.title, ...(pg.noindex ? { robots: "noindex" } : {}) } : {};
}

export default async function PluginSitePage({ params, searchParams }) {
  const path = (await params).path;
  const pg = await find(path);
  if (!pg) notFound();
  const query = await searchParams;
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <PluginPublic name={pg.name} file={pg.file} title={pg.title} route={{ path: "/" + path.join("/"), params: pg.params, query }} />
      </main>
      <SiteFooter />
    </div>
  );
}
