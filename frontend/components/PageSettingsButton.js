"use client";

import { tx } from "../lib/t";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  if (!editing || !user || path.startsWith("/dashboard") || mods?.pages === false || lvl(user, "pages") < 2) return null;

  async function open() {
    setBusy(true);
    try {
      const [{ pages }, langs] = await Promise.all([api("/pages/"), api("/languages/")]);
      const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
      const page = pages.find((p) => p.path === clean);
      if (!page) await alertDialog(tx("Deze pagina staat niet in Admin → Pagina's, dus er zijn geen pagina-instellingen."));
      else setData({ page, langs });
    } catch (e) { await alertDialog(errorText(e)); }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="page-settings-btn" onClick={open} disabled={busy} title={tx("Pagina-instellingen")} aria-label={tx("Pagina-instellingen")}>
        <IconSettings width={20} height={20} />
      </button>
      {data && (
        <PageSettingsModal page={data.page} languages={data.langs.languages} defaultLang={data.langs.default} canSeo={mods?.seo !== false && lvl(user, "seo") >= 1}
          onClose={() => setData(null)} onSaved={() => { setData(null); router.refresh(); }} />
      )}
    </>
  );
}
