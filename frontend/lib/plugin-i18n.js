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
