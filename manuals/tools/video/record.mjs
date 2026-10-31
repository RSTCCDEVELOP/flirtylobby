// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Records the screen of Easy2edit for an instruction video: every step is a page with actions (a visible mouse pointer moves to an element and clicks) while frames are taken
// (about 5 per second). Writes <outDir>/step-N/frames.txt (ffmpeg concat list). Called by manuals/tools/video/make_video.py:   node record.mjs plan.json
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const plan = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9400 + Math.floor(Math.random() * 500), profile = `/tmp/e2e-video-rec-${port}`;  // an own port and profile every time: a Chrome of the run before that is still closing must not be used
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--ignore-certificate-errors", "--hide-scrollbars", `--window-size=${plan.width},${plan.height}`, "--disable-gpu", "--no-first-run", "about:blank"], { stdio: "ignore" });
const stop = () => { try { chrome.kill(); } catch {} };
process.on("exit", stop);
async function connect() { for (let i = 0; i < 50; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch {} await sleep(200); } throw new Error("Chrome did not start"); }
const ws = new WebSocket(await connect()); await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map(); const listeners = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { res, rej } = wait.get(d.id); wait.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else listeners.forEach((f) => f(d)); };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => (await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true })).result?.value;
async function go(url) { const loaded = new Promise((r) => { const f = (d) => { if (d.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(f), 1); r(); } }; listeners.push(f); setTimeout(r, 15000); }); await send("Page.navigate", { url }); await loaded; }

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: plan.width, height: plan.height, deviceScaleFactor: 1, mobile: false });
await go(`${plan.base}/login`); await sleep(800);
await ev(`localStorage.setItem("token", ${JSON.stringify(plan.token)}); localStorage.setItem("lang", ${JSON.stringify(plan.lang)});`);

const ANON = `(()=>{const re=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g;const w=document.createTreeWalker(document.body,4);const ns=[];while(w.nextNode())ns.push(w.currentNode);ns.forEach(n=>{re.lastIndex=0;if(re.test(n.nodeValue)){re.lastIndex=0;n.nodeValue=n.nodeValue.replace(re,"name@example.com")}})})()`;
const HIDE = `(()=>{let s=document.getElementById("rec-hide");if(!s){s=document.createElement("style");s.id="rec-hide";document.head.appendChild(s)}s.textContent=".overlay{display:none!important}"})()`;
// notices that come on their own (licence, welcome, sandbox ...) are hidden: every pop-up that is there before the first action is one of them; a pop-up that an action opens is shown
const HIDE_PRE = `(()=>{document.querySelectorAll(".overlay").forEach(x=>{if(!x.dataset.pre){x.dataset.pre="1"}});document.querySelectorAll(".overlay[data-pre]").forEach(x=>{x.style.display="none"})})()`;
const HIDE_PRE_ONLY = `(()=>{document.querySelectorAll(".overlay[data-pre]").forEach(x=>{x.style.display="none"})})()`;
// the pointer and the click ripple (drawn in the page, so they are in the pictures)
const CURSOR = `(()=>{if(document.getElementById("rec-cur"))return;const s=document.createElement("style");s.textContent="#rec-cur{position:fixed;z-index:2147483647;left:${plan.width / 2}px;top:${plan.height / 2}px;width:26px;height:26px;pointer-events:none;transition:left .7s cubic-bezier(.4,0,.2,1),top .7s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}#rec-rip{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #f2823f;pointer-events:none;opacity:0}@keyframes rip{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(4)}}.rec-ring{outline:3px solid #f2823f!important;outline-offset:3px;border-radius:8px}";document.head.appendChild(s);const c=document.createElement("div");c.id="rec-cur";c.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 9-7 2 4 8-3 1.5-4-8-6 5z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';document.body.appendChild(c);const r=document.createElement("div");r.id="rec-rip";document.body.appendChild(r)})()`;
const find = (t, sel = "button,a,[role=tab],label,summary") => `(()=>{const t=${JSON.stringify(String(t).toLowerCase())};const all=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(x=>x.offsetParent!==null);const e=all.find(x=>(x.textContent||"").trim().toLowerCase()===t)||all.find(x=>(x.textContent||"").trim().toLowerCase().startsWith(t));if(!e)return null;e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();window.__rec=e;return {x:r.left+Math.min(r.width/2,60),y:r.top+r.height/2}})()`;
const findSel = (sel) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();window.__rec=e;return {x:r.left+r.width/2,y:r.top+r.height/2}})()`;

async function act(a) {
  const lang = plan.lang;
  const pick = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v[lang] || v.en : v);
  if (a.wait) return sleep(a.wait);
  if (a.scroll) return ev(`window.scrollBy({top:${a.scroll},behavior:"smooth"})`);
  let pos = null;
  if (a.clickText) { for (const t of [].concat(pick(a.clickText))) { pos = await ev(find(t, a.sel)); if (pos) break; } }
  else if (a.click) pos = await ev(findSel(a.click));
  else if (a.point) pos = await ev(findSel(a.point));
  if (!pos) { console.warn("  no element for", JSON.stringify(a)); return; }
  await ev(`(()=>{const c=document.getElementById("rec-cur");c.style.left=${pos.x}+"px";c.style.top=${pos.y}+"px"})()`);
  await sleep(800);
  if (a.click || a.clickText) {
    await ev(`(()=>{const r=document.getElementById("rec-rip");r.style.left=${pos.x}+"px";r.style.top=${pos.y}+"px";r.style.animation="none";void r.offsetWidth;r.style.animation="rip .6s ease-out";window.__rec&&window.__rec.click()})()`);
  } else await ev(`window.__rec&&window.__rec.classList.add("rec-ring")`); // point: only show it
}

let nstep = 0;
for (const s of plan.steps) {
  nstep += 1;
  const dir = join(plan.outDir, `step-${nstep}`); mkdirSync(dir, { recursive: true });
  await go(`${plan.base}${s.path}`); await sleep(s.settle || 3500);
  await ev(CURSOR); await ev(s.keep ? HIDE_PRE : HIDE);
  let acted = false;
  const lines = []; const t0 = Date.now(); const todo = [...(s.actions || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  let frame = 0, last = 0, lastFile = "";
  while (true) {
    const now = (Date.now() - t0) / 1000;
    if (now >= s.duration) break;
    while (todo.length && (todo[0].at || 0) <= now) { acted = true; await act(todo.shift()); }
    await ev(s.keep ? (acted ? HIDE_PRE_ONLY : HIDE_PRE) : HIDE); await ev(ANON);
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 });
    const t = (Date.now() - t0) / 1000; const f = `f${String(++frame).padStart(5, "0")}.jpg`;
    writeFileSync(join(dir, f), Buffer.from(r.data, "base64"));
    if (lastFile) lines.push(`file '${lastFile}'`, `duration ${(t - last).toFixed(3)}`);
    last = t; lastFile = f;
    await sleep(Math.max(0, 200 - (Date.now() - t0 - t * 1000)));
  }
  if (lastFile) lines.push(`file '${lastFile}'`, `duration ${Math.max(0.2, s.duration - last).toFixed(3)}`, `file '${lastFile}'`);
  writeFileSync(join(dir, "frames.txt"), lines.join("\n") + "\n");
  console.log("step", nstep, "frames", frame);
}
stop(); process.exit(0);
