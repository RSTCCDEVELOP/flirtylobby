export const money = (v, currency = "EUR") => new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(Number(v));
export const ORDER_STATUS = {
  new: ["Nieuw", "off"], pending_payment: ["Wacht op betaling", "off"], paid: ["Betaald", "ok"], processing: ["In behandeling", "ok"],
  shipped: ["Verzonden", "ok"], completed: ["Afgerond", "ok"], canceled: ["Geannuleerd", "off"], refunded: ["Terugbetaald", "off"],
};
