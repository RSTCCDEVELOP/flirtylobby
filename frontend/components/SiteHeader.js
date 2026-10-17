import { tx } from "../lib/t";
import Link from "next/link";
import { Logo } from "./BrandingContext";
import { ImageEdit } from "./EditMode";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import SiteUserArea from "./SiteUserArea";
import { EditModeSwitch } from "./EditMode";
import { ShopLinks } from "./Cart";
import SiteMenu from "./SiteMenu";
import { ChatButton, DirectIndicator } from "./Chat";
import NotificationBell from "./NotificationBell";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <ImageEdit target="asset:logo">
        <Link href="/" className="brand">
          <Logo />
        </Link>
      </ImageEdit>
      <SiteMenu />
      <div className="site-actions">
        <ShopLinks />
        <DirectIndicator />
          <NotificationBell />
          <ChatButton />
        <EditModeSwitch />
        <LanguageSwitcher />
        <ThemeToggle />
        <SiteUserArea />
      </div>
    </header>
  );
}
