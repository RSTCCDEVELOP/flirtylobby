import { notFound } from "next/navigation";
import { EditableText } from "../../../components/EditMode";
import SiteFooter from "../../../components/SiteFooter";
import SiteHeader from "../../../components/SiteHeader";
import { getOwnPage } from "../../../lib/pages-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getOwnPage(slug);
  return { title: p ? p.title.nl || Object.values(p.title)[0] : "Pagina" };
}

// An own page from Admin -> Pagina's. Title and text are edited in edit mode, per language.
export default async function OwnPage({ params }) {
  const { slug } = await params;
  const p = await getOwnPage(slug);
  if (!p) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main className="doc">
        <EditableText id={`page.${slug}.title`} as="h1" fallbacks={p.title} fallback={p.title.nl || Object.values(p.title)[0]} />
        <EditableText id={`page.${slug}.body`} as="div" rich fallback="" className="doc-rich" />
      </main>
      <SiteFooter />
    </div>
  );
}
