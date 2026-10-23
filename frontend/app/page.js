// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { EditableImage, EditableText } from "../components/EditMode";
import { Logo, HomePhotos } from "../components/BrandingContext";

import Movable from "../components/Movable";
import PageBlocks from "../components/PageBlocks";
import { pageMetadata } from "../lib/seo";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMetadata("/", { absolute: true });

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="uc">
        <Movable page="home" id="home.hero" type="image"><EditableImage id="home.hero" fallback={<Logo />} /></Movable>
        <Movable page="home" id="home.title" type="text"><EditableText id="home.title" as="h1" fallback="Onze website is in aanbouw" /></Movable>
        <Movable page="home" id="home.text" type="text"><EditableText id="home.text" as="p" rich fallback="We werken hard aan een nieuwe website. Binnenkort vind je hier meer informatie." /></Movable>
        <HomePhotos />
        <PageBlocks pageKey="home" />
      </main>
      <SiteFooter />
    </div>
  );
}
