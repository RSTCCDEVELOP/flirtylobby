// Small pill on every page while the sandbox is on (set up in Admin -> Sandbox)
export default function SandboxBadge({ status }) {
  if (!status?.banner) return null;
  return <div className="sandbox-badge" title="Externe koppelingen zijn gesimuleerd">SANDBOX</div>;
}
