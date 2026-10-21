import { api } from "./api";

// Claude translates a short name into EVERY language of the system (also the ones that are off), one language at a time (3 at once) so a progress bar can follow.
// onProgress({done, total}) after each language. Returns {titles, failed}: titles has the default language plus every language that worked.
export async function translateName(text, defaultLang, onProgress) {
  const { languages } = await api("/pages/translate/", { method: "POST", body: { list: true } });
  onProgress?.({ done: 0, total: languages.length });
  const titles = { [defaultLang]: text };
  let failed = 0, next = 0, done = 0;
  const worker = async () => {
    while (next < languages.length) {
      const l = languages[next++];
      try { Object.assign(titles, (await api("/pages/translate/", { method: "POST", body: { text, codes: [l.code] } })).titles); } catch { failed++; }
      onProgress?.({ done: ++done, total: languages.length });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { titles, failed };
}
