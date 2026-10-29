// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../lib/t";
import Link from "next/link";
import { Logo } from "./BrandingContext";
import { ImageEdit } from "./EditMode";
import FaqDrawer from "./FaqDrawer";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import SiteUserArea from "./SiteUserArea";
import { EditModeSwitch } from "./EditMode";
import { ShopLinks } from "./Cart";
import SiteMenu from "./SiteMenu";
import { ChatButton, DirectIndicator } from "./Chat";
import NotificationBell from "./NotificationBell";
import SandboxPill from "./SandboxPill";
import HeaderEdit from "./HeaderEdit";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <ImageEdit target="asset:logo">
        <Link href="/" className="brand">
          <Logo header />
        </Link>
      </ImageEdit>
      <SiteMenu />
      <div className="site-actions">
        <SandboxPill />
        <ShopLinks />
        <DirectIndicator />
          <NotificationBell />
          <ChatButton />
        <HeaderEdit />
        <EditModeSwitch />
        <LanguageSwitcher />
        <FaqDrawer />
        <ThemeToggle />
        <SiteUserArea />
      </div>
    </header>
  );
}
