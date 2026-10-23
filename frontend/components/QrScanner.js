// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

// Camera scanner for QR codes. Uses the browser's BarcodeDetector when there is one, otherwise jsQR. Needs https (or localhost) for the camera.
export default function QrScanner({ onResult }) {
  const video = useRef(null);
  const [error, setError] = useState("");
  const done = useRef(false);
  const [note, setNote] = useState("");

  // Fallback that works everywhere (also on http, where the browser blocks the live camera): the phone's own camera app takes a photo of the QR code
  async function fromPhoto(file) {
    setNote("");
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, c.width, c.height);
      let text = "";
      if ("BarcodeDetector" in window) { try { text = (await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(c))[0]?.rawValue || ""; } catch {} }
      if (!text) text = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || "";
      if (text) { done.current = true; onResult(text); } else setNote(tx("Geen QR-code gevonden in de foto. Probeer het opnieuw: dichterbij, scherp en goed verlicht."));
    } catch { setNote(tx("Deze foto kon niet gelezen worden.")); }
  }
  const photoButton = (
    <label className="btn" style={{ cursor: "pointer", display: "flex", justifyContent: "center", marginTop: ".6rem" }}>
      {tx("Maak een foto van de QR-code")}
      <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fromPhoto(f); }} />
    </label>
  );

  useEffect(() => {
    let stream, raf, stop = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setError(tx("De live camera werkt alleen op een beveiligde (https) verbinding. Maak een foto van de QR-code of gebruik de code."));
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
      } catch { return setError(tx("Geen toegang tot de camera. Geef toestemming of gebruik de code.")); }
      const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
      const tick = async () => {
        if (stop || done.current) return;
        const v = video.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          let text = "";
          try {
            if (detector) text = (await detector.detect(v))[0]?.rawValue || "";
            else {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0);
              text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data || "";
            }
          } catch {}
          if (text) { done.current = true; onResult(text); return; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scanner">
      {error ? <><div className="alert">{error}</div>{photoButton}{note && <div className="alert" style={{ marginTop: ".6rem" }}>{note}</div>}</> : (
        <>
          <video ref={video} playsInline muted />
          <span className="scanner-frame" aria-hidden="true" />
          <small className="muted" style={{ display: "block", textAlign: "center", marginTop: ".5rem" }}>{tx("Houd de QR-code binnen het kader.")}</small>
          {photoButton}{note && <div className="alert" style={{ marginTop: ".6rem" }}>{note}</div>}
        </>
      )}
    </div>
  );
}
