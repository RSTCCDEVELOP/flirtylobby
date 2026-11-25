// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import EnergyBadge from "./EnergyBadge";
import { IconEdit } from "./Icons";
import { useSession } from "./Session";

// At the bottom of every page: the easy2edit logo with "© easy2edit <year>" (can be switched off in Admin -> Overzicht -> Over easy2edit) and, when the administrator switched it on
// (Admin -> Energie), the energy label: a click shows the insights of the website and the green status.
export default function SiteCredit({ show, url, badge }) {
  const on = !!badge?.enabled;
  const { canEdit, editMode, setEditMode } = useSession();
  if (!show && !on && !canEdit) return null;
  return (
    <div className={`site-credit${!show && !on ? " only-edit" : ""}`}>
      <div className="site-credit-pill">
        {show && (
          <a href={/^https:\/\//.test(url || "") ? url : "https://easy2edit.com"} target="_blank" rel="noopener noreferrer" className="site-credit-link">
            <img src="/logos/easy2edit/icon.png" alt="" width={18} height={18} className="site-credit-icon" />
            <span>powered by © easy2edit {new Date().getFullYear()}</span>
          </a>
        )}
        {on && <EnergyBadge b={badge} />}
        {canEdit && ( // only shown on a page whose header is off (the edit button is in the header otherwise); only for who may edit
          <button type="button" className="site-credit-edit" onClick={() => setEditMode(!editMode)} aria-pressed={editMode} title={editMode ? tx("Bewerkmodus uitzetten") : tx("Website in bewerkmodus zetten")} aria-label={editMode ? tx("Bewerkmodus uitzetten") : tx("Website in bewerkmodus zetten")}>
            <IconEdit width={15} height={15} />
          </button>
        )}
      </div>
    </div>
  );
}
