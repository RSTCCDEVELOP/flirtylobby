// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mediaUrl } from "../lib/api";

// A page that was taken over 1 to 1 from an html file (Site importeren): its own html, css and scripts run in a frame without any rights
// on this site (no cookies, no login, no access to the page around it); the frame grows with its content and its links open the site.
export default function DesignFrame({ html, title }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(900);
  const id = `d${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // the same on the server and in the browser: the frame sends its height with this name
  const doc = useMemo(() => {
    const src = String(html || "").replaceAll("__MEDIA__/", mediaUrl("/media/"));
    const tail = `<style>html,body{overflow-y:hidden!important}</style><script>(function(){var id=${JSON.stringify(id)};function send(){var b=document.body,e=document.documentElement;parent.postMessage({design:id,h:Math.max(b?b.scrollHeight:0,e.scrollHeight)},"*")}
document.querySelectorAll("a[href]").forEach(function(a){var h=a.getAttribute("href")||"";if(h&&h.charAt(0)!=="#"&&!/^javascript:/i.test(h))a.target="_top"});
window.addEventListener("load",send);window.addEventListener("resize",send);if(window.ResizeObserver)new ResizeObserver(send).observe(document.body);setInterval(send,1500);})();<\/script>`;
    return /<\/body>/i.test(src) ? src.replace(/<\/body>/i, `${tail}</body>`) : src + tail;
  }, [html, id]);
  useEffect(() => {
    const on = (e) => { if (e.source === ref.current?.contentWindow && e.data?.design === id) setHeight(Math.max(200, Math.min(60000, Number(e.data.h) || 600))); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [id]);
  return <iframe ref={ref} title={title || "Pagina"} srcDoc={doc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation" style={{ display: "block", width: "100%", height, border: 0 }} />;
}
