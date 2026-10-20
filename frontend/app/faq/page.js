import { notFound } from "next/navigation";
import UserFaq from "../../components/UserFaq";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { requirePage } from "../../lib/pages-server";
import { requireModule } from "../../lib/shop-server";
import { pageMetadata } from "../../lib/seo";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: "FAQ", ...(await pageMetadata("/faq")) });

export default async function Page() {
  await requireModule("faq");
  await requirePage("faq");
  try { const r = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api/faq/settings/`, { cache: "no-store" }); if (r.ok && (await r.json()).page_scope === "private") notFound(); } catch (e) { if (e?.digest) throw e; }
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop"><UserFaq /></main>
      <SiteFooter />
    </div>
  );
}
