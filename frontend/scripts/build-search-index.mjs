// Builds public/search-index.json for the dashboard search: every Dutch UI text (tx("…")) on the dashboard pages, with the page it
// lives on and its translations in all other languages (public/locales/*.json), so a search finds a setting in any language.
// Runs before dev and build (npm predev / prebuild).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dash = join(root, "app/dashboard");

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// translations per Dutch text, from every locale
const locales = Object.fromEntries(readdirSync(join(root, "public/locales")).filter((f) => f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(root, "public/locales", f), "utf8"))]));
const translations = (nl) => [...new Set(Object.values(locales).map((d) => d[nl]).filter((x) => x && x !== nl))].join("|");

const unescape = (s) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, " ");
const ok = (s) => s.length >= 3 && s.length <= 160 && /\p{L}{2}/u.test(s) && !/[{}<>]|^https?:|^\//.test(s);

const entries = new Map(); // "href\0text" -> [text, href, translations, isPage]
const add = (text, href, page = 0) => {
  text = text.trim();
  if (!ok(text)) return;
  const key = `${href}\0${text}`;
  if (!entries.has(key) || page) entries.set(key, [text, href, translations(text), page]);
};

// 1) the dashboard pages
for (const file of walk(dash).filter((f) => f.endsWith(`${sep}page.js`))) {
  const route = "/" + relative(join(root, "app"), file).split(sep).slice(0, -1).join("/");
  if (route.includes("[")) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\btx\(\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g)) add(unescape(m[2]), route);
}

// 2) the menu: page names
const shell = readFileSync(join(root, "components/DashboardShell.js"), "utf8");
for (const m of shell.matchAll(/href:\s*"(\/dashboard[^"]*)",\s*label:\s*"([^"]+)"/g)) add(m[2], m[1], 1);

const out = [...entries.values()];
writeFileSync(join(root, "public/search-index.json"), JSON.stringify(out));
console.log(`search index: ${out.length} entries`);
