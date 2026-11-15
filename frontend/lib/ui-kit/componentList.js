// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The list of the components of the UI-kit as text, to send with an AI prompt or with html code: every component with its easy2edit_tag.
// mode: "list" (tags and what they are), "html" (also the html of every component), "css" (also the css of the kit, so the AI can show them).
// The importer recognises data-easy2edit-tag="..." and draws the component with the colours and fonts of the theme.
export function componentListText(kit, mode = "list") {
  const comps = kit?.KIT_COMPONENTS || [];
  const head = `## easy2edit components (easy2edit_tag)
easy2edit has ready-made components. When the design needs one of them (a hero, pricing, FAQ, calendar, kanban, audio or video player, contact block, footer ...), use it:
- Wrap it in <div data-easy2edit-tag="TAG"${kit?.key ? ` data-easy2edit-set="${kit.key}"` : ""}> ... </div> with the exact easy2edit_tag from the list${kit?.key ? ` and the set key ${kit.key}` : ""}; the wrapper stays directly inside the container of its section (or is the section content itself). The importer looks at exactly these two attributes: it turns every such wrapper into ONE component block of the page, so never nest a component inside another one and never split one over two sections.
- Keep the classes (e2e-*) and the structure of the component${mode === "list" ? " (ask for the html of a component if you need it; the list below has the tags and what they are)" : " exactly as in the html below"}; change only the texts, links, numbers and pictures.
- easy2edit draws the component with the colours, fonts and corners of the chosen theme, so never hard-code colours in it, and do NOT copy the css of the components (the .e2e-* rules) into style.css: the importer ignores them and draws the component with the css of the set. Style only the rest of the page in style.css.
- Use the real texts, links, numbers and pictures of this website inside the component (pictures as <img src="img/..."> files in the ZIP); keep the number of items sensible (3 cards, 4 questions ...).
- A tag that is not in this list is not recognised: the importer then shows the html as plain code. Use only the tags below.
- Components that are not in the list are built from normal elements (sections, headings, texts, images, buttons) as described in the rules above.

Components (${comps.length}):
`;
  const root = (c) => { const m = /class="([^"]*\be2e-[a-z0-9_-]+)/.exec(c.html || ""); const cls = m ? (m[1].match(/e2e-[a-z0-9_-]+/g) || []).slice(0, 2).join(" ") : ""; return cls ? ` (classes: ${cls})` : ""; };
  const lines = comps.map((c) => `- ${c.easy2edit_tag}: ${c.name} [${c.group}] - ${c.description}${root(c)}`).join("\n");
  const htmls = mode === "list" ? "" : `\n\nHTML of the components:\n${comps.map((c) => `\n### ${c.easy2edit_tag}\n${c.html}`).join("\n")}`;
  const css = mode === "css" ? `\n\nCSS of the components (put it in style.css; the variables --e2e-* follow the theme variables of the site):\n${kit.KIT_CSS}` : "";
  return head + lines + htmls + css + "\n";
}
