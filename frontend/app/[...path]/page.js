import { notFound } from "next/navigation";
import { EditableText } from "../../components/EditMode";
import PageBlocks from "../../components/PageBlocks";
import { PageRouteProvider } from "../../components/PageRoute";
import Paywall from "../../components/Paywall";
import PluginPublic from "../../components/PluginPublic";
import PageShell from "../../components/PageShell";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { getOwnPage } from "../../lib/pages-server";
import { getPageSetup } from "../../lib/page-setup-server";

export const dynamic = "force-dynamic";

const API = () => process.env.API_URL_INTERNAL || "http://localhost:8000";

// A page that a plugin adds to the website (public_pages in its plugin.json), at an address of its own, e.g. /producten.
async function find(path) {
  try {
    const res = await fetch(`${API()}/api/plugins/public/?path=${encodeURIComponent("/" + path.join("/"))}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// A standard page of the website with texts and blocks (Admin -> Pagina's), at an address of its own, e.g. /community. Gone while its module is off.
async function findStandard(path) {
  try {
    const res = await fetch(`${API()}/api/pages/by-url/?path=${encodeURIComponent("/" + path.join("/"))}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function getLayout(key) {
  try {
    const res = await fetch(`${API()}/api/pages/layout/${encodeURIComponent(key)}/`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const path = (await params).path;
  const pg = await find(path);
  if (pg) return { title: pg.title, ...(pg.noindex ? { robots: "noindex" } : {}) };
  const sp = await findStandard(path);
  return sp ? { title: sp.title?.nl || Object.values(sp.title || {})[0] } : {};
}

export default async function PluginSitePage({ params, searchParams }) {
  const path = (await params).path;
  const pg = await find(path);
  if (pg) {
    const query = await searchParams;
    const route = { path: "/" + path.join("/"), params: pg.params, query };
    // a page of the webshop (shop, product, cart, checkout): when its layout holds the block of the plugin, the page is built from blocks the administrator can move in edit mode
    const lay = pg.page ? await getLayout(pg.page) : null;
    const wrapped = lay?.rows?.some((r) => r.cells?.some((c) => c.items?.some((i) => i.type === "object" && i.ref === `plugin-${pg.name}-${pg.page}`)));
    return (
      <div className="site">
        <SiteHeader />
        <main className="shop">
          {wrapped ? <PageRouteProvider value={route}><PageBlocks pageKey={pg.page} title={pg.title} /></PageRouteProvider> : <PluginPublic name={pg.name} file={pg.file} title={pg.title} route={route} />}
        </main>
        <SiteFooter />
      </div>
    );
  }
  const sp = await findStandard(path);
  const own = sp ? await getOwnPage(sp.key) : null;
  if (!sp || !own) notFound();
  const slug = sp.key;
  const setup = await getPageSetup(slug);
  return (
    <PageShell setup={setup}>
      <main className="doc">
        <EditableText id={`page.${slug}.title`} as="h1" fallbacks={own.title} fallback={own.title.nl || Object.values(own.title)[0]} />
        <Paywall page={slug}><EditableText id={`page.${slug}.body`} as="div" rich fallback="" className="doc-rich" /></Paywall>
        <PageBlocks pageKey={slug} />
      </main>
    </PageShell>
  );
}
