// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
