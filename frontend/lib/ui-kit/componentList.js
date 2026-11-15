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
  const head = `## Easy2edit components (easy2edit_tag)
Easy2edit has ready-made components. When the design needs one of them (a hero, pricing, FAQ, calendar, kanban, audio or video player, contact block, footer ...), use it:
- Wrap it in <div data-easy2edit-tag="TAG"> ... </div> with the exact easy2edit_tag from the list; the wrapper stays directly inside the container of its section (or is the section content itself).
- Keep the classes (e2e-*) and the structure of the component${mode === "list" ? " (ask for the html of a component if you need it; the list below has the tags and what they are)" : " exactly as in the html below"}; change only the texts, links, numbers and pictures.
- Easy2edit draws the component with the colours, fonts and corners of the chosen theme, so never hard-code colours in it.
- Components that are not in the list are built from normal elements (sections, headings, texts, images, buttons) as described in the rules above.

Components (${comps.length}):
`;
  const lines = comps.map((c) => `- ${c.easy2edit_tag}: ${c.name} [${c.group}] - ${c.description}`).join("\n");
  const htmls = mode === "list" ? "" : `\n\nHTML of the components:\n${comps.map((c) => `\n### ${c.easy2edit_tag}\n${c.html}`).join("\n")}`;
  const css = mode === "css" ? `\n\nCSS of the components (put it in style.css; the variables --e2e-* follow the theme variables of the site):\n${kit.KIT_CSS}` : "";
  return head + lines + htmls + css + "\n";
}
