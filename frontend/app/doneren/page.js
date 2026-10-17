import { tx } from "../../lib/t";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import Donate from "../../components/Donate";
import { pageMetadata } from "../../lib/seo";
import { requirePage } from "../../lib/pages-server";
import { requireModule } from "../../lib/shop-server";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Doneren"), ...(await pageMetadata("/doneren")) });

export default async function DonatePage() {
  await requireModule("donations");
  await requirePage("donations");
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Doneren")}</h1>
        <Donate />
      </main>
      <SiteFooter />
    </div>
  );
}
