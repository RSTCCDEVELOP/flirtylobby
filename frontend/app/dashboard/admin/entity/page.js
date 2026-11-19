// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import EntityList from "../../../../components/EntityList";
import { Busy } from "../../../../components/PageLoader";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

// The entities (module Entiteit) as a list like Users: the entity of the website itself (the first row) and the others that users, user groups and later orders (webshop, e-commerce) belong to.
// A row opens its own screen to edit (edit/page.js); this page only lists, searches, adds and deletes.
export default function EntityPage() {
  const { user } = useAuth();
  const [e, setE] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/entity/").then(setE).catch((x) => setMsg(errorText(x))); }, []);
  if (!e) return msg ? <div className="alert">{msg}</div> : <Busy />;
  const word = tx(e.label);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{word}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Gegevens van de {0} achter deze website en van andere bedrijven en organisaties: naam, adres, contact en registratie. Kies een rij om te bewerken. Je kunt ze in elke tekst gebruiken als variabele, zoals {1}.", word.toLowerCase(), "{{organisatie.naam}}")}</p>
        </div>
      </div>
      {!e.filled && <div className="alert" role="status" style={{ marginBottom: "1rem" }}>{tx("Er is nog geen {0} ingesteld. Vul de naam in en sla op: de creator en de teksten van de website gebruiken de gegevens.", word.toLowerCase())}</div>}
      <div className="card" style={{ padding: "1rem" }}><EntityList canEdit={lvl(user, "entities") >= 2} canManage={lvl(user, "entities") >= 3} /></div>
    </>
  );
}
