// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../lib/t";
import SiteFooter from "../../components/SiteFooter";
import PageBlocks from "../../components/PageBlocks";
import SiteHeader from "../../components/SiteHeader";
import Plans from "../../components/Plans";
import Paged from "../../components/Paged";
import { pageMetadata } from "../../lib/seo";
import { requirePage } from "../../lib/pages-server";
import { requireModule } from "../../lib/shop-server";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Abonnementen"), ...(await pageMetadata("/abonnementen")) });

export default async function SubscriptionsPage() {
  await requireModule("subscriptions");
  await requirePage("subscriptions");
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Abonnementen")}</h1>
        <PageBlocks pageKey="subscriptions" />
        <Paged id="plans-page" selector=".plan-grid"><Plans /></Paged>
      </main>
      <SiteFooter />
    </div>
  );
}
