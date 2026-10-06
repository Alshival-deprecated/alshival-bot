import { createRoot } from "react-dom/client";
import SwitchManager from "../app/(admin)/infrastructure/switch-manager/SwitchManager";
import css from "../app/(admin)/infrastructure/switch-manager/switch-manager.css";

// Shadow DOM keeps the portal theme and command-center styles independent.
const host = document.getElementById("switch-manager-root");
if (host) {
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `:host { display:block; min-width:0; }
    *, *::before, *::after { box-sizing:border-box; }
    button,input,select,textarea { font:inherit; }
    ${css}
    .switch-manager-shell { color-scheme:dark; }
    .sm-ops-dock, .sm-operations { left:var(--switch-portal-offset, 0px) !important; }
  `;
  const mount = document.createElement("div");
  mount.className = "switch-manager-shell";
  shadow.append(style, mount);
  createRoot(mount).render(<SwitchManager initialTimestamp={new Date().toISOString()} />);
}
