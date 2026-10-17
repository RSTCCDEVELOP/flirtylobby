// UI translations. The Dutch text itself is the key: t("Opslaan") -> "Save" when the language is English.
// Dictionaries live in public/locales/<code>.json ({ "Dutch text": "translation" }); a missing entry falls back to the Dutch text.
// Keys with {0}, {1} … are templates: t("Maximaal {0} foto's", 10). Messages from the API (already filled in) are matched against those templates too.
let LANG = "nl";
let DICT = {};
let TEMPLATES = []; // [{ re, key }]

const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

function build(dict) {
  DICT = dict || {};
  TEMPLATES = Object.keys(DICT)
    .filter((k) => /\{\d+\}/.test(k))
    .map((k) => ({ key: k, re: new RegExp("^" + esc(k).replace(/\\?\{(\d+)\\?\}/g, "(?<g$1>.+?)") + "$", "s") }));
}

export function setLanguage(code, dict) {
  LANG = code || "nl";
  build(code === "nl" ? {} : dict);
}
export const getLanguage = () => LANG;

const fill = (s, args) => s.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m));

export function t(text, ...args) {
  if (typeof text !== "string" || !text) return text;
  if (LANG === "nl") return args.length ? fill(text, args) : text;
  const hit = DICT[text];
  if (hit !== undefined) return fill(hit, args);
  if (!args.length) {
    for (const { key, re } of TEMPLATES) {
      const m = re.exec(text);
      if (m) return fill(DICT[key], Object.keys(m.groups).sort().map((g) => m.groups[g]));
    }
  }
  return args.length ? fill(text, args) : text;
}

// Translate the label-like strings inside an API response (module names, field labels, …). Content written by members is left alone.
const LABEL_KEYS = new Set(["label", "desc", "hint", "detail", "description", "subtitle", "status_label", "level_name", "placeholder", "summary", "message"]);
export function translateTree(data) {
  if (LANG === "nl" || !data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(translateTree);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") out[k] = LABEL_KEYS.has(k) ? t(v) : v;
    else out[k] = typeof v === "object" ? translateTree(v) : v;
  }
  return out;
}

export async function loadDictionary(code) {
  if (!code || code === "nl") return {};
  try {
    const r = await fetch(`/locales/${code}.json`, { cache: "force-cache" });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}
export const tx = t; // short alias used in the UI code (a local variable named t is common)
