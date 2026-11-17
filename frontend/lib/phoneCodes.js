// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Country calling codes for phone numbers: [ISO country, code]. The names come from the browser in the language that is chosen (Intl.DisplayNames).
export const DIAL = [["NL", "31"], ["BE", "32"], ["DE", "49"], ["FR", "33"], ["GB", "44"], ["IE", "353"], ["LU", "352"], ["CH", "41"], ["AT", "43"], ["ES", "34"], ["PT", "351"], ["IT", "39"], ["PL", "48"], ["CZ", "420"], ["SK", "421"], ["HU", "36"], ["RO", "40"], ["BG", "359"], ["GR", "30"], ["HR", "385"], ["SI", "386"], ["SE", "46"], ["NO", "47"], ["DK", "45"], ["FI", "358"], ["EE", "372"], ["LV", "371"], ["LT", "370"], ["UA", "380"], ["RU", "7"], ["TR", "90"], ["US", "1"], ["CA", "1"], ["MX", "52"], ["BR", "55"], ["AR", "54"], ["CL", "56"], ["CO", "57"], ["SR", "597"], ["CW", "599"], ["AW", "297"], ["AE", "971"], ["SA", "966"], ["QA", "974"], ["KW", "965"], ["IL", "972"], ["EG", "20"], ["MA", "212"], ["ZA", "27"], ["NG", "234"], ["KE", "254"], ["GH", "233"], ["IN", "91"], ["CN", "86"], ["HK", "852"], ["TW", "886"], ["JP", "81"], ["KR", "82"], ["SG", "65"], ["MY", "60"], ["ID", "62"], ["TH", "66"], ["VN", "84"], ["PH", "63"], ["AU", "61"], ["NZ", "64"]];
// the country that goes with the language that is chosen
export const LANG_COUNTRY = { nl: "NL", en: "US", ar: "AE", de: "DE", es: "ES", fr: "FR", hi: "IN", id: "ID", it: "IT", ja: "JP", pl: "PL", pt: "PT", ru: "RU", tr: "TR", uk: "UA", zh: "CN" };

const BY_CODE = [...DIAL].sort((a, b) => b[1].length - a[1].length);
// "+31 612345678" -> {iso: "NL", national: "612345678"}; no code -> {iso: null, national: the number}
export function parsePhone(v) {
  const s = String(v || "").trim();
  if (!s.startsWith("+")) return { iso: null, national: s };
  const digits = s.slice(1).replace(/\D/g, "");
  const hit = BY_CODE.find(([, c]) => digits.startsWith(c));
  return hit ? { iso: hit[0], national: digits.slice(hit[1].length) } : { iso: null, national: digits };
}
export const dialOf = (iso) => (DIAL.find((d) => d[0] === iso) || DIAL[0])[1];
export const regionName = (iso, lang) => { try { return new Intl.DisplayNames([lang || "en"], { type: "region" }).of(iso) || iso; } catch { return iso; } };
// the flag of a country: the two letters as regional indicator symbols
export const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
