// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";
import { EditableText } from "./EditMode";
import { IconEdit, IconEye } from "./Icons";
import Donate from "./Donate";
import GamesPage from "./GamesPage";
import MembersPage from "./MembersPage";
import PageBlocks from "./PageBlocks";
import Paged from "./Paged";
import Plans from "./Plans";
import { PageRouteProvider } from "./PageRoute";
import { EditOverride } from "./Session";

// A page of the website in the screen you are in (no frame): look at it, or switch to editing (drag blocks and objects, change texts and pictures) without leaving the admin.
// Only the content of the page: its title (own pages) and its blocks.
const DEVICES = [["desktop", "Computer", "100%"], ["tablet", "Tablet", "820px"], ["mobile", "Telefoon", "390px"]];

export default function PagePreview({ pageKey, title, path, withTitle = false, startEdit = false, onClose }) {
  const [edit, setEdit] = useState(startEdit);
  const [device, setDevice] = useState("desktop");
  const w = DEVICES.find(([k]) => k === device)[2];
  return (
    <div className="card page-preview">
      <div className="pp-bar">
        <strong>{title}</strong>
        {path && <small className="muted">{path}</small>}
        <span className="pp-spacer" />
        <span className="pb-seg" role="group" aria-label={tx("Bekijken of bewerken")}>
          <button type="button" className={!edit ? "on" : ""} onClick={() => setEdit(false)} title={tx("Bekijken")}><IconEye width={16} height={16} /> {tx("Bekijken")}</button>
          <button type="button" className={edit ? "on" : ""} onClick={() => setEdit(true)} title={tx("Bewerken")}><IconEdit width={16} height={16} /> {tx("Bewerken")}</button>
        </span>
        <span className="pb-seg" role="group" aria-label={tx("Weergave")}>
          {DEVICES.map(([k, l]) => <button type="button" key={k} className={device === k ? "on" : ""} onClick={() => setDevice(k)}>{tx(l)}</button>)}
        </span>
        {path && <a className="btn sm" href={path} target="_blank" rel="noreferrer">{tx("Openen")}</a>}
        <button type="button" className="btn sm" onClick={onClose}>{tx("Sluiten")}</button>
      </div>
      {edit && <small className="muted">{tx("Je bewerkt de pagina hieronder: sleep blokken en objecten, klik op een tekst of afbeelding om hem te wijzigen. Alles wordt direct opgeslagen.")}</small>}
      <EditOverride value={edit}>
        <PageRouteProvider value={{ path: path || "/", params: {}, query: {} }}>
          <div className="pp-page" style={{ width: w }}>
            {withTitle && <EditableText id={`page.${pageKey}.title`} as="h1" fallback={title} />}
            {pageKey === "games" ? <GamesPage preview /> : pageKey === "members" ? <MembersPage preview /> : (
              <>
                <PageBlocks pageKey={pageKey} title={withTitle ? "" : title} />
                {pageKey === "subscriptions" && <Paged id="plans-page" selector=".plan-grid"><Plans /></Paged>}
                {pageKey === "donations" && <Paged id="donations-page" selector=".don-grid"><Donate /></Paged>}
              </>
            )}
          </div>
        </PageRouteProvider>
      </EditOverride>
    </div>
  );
}
