// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";

// A widget of the library (<source>/widgets/): its own document in a sandboxed iframe (scripts only: no access to the page, the cookies or the login). The widget tells its height
// (postMessage) and the frame follows it. `doc` = the whole html of the widget (the server fills in the options); `height` = the height before the widget has told its own.
export default function WidgetFrame({ doc, height = 200, title = "", inert = false, className = "" }) {
  const ref = useRef(null);
  const [h, setH] = useState(height);
  useEffect(() => {
    const on = (e) => { if (ref.current && e.source === ref.current.contentWindow && e.data && typeof e.data.widgetHeight === "number") setH(Math.min(Math.max(Math.ceil(e.data.widgetHeight), 40), 1600)); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  if (!doc) return null;
  return <iframe ref={ref} className={`widget-frame ${className}`} title={title || "Widget"} sandbox="allow-scripts" srcDoc={doc} loading="lazy" style={{ width: "100%", height: h, border: 0, display: "block", background: "transparent", ...(inert ? { pointerEvents: "none" } : {}) }} />;
}
