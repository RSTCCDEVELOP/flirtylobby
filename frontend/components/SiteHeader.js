import { tx } from "../lib/t";
import Link from "next/link";
import { Logo } from "./BrandingContext";
import { ImageEdit } from "./EditMode";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import SiteUserArea from "./SiteUserArea";
import { EditModeSwitch } from "./EditMode";
import { ShopLinks } from "./Cart";
import { ChatButton, DirectIndicator } from "./Chat";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <ImageEdit target="asset:logo">
        <Link href="/" className="brand">
          <Logo />
        </Link>
      </ImageEdit>
      <nav className="site-nav">
        <Link href="/">{tx("Home")}</Link>
        <ShopLinks />
      </nav>
      <div className="site-actions">
        <DirectIndicator />
          <ChatButton />
        <EditModeSwitch />
        <LanguageSwitcher />
        <ThemeToggle />
        <SiteUserArea />
      </div>
    </header>
  );
}
