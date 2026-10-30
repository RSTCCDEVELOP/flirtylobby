// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { softRefresh } from "../lib/softrefresh";
import PluginFrame from "./PluginFrame";
import { api, errorText } from "../lib/api";
import { alertDialog } from "../lib/dialog";
import { lvl } from "../lib/perms";
import { IconSettings } from "./Icons";
import { useModules } from "./Modules";
import PageSettingsModal from "./PageSettingsModal";
import { useSession } from "./Session";

// Edit mode: icon at the top right of every public page that opens the settings of that page
// (name, SEO, background from the media library) — the same pop-up as in Admin -> Pagina's.
export default function PageSettingsButton() {
  const { user, editing } = useSession();
  const mods = useModules();
  const path = usePathname() || "/";
  const router = useRouter();
  const [data, setData] = useState(null); // {page, langs}
  const [busy, setBusy] = useState(false);
  const [shop, setShop] = useState(false); // the page of one product: its settings are the layout of the webshop (Webshop → Layout → Productpagina)
  const timer = useRef(null);
  if (!editing || !user || path.startsWith("/dashboard") || mods?.pages === false || lvl(user, "pages") < 2) return null;

  async function open() {
    setBusy(true);
    try {
      const [{ pages }, langs] = await Promise.all([api("/pages/"), api("/languages/")]);
      const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
      const page = pages.find((p) => p.path === clean);
      if (!page && /^\/producten\/[^/]+$/.test(clean)) setShop(true);
      else if (!page) await alertDialog(tx("Deze pagina staat niet in Admin → Pagina's, dus er zijn geen pagina-instellingen."));
      else setData({ page, langs });
    } catch (e) { await alertDialog(errorText(e)); }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="page-settings-btn" onClick={open} disabled={busy} title={tx("Pagina-instellingen")} aria-label={tx("Pagina-instellingen")}>
        <IconSettings width={20} height={20} />
      </button>
      {shop && typeof document !== "undefined" && createPortal(
        <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) setShop(false); }}>
          <div className="pb-objpop" role="dialog" aria-label={tx("Productpagina")} style={{ width: "min(1100px, 100%)" }}>
            <div className="pb-objhead"><strong>{tx("Productpagina")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={() => setShop(false)} aria-label={tx("Sluiten")}>×</button></div>
            <PluginFrame name="webshop" file="web/admin.html" bare keep route={{ params: {}, query: { layout: "page" } }} onWrite={() => { clearTimeout(timer.current); timer.current = setTimeout(softRefresh, 700); }} />
          </div>
        </div>, document.body)}
      {data && (
        <PageSettingsModal page={data.page} languages={data.langs.languages} defaultLang={data.langs.default} canSeo={mods?.seo !== false && lvl(user, "seo") >= 1}
          onClose={() => setData(null)} onSaved={() => { setData(null); router.refresh(); }} />
      )}
    </>
  );
}
