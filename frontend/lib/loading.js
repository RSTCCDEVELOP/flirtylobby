// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// What the page is still building after the browser says "loaded": the design of the page, the frames of plugins (the products of the shop) ...
// The loader over the page stays until all of it is done. holdLoader() returns the function that says "this part is ready";
// a part that never reports is let go after maxMs, so the loader is never stuck.
let pending = 0;

export function holdLoader(maxMs = 8000) {
  if (typeof window === "undefined") return () => {};
  let done = false;
  pending += 1;
  const release = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    pending = Math.max(0, pending - 1);
  };
  const timer = setTimeout(release, maxMs);
  return release;
}

// still busy? Also the pictures that are in view and not there yet.
export function loaderBusy() {
  if (pending > 0) return true;
  if (typeof document === "undefined") return false;
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.width > 0; };
  return Array.from(document.images).some((i) => !i.complete && inView(i)) || Array.from(document.querySelectorAll("video")).some((v) => v.preload !== "none" && v.readyState < 2 && !v.error && inView(v)); // a video in view (the hero) counts as well: until its first picture is there
}
