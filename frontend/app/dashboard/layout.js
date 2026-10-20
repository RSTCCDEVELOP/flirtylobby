"use client";

import { AuthProvider } from "../../components/AuthContext";
import DashboardShell from "../../components/DashboardShell";

export default function Layout({ children }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
