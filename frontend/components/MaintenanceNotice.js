"use client";

import { useEffect, useState } from "react";
import { getLanguage, tx } from "../lib/t";
import { Logo } from "./BrandingContext";
import { EditableText, EditModeSwitch } from "./EditMode";
import PageBlocks from "./PageBlocks";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

// The notice of the maintenance mode (editable in edit mode by whoever may edit: title, text and blocks): logo, name, the message in the language of the visitor and the flags to change language.
// The message per language is set in Admin -> Basisgegevens (also translated by Claude); without one the standard text is shown, translated by the system.
export default function MaintenanceNotice({ site }) {
  const [lang, setLang] = useState("nl");
  useEffect(() => {
    setLang(getLanguage());
    const on = (e) => setLang(e?.detail || getLanguage());
    window.addEventListener("langchange", on);
    return () => window.removeEventListener("langchange", on);
  }, []);
  const m = site?.maintenance_messages || {};
  const expired = !!site?.license_expired;
  const text = expired ? tx("De licentie van deze website is verlopen. Neem contact op met de beheerder.") + (site?.contact_email ? ` ${site.contact_email}` : "") : m[lang] || m[(lang || "").split("-")[0]] || (lang === "nl" ? site?.maintenance_message : "") || m.nl || site?.maintenance_message || tx("We zijn bezig met onderhoud. Probeer het straks opnieuw.");
  return (
    <>
      <div className="login-theme"><EditModeSwitch /><LanguageSwitcher flags /><ThemeToggle /></div>
      <Logo className="maintenance-logo" />
      <EditableText id="maintenance.title" as="h1" fallback={site?.site_name || ""} />
      {expired ? <p>{text}</p> : <EditableText id="maintenance.body" as="p" rich fallback={text} />}
      <PageBlocks pageKey="onderhoud" />
      <p style={{ marginTop: "1.5rem" }}><a href="/login" className="muted" style={{ fontSize: ".85rem" }}>{tx("Beheerder? Inloggen")}</a></p>
    </>
  );
}
