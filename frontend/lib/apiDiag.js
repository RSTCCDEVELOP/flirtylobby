// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// What is wrong when a call to the API gets no answer at all ("Failed to fetch" / "Load failed")? The browser tells nothing more, so we look:
// a request in "no-cors" mode only checks that the server can be reached (the answer stays hidden, and a missing CORS permission does not matter).
//   offline    the device has no internet
//   down       the API cannot be reached at all (the server is not running or restarts, a wrong address, DNS or certificate)
//   blocked    the API can be reached, but the real request did not get through: most likely this website is not in the list of allowed addresses (CORS) of the API
//   timeout    the API did not answer in time
export const PROBE_SECONDS = 5;

export async function diagnoseApi(base, { fetchFn = typeof fetch === "function" ? fetch : null, online = typeof navigator !== "undefined" ? navigator.onLine : true, origin = typeof window !== "undefined" ? window.location.origin : "", seconds = PROBE_SECONDS } = {}) {
  const diag = { kind: "down", base, origin, seconds };
  if (online === false) return { ...diag, kind: "offline" };
  if (!fetchFn) return diag;
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), seconds * 1000);
  try {
    await fetchFn(`${base}/api/health/`, { mode: "no-cors", cache: "no-store", signal: ctl?.signal });
    return { ...diag, kind: "blocked" };  // it can be reached, so the failure of the real call was something else (most likely CORS)
  } catch (e) {
    return { ...diag, kind: e?.name === "AbortError" ? "timeout" : "down" };
  } finally {
    clearTimeout(timer);
  }
}

// The sentence for a person (tx = the translation function; the Dutch text is the key).
export function diagText(diag, tx) {
  if (!diag) return "";
  const host = (u) => { try { return new URL(u).host; } catch { return u || ""; } };
  const api = host(diag.base), site = host(diag.origin);
  if (diag.kind === "offline") return tx("Geen verbinding met de server. Je hebt geen internetverbinding.");
  if (diag.kind === "timeout") return tx("Geen verbinding met de server. De API ({0}) antwoordt niet binnen {1} seconden.", api, diag.seconds);
  if (diag.kind === "blocked") return tx("Geen verbinding met de server. De API ({0}) is wel bereikbaar, maar het verzoek komt niet door. Waarschijnlijk staat het adres van deze website ({1}) niet in de lijst met toegestane adressen (CORS) van de API.", api, site);
  return tx("Geen verbinding met de server. De API ({0}) is niet bereikbaar: de server draait niet of wordt herstart, of het adres klopt niet.", api);
}
