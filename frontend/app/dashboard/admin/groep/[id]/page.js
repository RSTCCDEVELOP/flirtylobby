"use client";

import { useParams } from "next/navigation";
import GroupTiles from "../../../../../components/GroupTiles";

export default function AdminGroup() {
  const { id } = useParams();
  return <GroupTiles id={String(id)} />;
}
