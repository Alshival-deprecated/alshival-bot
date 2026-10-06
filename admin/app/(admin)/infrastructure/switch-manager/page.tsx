import { Suspense } from "react";
import SwitchManager from "./SwitchManager";
import "./switch-manager.css";
import "./appearance.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Switch Manager · Alshival Admin",
  description: "Interactive infrastructure demo. No hardware operations.",
};
export default function SwitchManagerPage() {
  return (
    <Suspense
      fallback={<div className="sm-loading">Loading Switch Manager…</div>}
    >
      <SwitchManager initialTimestamp={new Date().toISOString()} />
    </Suspense>
  );
}
