// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import EnergyBadge from "./EnergyBadge";

// At the bottom of every page: the easy2edit logo with "© easy2edit <year>" (can be switched off in Admin -> Overzicht -> Over easy2edit) and, when the administrator switched it on
// (Admin -> Energie), the energy label: a click shows the insights of the website and the green status.
export default function SiteCredit({ show, url, badge }) {
  const on = !!badge?.enabled;
  if (!show && !on) return null;
  return (
    <div className="site-credit">
      <div className="site-credit-pill">
        {show && (
          <a href={/^https:\/\//.test(url || "") ? url : "https://easy2edit.com"} target="_blank" rel="noopener noreferrer" className="site-credit-link">
            <img src="/logos/easy2edit/icon.png" alt="" width={18} height={18} className="site-credit-icon" />
            <span>powered by © easy2edit {new Date().getFullYear()}</span>
          </a>
        )}
        {on && <EnergyBadge b={badge} />}
      </div>
    </div>
  );
}
