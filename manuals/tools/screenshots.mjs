// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Makes the screenshots for the manual: manuals/html/en/images/<file>.jpg, from the list in manuals/tools/shots.json.
//   E2E_TOKEN=<token of a superadmin> node manuals/tools/screenshots.mjs [--refresh] [--only id,id] [--base https://localhost:5173]
// Without --refresh only the images that do not exist yet are made; with --refresh all of them are made again (so they stay up to date).
// Chrome is driven through the DevTools protocol (no extra packages). E-mail addresses in the pictures are replaced by name@example.com.
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "html", "en", "images");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n), opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt("--base", "https://localhost:5173"), lang = opt("--lang", "en"), token = process.env.E2E_TOKEN || "", refresh = flag("--refresh");
const only = (opt("--only", "") || "").split(",").filter(Boolean);
if (!token) { console.error("Set E2E_TOKEN (the token of a superadmin)."); process.exit(1); }
const shots = JSON.parse(readFileSync(join(here, "shots.json"), "utf8")).filter((s) => !only.length || only.includes(s.id));
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333, profile = "/tmp/e2e-manual-shots";
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--ignore-certificate-errors", "--hide-scrollbars", "--window-size=1440,900", "--disable-gpu", "--no-first-run", "about:blank"], { stdio: "ignore" });
const stop = () => { try { chrome.kill(); } catch {} };
process.on("exit", stop);

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}
const ws = new WebSocket(await connect());
await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map(); const listeners = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { res, rej } = wait.get(d.id); wait.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else listeners.forEach((f) => f(d)); };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => { const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true }); return r.result?.value; };
async function go(url) { const loaded = new Promise((r) => { const f = (d) => { if (d.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(f), 1); r(); } }; listeners.push(f); setTimeout(r, 15000); }); await send("Page.navigate", { url }); await loaded; }

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await go(`${base}/login`); await sleep(800);
await ev(`localStorage.setItem("token", ${JSON.stringify(token)}); localStorage.setItem("sandbox-banner-off","1"); localStorage.setItem("lang", ${JSON.stringify(lang)});`);

const ANON = `(()=>{const re=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g;const w=document.createTreeWalker(document.body,4);const ns=[];while(w.nextNode())ns.push(w.currentNode);ns.forEach(n=>{re.lastIndex=0;if(re.test(n.nodeValue)){re.lastIndex=0;n.nodeValue=n.nodeValue.replace(re,"name@example.com")}});document.querySelectorAll("input,textarea").forEach(i=>{re.lastIndex=0;if(i.type!=="password"&&re.test(i.value||"")){i.value="name@example.com"}})})()`;
const HIDE = `(()=>{let s=document.getElementById("shot-hide");if(!s){s=document.createElement("style");s.id="shot-hide";document.head.appendChild(s)}s.textContent=".overlay{display:none!important}"})()`;
// for a shot of a pop-up: hide every other pop-up (the notices that come on their own), keep the one that was opened last
const HIDE_OTHERS = `(()=>{const o=[...document.querySelectorAll(".overlay")];o.slice(0,-1).forEach(x=>{x.style.display="none"})})()`;
const clickText = (t, sel = "button,a,[role=tab],label,summary") => `(()=>{const t=${JSON.stringify(t)}.toLowerCase();const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null&&(x.textContent||"").trim().toLowerCase()===t)||[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null&&(x.textContent||"").trim().toLowerCase().startsWith(t));if(e){e.click();return true}return false})()`;

const made = [];
for (const s of shots) {
  const file = join(out, `${s.file}.jpg`);
  if (existsSync(file) && !refresh) { console.log("exists ", s.id); continue; }
  try {
    await go(`${base}${s.path}`); await sleep(s.settle || 4500);
    const here = await ev("location.pathname"); const want = s.path.split("?")[0];
    if (!here.startsWith(want)) { console.warn("skipped", s.id, "(the page opened", here + ": module or plugin is off)"); continue; }
    for (const st of s.steps || []) {
      if (st.click) await ev(`document.querySelector(${JSON.stringify(st.click)})?.click()`);
      if (st.clickText) { let ok = false; for (const t of [].concat(st.clickText)) { ok = await ev(clickText(t, st.sel)); if (ok) break; } if (!ok) console.warn("  no element with the text", st.clickText); }
      if (st.eval) await ev(st.eval);
      await sleep(st.wait || 900);
    }
    await ev(s.keep ? HIDE_OTHERS : HIDE); await ev(ANON); await sleep(300);
    const clip = s.height ? { x: 0, y: 0, width: 1440, height: s.height, scale: 1 } : undefined;
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 82, ...(clip ? { clip } : {}) });
    writeFileSync(file, Buffer.from(r.data, "base64")); made.push(s.id); console.log("made   ", s.id);
  } catch (e) { console.error("failed ", s.id, e.message); }
}
console.log(`done: ${made.length} images`);
stop(); process.exit(0);
