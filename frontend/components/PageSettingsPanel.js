// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { lvl } from "../lib/perms";
import { tx } from "../lib/t";
import { useModules } from "./Modules";
import PageSettingsModal from "./PageSettingsModal";
import { useSession } from "./Session";

// The settings of the page that you are editing (name, address, menu, page layout, security, SEO, background ...), in the panel at the left of the editor:
// the same screen as Admin > Pagina's, without the window.
export default function PageSettingsPanel({ lead = null }) {
  const { user, editing } = useSession();
  const mods = useModules();
  const path = usePathname() || "/";
  const router = useRouter();
  const [data, setData] = useState(null); // {page, langs}
  const [msg, setMsg] = useState("");
  const allowed = editing && user && !path.startsWith("/dashboard") && mods?.pages !== false && lvl(user, "pages") >= 2;
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    Promise.all([api("/pages/"), api("/languages/")]).then(([{ pages }, langs]) => {
      if (!live) return;
      const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
      const page = pages.find((p) => p.path === clean);
      if (page) setData({ page, langs }); else setMsg(tx("Deze pagina staat niet in Admin → Pagina's, dus er zijn geen pagina-instellingen."));
    }).catch((e) => live && setMsg(errorText(e)));
    return () => { live = false; };
  }, [allowed, path]);
  if (!allowed) return lead;  // (no rights for the page settings: only the layout settings)
  return (
    <div className="pgs-panel">
      {msg && <p className="muted">{msg}</p>}
      {!data && lead}
      {data && <PageSettingsModal docked lead={lead} key={data.page.key} page={data.page} languages={data.langs.languages} defaultLang={data.langs.default} canSeo={mods?.seo !== false && lvl(user, "seo") >= 1} onClose={() => {}} onSaved={() => router.refresh()} />}
    </div>
  );
}
