import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import SiteUserArea from "./SiteUserArea";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <Image src="/logo-rstcc.png" alt="RST Coaching & Consultancy" width={316} height={346} priority />
      </Link>
      <nav className="site-nav">
        <Link href="/">Home</Link>
      </nav>
      <div className="site-actions">
        <ThemeToggle />
        <SiteUserArea />
      </div>
    </header>
  );
}
