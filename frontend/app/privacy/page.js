import { tx } from "../../lib/t";
import { notFound } from "next/navigation";
import { getModules } from "../../lib/modules-server";
import { requirePage } from "../../lib/pages-server";
import { pageMetadata } from "../../lib/seo";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { EditableText } from "../../components/EditMode";
import { PRIVACY_BODY, PRIVACY_TITLE } from "../../lib/privacy-defaults";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Privacybeleid"), ...(await pageMetadata("/privacy")) });

// Default privacy page. Texts come with defaults per language and can be edited in edit mode (✎ Uitgebreid).
export default async function Privacy() {
  if ((await getModules()).privacy_pages === false) notFound();
  await requirePage("privacy");
  return (
    <div className="site">
      <SiteHeader />
      <main className="doc">
        <EditableText id="privacy.title" as="h1" fallbacks={PRIVACY_TITLE} fallback={PRIVACY_TITLE.nl} />
        <EditableText id="privacy.body" as="div" rich fallbacks={PRIVACY_BODY} fallback={PRIVACY_BODY.nl} className="doc-rich" />
      </main>
      <SiteFooter />
    </div>
  );
}
