"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import BrandingAdmin from "../../../../components/BrandingAdmin";
import EmailLayoutAdmin from "../../../../components/EmailLayoutAdmin";
import { IconGrid, IconImage, IconMail, IconPalette, IconRocket } from "../../../../components/Icons";
import { useModule } from "../../../../components/Modules";
import Tabs from "../../../../components/Tabs";
import LoaderAdmin from "../../../../components/LoaderAdmin";
import ThemeLayout from "../../../../components/ThemeLayout";
import ThemeLook from "../../../../components/ThemeLook";
import ThemePacksAdmin from "../../../../components/ThemePacksAdmin";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

// One place for the whole look of the website: the themes (packages), the fine settings (colours, fonts, popups, buttons, screens),
// the logos and pictures, and the layout of the e-mails.
function ThemeAdmin() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const brandingOn = useModule("branding"), commOn = useModule("communication"), themeOn = useModule("theme");
  const [msg, setMsg] = useState(null);
  const tabs = [
    themeOn && lvl(user, "theme") >= 1 && ["packs", "Thema's", <IconGrid key="p" />],
    themeOn && lvl(user, "theme") >= 1 && ["look", "Vormgeving", <IconPalette key="l" />],
    themeOn && lvl(user, "theme") >= 1 && ["layout", "Layout", <IconGrid key="y" />],
    themeOn && lvl(user, "theme") >= 1 && ["loader", "Laden", <IconRocket key="r" />],
    brandingOn && lvl(user, "branding") >= 1 && ["brand", "Logo's & beeld", <IconImage key="b" />],
    commOn && lvl(user, "communication") >= 1 && ["email", "E-mail", <IconMail key="e" />],
  ].filter(Boolean);
  const tab = tabs.find((t) => t[0] === params.get("tab"))?.[0] || tabs[0]?.[0];
  const go = (k) => router.replace(`/dashboard/admin/theme?tab=${k}`, { scroll: false });

  if (!tab) return <p className="muted">{tx("Je hebt geen rechten voor het thema van de website.")}</p>;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Thema")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("De hele uitstraling van de website op één plek: thema's, kleuren en vormen, popups en knoppen, logo's en afbeeldingen en de opmaak van e-mails.")}</p>
        </div>
      </div>
      <Tabs value={tab} onChange={go} tabs={tabs} />
      <div style={{ marginTop: "1rem" }}>
        {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
        {tab === "packs" && <ThemePacksAdmin />}
        {tab === "look" && <ThemeLook />}
        {tab === "layout" && <ThemeLayout />}
        {tab === "loader" && <LoaderAdmin canEdit={lvl(user, "theme") >= 2} />}
        {tab === "brand" && <BrandingAdmin />}
        {tab === "email" && <EmailLayoutAdmin canEdit={lvl(user, "communication") >= 2} onMessage={setMsg} />}
      </div>
    </>
  );
}

export default function ThemePage() {
  return <Suspense fallback={null}><ThemeAdmin /></Suspense>;
}
