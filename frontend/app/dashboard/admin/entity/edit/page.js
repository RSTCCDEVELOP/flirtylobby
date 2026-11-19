// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../../components/AuthContext";
import { EMPTY_ENTITY, EntityForm } from "../../../../../components/EntityList";
import { IconBack } from "../../../../../components/Icons";
import { Busy } from "../../../../../components/PageLoader";
import { api, errorText } from "../../../../../lib/api";
import { loadEntity } from "../../../../../lib/entity";
import { lvl } from "../../../../../lib/perms";
import { tx } from "../../../../../lib/t";

// One entity on its own screen (the list is the page before it). id in the address = edit, no id = a new entity.
function Edit() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { user } = useAuth();
  const canEdit = lvl(user, "entities") >= 2;
  const [init, setInit] = useState(null);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const m = await api("/entity/");
        setMeta(m);
        if (!id) { setInit({ ...EMPTY_ENTITY, user_ids: [], group_ids: [] }); return; }
        const d = await api(`/entities/${id}/`);
        setInit({ id: d.id, own: d.is_own, ...EMPTY_ENTITY, ...d.data, color: d.color || "", kind: d.kind, kind_name: d.kind_name, user_ids: d.users.map((u) => u.id), group_ids: d.groups.map((g) => g.id) });
      } catch (e) { setErr(errorText(e)); }
    })();
  }, [id]);
  const back = () => router.push("/dashboard/admin/entity");
  if (err) return <div className="alert">{err}</div>;
  if (!init || !meta) return <Busy />;
  return (
    <>
      <div className="page-head">
        <div>
          <button type="button" className="btn" onClick={back}><IconBack width={14} height={14} /> {tx("Terug naar de lijst")}</button>
          <h1 style={{ marginTop: ".6rem" }}>{init.id ? init.name || tx("Entiteit") : tx("Nieuwe entiteit")}</h1>
        </div>
      </div>
      <EntityForm init={init} kinds={meta.kinds} variables={meta.variables} canEdit={canEdit} onClose={back} onSaved={() => { if (init.own) { loadEntity(true); window.dispatchEvent(new Event("entity-changed")); } back(); }} />
    </>
  );
}

export default function EntityEditPage() {
  return <Suspense fallback={<Busy />}><Edit /></Suspense>;
}
