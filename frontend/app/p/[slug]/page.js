import { notFound } from "next/navigation";
import { EditableText } from "../../../components/EditMode";
import PageBlocks from "../../../components/PageBlocks";
import Paywall from "../../../components/Paywall";
import PageShell from "../../../components/PageShell";
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
