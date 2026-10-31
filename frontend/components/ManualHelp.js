// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { tx } from "../lib/t";
import { manualPage } from "../lib/manualMap";
import { IconHelp } from "./Icons";
import ManualPopup from "./ManualPopup";

// A help icon for admins and superadmins: opens the manual (HTML) in a pop-up at the chapter that belongs to this page.
export default function ManualHelp() {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const page = manualPage(pathname);
  if (!page) return null;
  return (
    <>
      <button type="button" className="btn sm manual-help" onClick={() => setOpen(true)} title={tx("Hulp: de handleiding bij deze pagina")} aria-label={tx("Hulp: de handleiding bij deze pagina")}><IconHelp /> <span>{tx("Hulp")}</span></button>
      {open && <ManualPopup page={page} onClose={() => setOpen(false)} />}
    </>
  );
}
