// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../lib/t";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import ResellerSearch from "../../components/ResellerSearch";
import { pageMetadata } from "../../lib/seo";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Resellers"), ...(await pageMetadata("/resellers")) });

// The public page of the easy2edit site: find a reseller (the data comes from the API).
export default function ResellersPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Resellers")}</h1>
        <p>{tx("Zoek een easy2edit-reseller bij jou in de buurt.")}</p>
        <ResellerSearch />
      </main>
      <SiteFooter />
    </div>
  );
}
