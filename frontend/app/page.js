import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { EditableImage, EditableText } from "../components/EditMode";
import { Logo, HomePhotos } from "../components/BrandingContext";

import { pageMetadata } from "../lib/seo";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMetadata("/", { absolute: true });

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="uc">
        <EditableImage id="home.hero" fallback={<Logo />} />
        <EditableText id="home.title" as="h1" fallback="Onze website is in aanbouw" />
        <EditableText id="home.text" as="p" rich fallback="We werken hard aan een nieuwe website. Binnenkort vind je hier meer informatie." />
        <HomePhotos />
      </main>
      <SiteFooter />
    </div>
  );
}
