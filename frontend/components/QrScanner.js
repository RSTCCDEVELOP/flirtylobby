"use client";

import { tx } from "../lib/t";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

// Camera scanner for QR codes. Uses the browser's BarcodeDetector when there is one, otherwise jsQR. Needs https (or localhost) for the camera.
export default function QrScanner({ onResult }) {
  const video = useRef(null);
  const [error, setError] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let stream, raf, stop = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setError(tx("De camera werkt alleen op een beveiligde (https) verbinding. Gebruik de code."));
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
      {error ? <div className="alert">{error}</div> : (
        <>
          <video ref={video} playsInline muted />
          <span className="scanner-frame" aria-hidden="true" />
          <small className="muted" style={{ display: "block", textAlign: "center", marginTop: ".5rem" }}>{tx("Houd de QR-code binnen het kader.")}</small>
        </>
      )}
    </div>
  );
}
