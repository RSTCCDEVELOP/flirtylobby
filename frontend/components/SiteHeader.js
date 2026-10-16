import Link from "next/link";
import { Logo } from "./BrandingContext";
import { ImageEdit } from "./EditMode";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import SiteUserArea from "./SiteUserArea";
import { EditModeSwitch } from "./EditMode";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <ImageEdit target="asset:logo">
        <Link href="/" className="brand">
          <Logo />
        </Link>
      </ImageEdit>
      <nav className="site-nav">
        <Link href="/">Home</Link>
      </nav>
      <div className="site-actions">
        <EditModeSwitch />
        <LanguageSwitcher />
        <ThemeToggle />
        <SiteUserArea />
      </div>
    </header>
  );
}
