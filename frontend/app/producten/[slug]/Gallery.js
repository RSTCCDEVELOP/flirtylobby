"use client";

import { useState } from "react";

export default function ProductGallery({ images }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="gallery"><div className="main card" style={{ aspectRatio: "4/3", display: "grid", placeItems: "center" }}><span className="muted">Geen foto</span></div></div>;
  return (
    <div className="gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="main" src={images[i].url} alt={images[i].alt} />
      {images.length > 1 && (
        <div className="thumbs">
          {images.map((im, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={im.url} alt={im.alt} onClick={() => setI(n)} style={{ cursor: "pointer", borderColor: n === i ? "var(--blue)" : undefined }} />
          ))}
        </div>
      )}
    </div>
  );
}
