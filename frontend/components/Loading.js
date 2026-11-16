// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useUi } from "./Ui";
import { LoaderArt } from "./PageLoader";

// "Laden…" as an animation in the style of the active theme (the loader that is set under Admin > Website > Thema: ring, dots, bar, ...). The text stays for screen readers.
export default function Loading({ size = 30 }) {
  const ui = useUi() || {};
  const kind = ui.loader_style || "ring";
  return (
    <span role="status" aria-live="polite" aria-label={tx("Laden…")} data-easy2edit-tag="ui-loading" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: ".5rem" }}>
      <LoaderArt kind={kind} size={kind === "image" ? Number(ui.loader_image_size) || size * 1.5 : size} image={ui.loader_image_url} anim={ui.loader_image_anim} look={ui} />
    </span>
  );
}
