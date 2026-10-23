// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// "GO" in the help: go to a page and open the right tab and block there. The help sets the wish here, the page that opens picks it up:
// <Tabs> switches to the tab and <Collapsible> opens the block (and scrolls to it). It counts for a few seconds, so a pop-up opened later is left alone.
let wish = null;
const LIFE = 10000;

export function setDeepLink({ tab = [], open = [] } = {}) {
  wish = { tab, open, at: Date.now() };
  if (typeof window !== "undefined") window.dispatchEvent(new Event("deeplink")); // a page that is already open picks it up too
}

export function deepLink() {
  if (!wish || Date.now() - wish.at > LIFE) { wish = null; return null; }
  return wish;
}
