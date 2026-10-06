import { createRoot } from "react-dom/client";
import SwitchManager from "../app/(admin)/infrastructure/switch-manager/SwitchManager";
import css from "../app/(admin)/infrastructure/switch-manager/switch-manager.css";

import appearance from "../app/(admin)/infrastructure/switch-manager/appearance.css";

// Shadow DOM keeps the portal theme and command-center styles independent.
const host = document.getElementById("switch-manager-root");
if (host) {
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `:host { display:block; min-width:0; }
    *, *::before, *::after { box-sizing:border-box; }
    button,input,select,textarea { font:inherit; }
    ${css}
    ${appearance}
    .sm-ops-dock, .sm-operations { left:var(--switch-portal-offset, 0px) !important; }
  `;
  const mount = document.createElement("div");
  mount.className = "switch-manager-shell";
  // The portal owns light/dark/system resolution. Mirror its resolved class,
  // including OS preference changes, without remounting jobs or URL selection.
  const syncAppearance = () => {
    mount.dataset.smTheme = document.documentElement.classList.contains("dark-style")
      ? "dark" : "light";
  };
  syncAppearance();
  new MutationObserver(syncAppearance).observe(document.documentElement, {
    attributes: true, attributeFilter: ["class"],
  });
  shadow.append(style, mount);
  createRoot(mount).render(<SwitchManager initialTimestamp={new Date().toISOString()} />);
}
