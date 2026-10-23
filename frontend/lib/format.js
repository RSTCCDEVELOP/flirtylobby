// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

export const money = (v, currency = "EUR") => new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(Number(v));
export const ORDER_STATUS = {
  new: ["Nieuw", "off"], pending_payment: ["Wacht op betaling", "off"], paid: ["Betaald", "ok"], processing: ["In behandeling", "ok"],
  shipped: ["Verzonden", "ok"], completed: ["Afgerond", "ok"], canceled: ["Geannuleerd", "off"], refunded: ["Terugbetaald", "off"],
};
