import Image from "next/image";
import SiteHeader from "../components/SiteHeader";

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="uc">
        <Image src="/logo-rstcc.png" alt="RST Coaching & Consultancy" width={316} height={346} priority />
        <h1>Onze website is in aanbouw</h1>
        <p>We werken hard aan een nieuwe website. Binnenkort vind je hier meer informatie.</p>
      </main>
    </div>
  );
}
