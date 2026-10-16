"use client";

import { tx } from "../lib/t";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Which kind of device is this? "app" = the installed web app (standalone window), otherwise phone, tablet or computer.
export function deviceClass() {
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return "app";
  if (/iPad|Tablet/.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "tablet"; // iPadOS reports itself as a Mac
  if (/iPhone|iPod|Windows Phone/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) return "mobile";
  return "desktop";
}

const NAMES = { mobile: "een telefoon", tablet: "een iPad of tablet", desktop: "een computer", app: "de app" };

/**
 * Enforces the display settings (Vormgeving -> Weergave per apparaat) and registers the web app.
 * devices = { mobile, tablet, desktop, app } booleans. This is a display rule, not security: the pages stay reachable for crawlers.
 */
export default function DeviceGate({ devices }) {
  const path = usePathname();
  const [cls, setCls] = useState(null);
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    if (window.self !== window.top) return; // previews inside the admin are never blocked
    setCls(deviceClass());
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // service worker only while the app is switched on (needed for "install"); removed again when it is off
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (devices.app) navigator.serviceWorker.register("/sw.js").catch(() => {});
    else navigator.serviceWorker.getRegistrations().then((r) => r.forEach((x) => x.unregister())).catch(() => {});
  }, [devices.app]);

  const admin = path.startsWith("/dashboard") || path.startsWith("/login");
  if (!cls || admin || devices[cls]) return null;

  const canInstall = devices.app && (cls === "mobile" || cls === "tablet");
  return (
    <div className="device-block" role="dialog" aria-modal="true">
      <div className="card">
        <h1>{canInstall ? tx("Installeer de app") : tx("Niet beschikbaar op dit apparaat")}</h1>
        {canInstall ? (
          <>
            <p className="muted">{tx("Deze site gebruik je op")} {NAMES[cls]} {tx("als app. Installeer hem op je beginscherm.")}</p>
            {prompt && <button className="btn primary" onClick={() => prompt.prompt()}>{tx("Installeer de app")}</button>}
            <p className="muted" style={{ fontSize: ".875rem" }}>
              {/iPhone|iPad|Macintosh/.test(navigator.userAgent) ? tx("Tik op de deelknop in Safari en kies 'Zet op beginscherm'.") : tx("Open het browsermenu en kies 'App installeren' of 'Toevoegen aan startscherm'.")}
            </p>
          </>
        ) : (
          <p className="muted">{tx("Deze website is niet bedoeld voor")} {NAMES[cls]}{tx(". Probeer een ander apparaat.")}</p>
        )}
      </div>
    </div>
  );
}
