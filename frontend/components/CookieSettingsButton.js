// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

export default function CookieSettingsButton({ label, className = "link-btn", event = "open-cookie-settings" }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(event))}>
      {label}
    </button>
  );
}
