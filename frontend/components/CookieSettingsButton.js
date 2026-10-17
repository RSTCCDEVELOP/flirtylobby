"use client";

export default function CookieSettingsButton({ label, className = "link-btn", event = "open-cookie-settings" }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(event))}>
      {label}
    </button>
  );
}
