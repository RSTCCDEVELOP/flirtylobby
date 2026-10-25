// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { movedFor, subscribeMoved } from "../lib/moved";
import { mediaUrl } from "../lib/api";
import { LOGO_SETS } from "../lib/logos";
import { ImageEdit } from "./EditMode";

const BrandingContext = createContext({ assets: {}, photos: [], previewLogoSet: () => {} });
const assetUrl = (p) => (p.startsWith("/logos/") ? p : mediaUrl(p)); // built-in sets are served by the frontend

// Branding comes from the server layout, so logos render without flashing the default.
// `logoSet` = the logo the active theme asks for (rstcc | studio2 | custom). The Vormgeving page can preview one.
export function BrandingProvider({ value, logoSet, siteName, children }) {
  const [preview, setPreview] = useState(undefined);
  const active = preview !== undefined ? preview : logoSet;
  const ctx = useMemo(() => {
    const base = value || { assets: {}, photos: [] };
    const set = LOGO_SETS[active] || (base.assets?.logo ? null : LOGO_SETS.easy2edit);  // no own logo and no known set: the logo of the default theme (Easy2edit)
    return { ...base, assets: set ? { ...base.assets, ...set.assets } : base.assets, alt: siteName || set?.alt, previewLogoSet: (v) => setPreview(v === null ? undefined : v) };
  }, [value, active, siteName]);
  return <BrandingContext.Provider value={ctx}>{children}</BrandingContext.Provider>;
}
export const useBranding = () => useContext(BrandingContext);

export function Logo({ className = "", alt }) {
  const { assets, alt: setAlt } = useBranding();
  alt = alt || setAlt || "Studio2";
  const light = assets.logo ? assetUrl(assets.logo) : "/logos/easy2edit/logo.png";
  const dark = assets.logo_dark ? assetUrl(assets.logo_dark) : null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={alt} className={`${className} logo-light ${dark ? "has-dark" : ""}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {dark && <img src={dark} alt={alt} className={`${className} logo-dark`} />}
    </>
  );
}

export function HomePhotos() {
  const { photos } = useBranding();
  const [, tick] = useState(0);
  useEffect(() => subscribeMoved(() => tick((n) => n + 1)), []);
  if (!photos.length || movedFor("home")?.has("home.photos")) return null; // a designed start page (a standard installation) replaces the home photos
  return (
    <div className={`home-photos n${Math.min(photos.length, 4)}`}>
      {photos.map((p) => (
        <figure key={p.id}>
          <ImageEdit target={`photo:${p.id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(p.url)} alt={p.caption || ""} loading="lazy" />
          </ImageEdit>
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
