// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EnergyNetworkPanel from "./EnergyNetwork";
import EnergySettingsPanel from "./EnergySettings";
import Tabs from "./Tabs";
import { IconBolt, IconGlobe } from "./Icons";
import { tx } from "../lib/t";

// Super admin → Green metingen: tab 1 is this website (the calculation model, the measuring and the API with the address and key to give to a main portal), tab 2 the other websites that are read and their combined figures.
export default function EnergyGreen({ initial = "site" }) {
  const q = useSearchParams();
  const [tab, setTab] = useState(q.get("tab") === "sites" ? "sites" : initial);
  useEffect(() => { if (q.get("tab") === "sites") setTab("sites"); }, [q]);
  return (
    <>
      <div className="page-head"><div><h1>{tx("Green metingen")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("De energie en uitstoot van deze website, en het totaalbeeld van alle websites die je koppelt.")}</p></div>
        <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}><Link className="btn" href="/dashboard/admin/energy">{tx("Metingen en advies")}</Link></span></div>
      <Tabs value={tab} onChange={setTab} tabs={[["site", "Deze site", <IconBolt key="a" />], ["sites", "Andere sites", <IconGlobe key="b" />]]} />
      <div style={{ marginTop: "1rem" }}>
        {tab === "site" ? <EnergySettingsPanel showApi /> : <EnergyNetworkPanel />}
      </div>
    </>
  );
}
