// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { notFound } from "next/navigation";
import { EditableText } from "../../../components/EditMode";
import PageBlocks from "../../../components/PageBlocks";
import Paywall from "../../../components/Paywall";
import PageShell from "../../../components/PageShell";
import DesignFrame from "../../../components/DesignFrame";
import { getOwnPage } from "../../../lib/pages-server";
import { getPageSetup } from "../../../lib/page-setup-server";
import { pageMetadata } from "../../../lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getOwnPage(slug);
  const seo = await pageMetadata(`/p/${slug}`);
  return { title: p ? p.title.nl || Object.values(p.title)[0] : "Pagina", ...seo };
}

// An own page from Admin -> Pagina's. Title and text are edited in edit mode, per language.
export default async function OwnPage({ params }) {
  const { slug } = await params;
  const p = await getOwnPage(slug);
  if (!p) notFound();
  const setup = await getPageSetup(slug);
  if (p.design) { // taken over 1 to 1 from an html file: the page is its own design
    return (
      <PageShell setup={setup}>
        <DesignFrame html={p.design} pageKey={slug} title={p.title.nl || Object.values(p.title)[0]} />
      </PageShell>
    );
  }
  return (
    <PageShell setup={setup}>
      <main className="doc">
        <EditableText id={`page.${slug}.title`} as="h1" fallbacks={p.title} fallback={p.title.nl || Object.values(p.title)[0]} />
        <Paywall page={slug}><EditableText id={`page.${slug}.body`} as="div" rich fallback="" className="doc-rich" /></Paywall>
        <PageBlocks pageKey={slug} />
      </main>
    </PageShell>
  );
}
