// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The texts of a plugin in the language of the visitor. The plugin's own translations (lang/<code>.json) come first, then the system's texts (tx).
// Texts with {0}, {1} also match a message that is already filled in (an error from the plugin).
const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

export function makeTranslator(dict, fallback) {
  const templates = Object.keys(dict || {}).filter((k) => /\{\d+\}/.test(k)).map((k) => ({ k, re: new RegExp("^" + esc(k).replace(/\\?\{(\d+)\\?\}/g, "(.+?)") + "$", "s") }));
  return (text) => {
    if (dict && dict[text]) return dict[text];
    for (const { k, re } of templates) {
      const m = re.exec(text);
      if (m) return dict[k].replace(/\{(\d+)\}/g, (_, i) => (m[Number(i) + 1] !== undefined ? m[Number(i) + 1] : `{${i}}`));
    }
    return fallback(text);
  };
}
