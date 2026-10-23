// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { api } from "./api";

// The css of a theme made for the whole page, limited to a block (class .draft-scope) so examples can show a theme that is not in use.
export const scoped = (css) => css.replace(/html:root,html:root\[data-theme="light"\]/g, ".draft-scope").replace(/html:root\[data-theme="dark"\]/g, ".draft-scope.dark").replace(/html:root/g, ".draft-scope");

export async function scopedCss(values) {
  const r = await api("/theme/preview/", { method: "POST", body: { values } });
  if (r.fonts_url && !document.querySelector(`link[href="${r.fonts_url}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = r.fonts_url; document.head.appendChild(l); }
  return scoped(r.css);
}
