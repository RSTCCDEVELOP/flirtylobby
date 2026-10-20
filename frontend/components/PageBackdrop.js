"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { mediaUrl } from "../lib/api";

// Background picture or video of the current page (set per page in Admin -> Pagina's -> Instellingen, taken from the media library).
// Sits behind the page; a dark layer on top keeps the text readable.
export default function PageBackdrop({ map }) {
  const path = usePathname() || "/";
  const bg = map?.[path] || (path.length > 1 ? map?.[path.replace(/\/$/, "")] : null);
  useEffect(() => {
    document.body.dataset.pagebg = bg ? "1" : "";
    return () => { delete document.body.dataset.pagebg; };
  }, [bg]);
  if (!bg) return null;
  return (
    <div className="page-bg" aria-hidden="true">
      {bg.type === "video"
        ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline />
        : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />}
      <div className="page-bg-shade" style={{ opacity: bg.overlay }} />
    </div>
  );
}
