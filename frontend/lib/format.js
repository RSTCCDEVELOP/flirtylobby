// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

let siteCurrency = "EUR"; // the currency of the website (Admin -> System -> Basisgegevens); set by <SiteCurrency /> in the layout
export const setSiteCurrency = (c) => { if (/^[A-Z]{3}$/.test(c || "")) siteCurrency = c; };
export const money = (v, currency) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: currency || siteCurrency }).format(Number(v));
export const ORDER_STATUS = {
  new: ["Nieuw", "off"], pending_payment: ["Wacht op betaling", "off"], paid: ["Betaald", "ok"], processing: ["In behandeling", "ok"],
  shipped: ["Verzonden", "ok"], completed: ["Afgerond", "ok"], canceled: ["Geannuleerd", "off"], refunded: ["Terugbetaald", "off"],
};
