// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Who may see a profile photo (per photo)
export const PHOTO_VISIBILITY = [
  ["public", "Openbaar", "Iedereen die je pagina mag zien"],
  ["members", "Portal", "Alleen ingelogde leden"],
  ["private", "Privé", "Wazig tot je toegang geeft of jullie vrienden zijn"],
  ["hidden", "Onzichtbaar", "Alleen jij"],
];
export const visibilityOptions = (privateAllowed) => PHOTO_VISIBILITY.filter(([v]) => v !== "private" || privateAllowed);
export const visibilityHint = (v) => PHOTO_VISIBILITY.find(([k]) => k === v)?.[2] || "";
