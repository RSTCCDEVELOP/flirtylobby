// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { alertDialog } from "./dialog";
import { tx } from "./t";

// The library comes from the easy2edit server (Super admin+ -> easy2edit management -> Settings) and that server does not give it: a pop-up that says why and what to do.
// Only at installing, updating and saving; showing the library never gives an error.
export const SOURCE_TEXT = {
  blocked: "Deze website is geblokkeerd door de easy2edit-server en staat offline met een melding. Neem contact op met de beheerder van de server.",
  disconnected: "Deze website is ontkoppeld van de easy2edit-server. Verbind hem opnieuw bij Super admin+ → Site manager.",
  disabled: "De easy2edit-server heeft de site manager niet ingeschakeld. Zet op de server bij Super admin+ → Site manager de schakelaar \"Deze installatie is de easy2edit-server (site manager)\" aan en probeer het opnieuw.",
  pending: "De easy2edit-server heeft deze website nog niet goedgekeurd. Vraag een superadmin+ om hem goed te keuren in de Site manager van de server.",
  refused: "De easy2edit-server kent deze website niet of heeft hem geblokkeerd. Log hier opnieuw in als beheerder om je aan te melden, of haal de blokkade weg in de Site manager van de server.",
  unreachable: "De easy2edit-server is niet bereikbaar. Controleer het API-adres bij easy2edit beheer en probeer het later nog eens.",
};

export const showSourceNotice = (reason) => alertDialog(tx(SOURCE_TEXT[reason] || SOURCE_TEXT.unreachable), { title: tx("Bron: easy2edit-server") });

// For a catch block: true (and the pop-up is shown) when the error is "the easy2edit server cannot give the library".
export function sourceError(e) {
  const r = e?.data?.source;
  if (!r) return false;
  showSourceNotice(r);
  return true;
}
