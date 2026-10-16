// Who may see a profile photo (per photo)
export const PHOTO_VISIBILITY = [
  ["public", "Openbaar", "Iedereen die je pagina mag zien"],
  ["members", "Portal", "Alleen ingelogde leden"],
  ["private", "Privé", "Wazig tot je toegang geeft of jullie vrienden zijn"],
  ["hidden", "Onzichtbaar", "Alleen jij"],
];
export const visibilityOptions = (privateAllowed) => PHOTO_VISIBILITY.filter(([v]) => v !== "private" || privateAllowed);
export const visibilityHint = (v) => PHOTO_VISIBILITY.find(([k]) => k === v)?.[2] || "";
