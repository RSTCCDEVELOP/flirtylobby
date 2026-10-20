import { notFound } from "next/navigation";
import MenuOverview from "../../../components/MenuOverview";
import SiteFooter from "../../../components/SiteFooter";
import SiteHeader from "../../../components/SiteHeader";
import { pageMetadata } from "../../../lib/seo";
import { getMenu } from "../../../lib/pages-server";

export const dynamic = "force-dynamic";
export const generateMetadata = async ({ params }) => ({ ...(await pageMetadata(`/menu/${(await params).key}`)) });

// the overview page of a text-only menu item (it has its own address, SEO settings and addresses per language)
export default async function MenuPage({ params }) {
  const { key } = await params;
  const { items } = await getMenu();
  if (!items.some((i) => i.key === key && i.kind === "menu")) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop"><MenuOverview pageKey={key} /></main>
      <SiteFooter />
    </div>
  );
}
