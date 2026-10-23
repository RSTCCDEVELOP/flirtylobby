// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../lib/t";
import SiteFooter from "../../components/SiteFooter";
import PageBlocks from "../../components/PageBlocks";
import Paged from "../../components/Paged";
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
        <PageBlocks pageKey="donations" />
        <Paged id="donations-page" selector=".don-grid"><Donate /></Paged>
      </main>
      <SiteFooter />
    </div>
  );
}
