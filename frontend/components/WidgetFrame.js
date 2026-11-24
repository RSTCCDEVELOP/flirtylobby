// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";

// A widget of the library (<source>/widgets/): its own document in a sandboxed iframe (scripts, and links that open in a new tab: no access to the page, the cookies or the login). The widget tells its height
// (postMessage) and the frame follows it. `doc` = the whole html of the widget (the server fills in the options); `height` = the height before the widget has told its own.
//
// A POPUP widget (the library widget "popup") tells {widgetPopup: "ready"}: its frame is then 0 high. After its delay it asks {widgetPopup: "open", freq}: when the visitor may see it (freq: always,
// session, once or a number of days; remembered here in the browser, as the sandboxed widget has no storage) the frame covers the screen and the widget is told to show itself. {widgetPopup: "close"}
// (or the Escape key) makes it small again. `preview` (the library, the editor lists, the edit mode) shows a popup as a plain card on the spot instead.
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const mayShow = (id, freq) => {
  try {
    if (freq === "always") return true;
    if (freq === "session") return !sessionStorage.getItem(id);
    const t = Number(localStorage.getItem(id) || 0);
    if (freq === "once") return !t;
    return !t || Date.now() - t > (Number(freq) || 1) * 86400000;
  } catch { return true; }
};
const remember = (id, freq) => { try { if (freq === "session") sessionStorage.setItem(id, "1"); else if (freq !== "always") localStorage.setItem(id, String(Date.now())); } catch { /* ok */ } };

export default function WidgetFrame({ doc, height = 200, title = "", inert = false, preview = false, className = "" }) {
  const ref = useRef(null);
  const [h, setH] = useState(height);
  const [popup, setPopup] = useState(false);  // the widget is a popup
  const [open, setOpen] = useState(false);
  const flag = inert || preview;
  const id = useRef("");
  const theme0 = useRef(typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");  // the mode of the website when the frame was made; changes are sent to the widget
  const freqRef = useRef("session");
  useEffect(() => {
    const on = (e) => {
      if (!ref.current || e.source !== ref.current.contentWindow || !e.data) return;
      const d = e.data;
      if (d.widgetBox && typeof d.widgetBox.l === "number") { ref.current.dataset.boxL = String(Math.max(0, d.widgetBox.l)); ref.current.dataset.boxR = String(Math.max(d.widgetBox.l, d.widgetBox.r)); }
      if (typeof d.widgetHeight === "number") setH(Math.min(Math.max(Math.ceil(d.widgetHeight), 40), 1600));
      if (d.widgetPopup === "ready") setPopup(true);
      if (d.widgetPopup === "open" && !flag) {
        freqRef.current = String(d.freq || "session");
        id.current = `wpopup:${d.widget}:${hash(doc || "")}`;
        if (mayShow(id.current, freqRef.current)) { setOpen(true); ref.current.contentWindow.postMessage({ widgetPopupShow: true }, "*"); }
      }
      if (d.widgetPopup === "close") { setOpen(false); remember(id.current, freqRef.current); }
    };
    const key = (e) => { if (e.key === "Escape") setOpen((o) => { if (o) remember(id.current, freqRef.current); return false; }); };
    window.addEventListener("message", on);
    window.addEventListener("keydown", key);
    const mo = new MutationObserver(() => { const t = document.documentElement.dataset.theme === "dark" ? "dark" : "light"; try { ref.current?.contentWindow?.postMessage({ widgetTheme: t }, "*"); } catch { /* ok */ } });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });  // light or dark mode of the website: the widget follows
    return () => { window.removeEventListener("message", on); window.removeEventListener("keydown", key); mo.disconnect(); };
  }, [doc, flag]);
  if (!doc) return null;
  const pre = `${theme0.current === "dark" ? "<script>document.documentElement.setAttribute('data-theme','dark')</script>" : ""}${flag ? "<script>window.WIDGET_PREVIEW=1</script>" : ""}`;
  const src = pre ? doc.replace("<body>", `<body>${pre}`) : doc;
  const style = popup && !flag
    ? (open ? { position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 100000, border: 0, background: "transparent" } : { width: 0, height: 0, border: 0, display: "block", position: "absolute", pointerEvents: "none" })
    : { width: "100%", height: h, border: 0, display: "block", background: "transparent", ...(inert ? { pointerEvents: "none" } : {}) };
  return <iframe ref={ref} className={`widget-frame ${className}`} title={title || "Widget"} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={src} loading={popup || !height ? "eager" : "lazy"} style={style} />;
}
