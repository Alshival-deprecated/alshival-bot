"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
// Native URL state lets the same workspace run in Next.js and the portal bundle.
const subscribeLocation = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  window.addEventListener("switch-manager:navigate", notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("switch-manager:navigate", notify);
  };
};
const locationSnapshot = () => window.location.search;
const serverLocationSnapshot = () => "";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bot,
  Cable,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Copy,
  Cpu,
  Database,
  HardDrive,
  Layers3,
  List,
  LoaderCircle,
  Network as NetworkIcon,
  PanelBottomOpen,
  Plus,
  Power,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import {
  createDemoAdapter,
  image,
  type DemoState,
  type Device,
  type Job,
  type Observation,
  type OperationsAdapter,
  type Port,
  type View,
} from "@/lib/switch-manager/engine";

const views: { id: View; label: string; icon: typeof Server }[] = [
  { id: "rack", label: "Rack", icon: Server },
  { id: "network", label: "Network", icon: NetworkIcon },
  { id: "fleet", label: "Fleet", icon: Cpu },
  { id: "provisioning", label: "Provisioning", icon: Layers3 },
  { id: "activity", label: "Activity", icon: Activity },
];
const steps = [
  "Identify",
  "Purpose",
  "Address",
  "Prepare SD",
  "Verify boot",
  "Finish",
];
const storageKey = "alshival-switch-manager-demo-v1";
const stamp = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
const stale = (o: { quality: Observation["quality"]; collectedAt: string }) =>
  o.quality !== "current" || Date.now() - Date.parse(o.collectedAt) > 300000;
function Status({ value }: { value: string }) {
  const good = /^(ready|passed|complete|candidate)$/i.test(value);
  const warn =
    /unknown|failed|conflict|maintenance|stale|unreachable|incomplete/i.test(
      value,
    );
  const Icon = good
    ? CircleCheck
    : warn
      ? CircleAlert
      : value === "running"
        ? LoaderCircle
        : Circle;
  return (
    <span className={`sm-status ${good ? "good" : warn ? "warn" : "neutral"}`}>
      <Icon size={12} aria-hidden="true" />
      {value}
    </span>
  );
}
function Evidence({ item }: { item: Observation }) {
  return (
    <div className="sm-evidence">
      <div>
        <strong>{item.label}</strong>
        <Status
          value={
            item.quality === "current" && stale(item) ? "stale" : item.quality
          }
        />
      </div>
      <p>{item.value}</p>
      <small>
        {item.source} ·{" "}
        <time dateTime={item.collectedAt}>{stamp(item.collectedAt)}</time>
      </small>
    </div>
  );
}
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`sm-button ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export default function SwitchManager({
  initialTimestamp,
}: {
  initialTimestamp: string;
}) {
  const [adapter] = useState(() => createDemoAdapter(initialTimestamp));
  const state = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const search = useSyncExternalStore(subscribeLocation, locationSnapshot, serverLocationSnapshot);
  const params = new URLSearchParams(search);
  const view = views.some((v) => v.id === params.get("view"))
    ? (params.get("view") as View)
    : "rack";
  const portId = params.get("port") || "1/1/16";
  const selectedDevice = params.get("device");
  const selectedPort =
    (selectedDevice
      ? state.ports.find((p) => p.deviceId === selectedDevice)
      : state.ports.find((p) => p.id === portId)) ?? state.ports[15];
  const selected = state.devices.find((d) => d.id === selectedPort.deviceId);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tray, setTray] = useState(false);
  const inspectorOpen = params.get("detail") === "1";
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (inspectorOpen && window.matchMedia("(max-width: 1050px)").matches)
      inspectorRef.current?.focus();
  }, [inspectorOpen, selectedPort.id]);
  const [query, setQuery] = useState("");
  const [ram, setRam] = useState("");
  const [disk, setDisk] = useState("");
  const [sd, setSd] = useState("");
  const [vlan, setVlan] = useState("");
  const [workload, setWorkload] = useState("");
  const [capacity, setCapacity] = useState("");
  const [overlay, setOverlay] = useState("availability");
  const [table, setTable] = useState(false);
  const [topologyTable, setTopologyTable] = useState(false);
  const [moveVlan, setMoveVlan] = useState(72);
  const [moveIp, setMoveIp] = useState("192.168.72.116");
  const [actor, setActor] = useState("all");
  const [workflow, setWorkflow] = useState("all");
  const [onlySelected, setOnlySelected] = useState(false);
  const [net, setNet] = useState(selected?.vlan ?? 41);
  const [handoff, setHandoff] = useState("");
  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, val] of Object.entries(patch)) {
      if (val === null) p.delete(k);
      else p.set(k, val);
    }
    window.history.pushState(null, "", `${window.location.pathname}?${p}`);
    window.dispatchEvent(new Event("switch-manager:navigate"));
  };
  const choose = (p: Port) => {
    go({ port: p.id, device: p.deviceId, job: null, detail: "1" });
  };
  const run = (fn: () => void) => {
    setError("");
    setNotice("");
    try {
      fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The operation could not be completed.",
      );
    }
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) adapter.restore(JSON.parse(raw));
    } catch {
      /* Storage is optional; in-memory demo still works. */
    }
    const unsubscribe = adapter.subscribe(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(adapter.getSnapshot()));
      } catch {
        /* Private browsing may block storage. */
      }
    });
    const tick = window.setInterval(() => adapter.advance(), 950);
    return () => {
      unsubscribe();
      window.clearInterval(tick);
    };
  }, [adapter]);
  const devices = state.devices.filter(
    (d) =>
      (!query ||
        `${d.hostname} ${d.model} ${d.ip} ${d.mac} ${d.serial} ${d.role}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!ram || d.ram === +ram) &&
      (!sd || d.sd >= +sd) &&
      (!disk ||
        (disk === "nvme"
          ? d.nvme !== null
          : disk === "hat"
            ? d.hat && d.nvme === null
            : d.nvme === null)) &&
      (!vlan || d.vlan === +vlan) &&
      (!workload ||
        (workload === "spare"
          ? d.workload === "Unassigned"
          : d.workload !== "Unassigned")) &&
      (!capacity || d.capacity >= +capacity),
  );
  const watts = state.devices.reduce((s, d) => s + d.watts, 0);
  const activeJobs = state.jobs.filter((j) => j.state !== "complete");
  const filters = (
    <>
      <label className="sm-search">
        <Search size={15} />
        <input
          aria-label="Search fleet"
          placeholder="Hostname, IP, identity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="sm-filter-grid">
        <label>
          Memory
          <select value={ram} onChange={(e) => setRam(e.target.value)}>
            <option value="">Any RAM</option>
            {[4, 8, 16].map((n) => (
              <option key={n} value={n}>
                {n} GB
              </option>
            ))}
          </select>
        </label>
        <label>
          Storage
          <select value={disk} onChange={(e) => setDisk(e.target.value)}>
            <option value="">Any storage</option>
            <option value="nvme">NVMe detected</option>
            <option value="hat">HAT only · no drive</option>
            <option value="none">No NVMe detected</option>
          </select>
        </label>
        <label>
          SD capacity
          <select value={sd} onChange={(e) => setSd(e.target.value)}>
            <option value="">Any SD</option>
            <option value="64">64 GB or more</option>
            <option value="128">128 GB or more</option>
          </select>
        </label>
        <label>
          VLAN
          <select value={vlan} onChange={(e) => setVlan(e.target.value)}>
            <option value="">All networks</option>
            {state.networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workload
          <select
            value={workload}
            onChange={(e) => setWorkload(e.target.value)}
          >
            <option value="">Any workload</option>
            <option value="spare">Unassigned / spare</option>
            <option value="assigned">Assigned</option>
          </select>
        </label>
        <label>
          Free capacity
          <select
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          >
            <option value="">Any capacity</option>
            <option value="50">At least 50%</option>
            <option value="100">100% available</option>
          </select>
        </label>
      </div>
      <button
        className="sm-text-button"
        onClick={() => {
          setRam("");
          setDisk("");
          setSd("");
          setVlan("");
          setWorkload("");
          setCapacity("");
          setQuery("");
        }}
      >
        Clear filters
      </button>
    </>
  );
  const proposeAction = (kind: "vlan" | "poe", by: "Human" | "Alshival") =>
    run(() => {
      if (!selected) throw new Error("Select a detected device first.");
      adapter.propose({
        kind,
        actor: by,
        deviceId: selected.id,
        portId: selectedPort.id,
        ...(kind === "vlan" ? { vlan: moveVlan, ip: moveIp } : {}),
      });
      setTray(true);
      setNotice(
        "Plan added to Operations. Review its impact before execution.",
      );
    });
  const renderPort = (p: Port) => {
    const d = state.devices.find((d) => d.id === p.deviceId);
    const text = stale(p)
      ? "OLD"
      : overlay === "poe"
        ? d
          ? `${d.watts.toFixed(1)}W`
          : "—"
        : overlay === "traffic"
          ? `${p.mbps}M`
          : overlay === "vlan"
            ? `${p.vlan}`
            : d
              ? d.health === "ready"
                ? "RDY"
                : d.health === "unknown"
                  ? "?"
                  : d.health === "maintenance"
                    ? "MNT"
                    : "UP"
              : p.number === 49
                ? "UP"
                : "—";
    return (
      <button
        key={p.id}
        type="button"
        className={`sm-port ${d ? "occupied" : ""} ${stale(p) || p.health === "unknown" || p.health === "maintenance" ? "attention" : ""} ${selectedPort.id === p.id ? "selected" : ""} ${overlay === "vlan" ? `vlan-${p.vlan}` : ""}`}
        aria-label={`Port ${p.id}, ${p.type}, ${d?.hostname || (p.number === 49 ? "router uplink" : "no device detected")}, ${stale(p) ? "unknown; stale or unavailable observations" : p.health}, VLAN ${p.vlan}`}
        aria-pressed={selectedPort.id === p.id}
        onClick={() => choose(p)}
      >
        <span className="sm-port-number">
          {String(p.number).padStart(2, "0")}
        </span>
        <span className="sm-socket">
          <span />
          <span />
        </span>
        <span className="sm-port-reading">{text}</span>
      </button>
    );
  };
  const fleetTable = (items: Device[]) => (
    <div className="sm-table-wrap">
      <table className="sm-table">
        <caption className="sm-sr">
          Device inventory; all readings are demo observations.
        </caption>
        <thead>
          <tr>
            <th>Device / port</th>
            <th>Memory / storage</th>
            <th>Network</th>
            <th>Status</th>
            <th>Free</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const p = state.ports.find((p) => p.deviceId === d.id)!;
            return (
              <tr key={d.id}>
                <td>
                  <button className="sm-text-button" onClick={() => choose(p)}>
                    {d.hostname}
                  </button>
                  <small>{p.id}</small>
                </td>
                <td>
                  {d.ram} GB · {d.sd} GB SD
                  <small>
                    {d.nvme
                      ? `${d.nvme} GB NVMe detected`
                      : d.hat
                        ? "NVMe HAT only · no drive detected"
                        : "No NVMe detected"}
                  </small>
                </td>
                <td>
                  VLAN {d.vlan}
                  <small>{d.ip || "Not allocated"}</small>
                </td>
                <td>
                  <Status value={stale(p) ? "unknown" : d.health} />
                </td>
                <td>{d.capacity}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!items.length && (
        <p className="sm-empty">
          No devices match these filters. Try clearing a filter.
        </p>
      )}
    </div>
  );

  return (
    <div className="sm-app">
      <header className="sm-topbar">
        <div className="sm-breadcrumb">
          Infrastructure <ChevronRight size={13} />{" "}
          <strong>Switch Manager</strong>
        </div>
        <div className="sm-top-actions">
          <span className="sm-demo">
            <span /> Demo data
          </span>
          <Button
            label="Refresh demo readings"
            onClick={() =>
              run(() => {
                adapter.refresh();
                setNotice(
                  "New demo readings collected; unavailable collectors remain unknown.",
                );
              })
            }
          >
            <Activity size={13} />
            Refresh readings
          </Button>
          <Button
            onClick={() => {
              if (
                window.confirm(
                  "Reset all demo plans, jobs and inventory changes?",
                )
              ) {
                adapter.reset();
                setTray(false);
                setNet(41);
                setQuery("");
                setRam("");
                setDisk("");
                setSd("");
                setVlan("");
                setWorkload("");
                setCapacity("");
                setActor("all");
                setWorkflow("all");
                setOnlySelected(false);
                setHandoff("");
                setNotice("Demo reset.");
                setError("");
                go({ view: "rack", port: "1/1/16", device: null, job: null, detail: null });
              }
            }}
          >
            <RefreshCw size={13} />
            Reset demo
          </Button>
        </div>
      </header>
      <div className="sm-title-row">
        <div>
          <p className="sm-eyebrow">
            CLUSTER COMMAND CENTER <span> / 01</span>
          </p>
          <h1>
            Switch Manager<span>.</span>
          </h1>
          <p className="sm-subtitle">
            Every port. Every board. One clear picture.
          </p>
        </div>
        <Button
          primary
          onClick={() => {
            go({
              view: "provisioning",
              detail: null,
              port: state.draft.portId,
              device: null,
            });
          }}
        >
          <Plus size={16} />
          Provision a Pi
        </Button>
      </div>
      <div className="sm-metrics">
        <div>
          <span>
            <Server size={15} />
            SWITCH
          </span>
          <strong>
            Aruba 6200F <small>48G PoE+ · 4 SFP+</small>
          </strong>
        </div>
        <div>
          <span>
            <Cable size={15} />
            ATTACHED BOARDS
          </span>
          <strong>
            {state.devices.length}
            <small>/ 48 Ethernet ports</small>
          </strong>
        </div>
        <div>
          <span>
            <Zap size={15} />
            LAST-KNOWN POWER
          </span>
          <strong>
            {watts.toFixed(1)} <small>W / 740 W budget</small>
          </strong>
          <div className="sm-meter">
            <i style={{ width: `${(watts / 740) * 100}%` }} />
          </div>
        </div>
        <div>
          <span>
            <CircleCheck size={15} />
            AVAILABLE SPARES
          </span>
          <strong>
            {
              state.devices.filter(
                (d) =>
                  d.role === "General spare" &&
                  d.health === "ready" &&
                  !stale(state.ports.find((p) => p.deviceId === d.id)!),
              ).length
            }
            <small>ready for their next job</small>
          </strong>
        </div>
      </div>
      <nav className="sm-tabs" aria-label="Switch Manager views">
        {views.map((v) => (
          <button
            key={v.id}
            aria-current={view === v.id ? "page" : undefined}
            className={view === v.id ? "active" : ""}
            onClick={() => {
              go({ view: v.id, detail: null });
              if (v.id === "network" && selected) setNet(selected.vlan);
            }}
          >
            <v.icon size={16} />
            {v.label}
            {v.id === "activity" && <small>{state.activity.length}</small>}
          </button>
        ))}
        <span className="sm-local">
          <ShieldCheck size={13} />
          Simulation only · no hardware access
        </span>
      </nav>
      <div className="sm-message-zone" aria-live="polite">
        {notice && (
          <p className="sm-notice">
            <Check size={15} />
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          </p>
        )}
      </div>
      {error && (
        <p className="sm-error" role="alert">
          <CircleAlert size={16} />
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </p>
      )}
      <div className={`sm-workspace ${inspectorOpen ? "detail-open" : ""}`}>
        <section className="sm-center" aria-label={`${view} workspace`}>
          {view === "rack" && (
            <>
              <div className="sm-section-head">
                <div>
                  <p className="sm-eyebrow">PHYSICAL LAYER</p>
                  <h2>A home for every board</h2>
                </div>
                <span className="sm-mono">RACK 01 / U24</span>
              </div>
              <div className="sm-overlays">
                <span>Overlay</span>
                {["availability", "vlan", "poe", "traffic"].map((o) => (
                  <button
                    key={o}
                    aria-pressed={overlay === o}
                    onClick={() => setOverlay(o)}
                  >
                    {o === "poe"
                      ? "PoE draw"
                      : o === "vlan"
                        ? "VLAN"
                        : o.charAt(0).toUpperCase() + o.slice(1)}
                  </button>
                ))}
              </div>
              <div className="sm-rack-stage">
                <div className="sm-rack-label">
                  <span className="sm-led" /> ARUBA CORE{" "}
                  <span>6200F · JL728A</span>
                  <span className="sm-rack-live">FIXTURE TELEMETRY</span>
                </div>
                <div className="sm-switch">
                  <div className="sm-rack-ear">
                    <i />
                    <i />
                  </div>
                  <div className="sm-port-banks">
                    {[0, 12, 24, 36].map((start) => (
                      <div key={start} className="sm-port-bank">
                        <span>
                          ETHERNET {start + 1}–{start + 12}
                        </span>
                        <div>
                          {state.ports.slice(start, start + 12).map(renderPort)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="sm-rack-ear">
                    <i />
                    <i />
                  </div>
                </div>
                <div className="sm-switch-footer">
                  <div>
                    <strong>aruba</strong>
                    <span>Instant clarity. Deliberate control.</span>
                  </div>
                  <div className="sm-uplinks">
                    <span>
                      SFP+<small>10G UPLINKS</small>
                    </span>
                    {state.ports.slice(48).map(renderPort)}
                  </div>
                </div>
                <div className="sm-rack-shadow" />
              </div>
              <div className="sm-legend">
                <span>
                  <i className="ready" />
                  Ready / attached
                </span>
                <span>
                  <i className="warning" />
                  Attention / unknown
                </span>
                <span>
                  <i />
                  No device detected
                </span>
                <span>
                  <i className="selected" />
                  Selected port
                </span>
              </div>
              <p className="sm-caption">
                Aruba collector · simulated snapshot ·{" "}
                {stamp(state.ports[0].collectedAt)}. Unknown and stale readings
                remain explicit in the inspector.
              </p>
              <div className="sm-lower-grid">
                <section className="sm-card">
                  <div className="sm-section-head">
                    <h3>Needs a closer look</h3>
                    <span className="sm-count">3</span>
                  </div>
                  {[
                    {
                      port: 8,
                      title: "Storage inventory disagrees",
                      desc: "NVMe HAT present. Drive not detected.",
                    },
                    {
                      port: 24,
                      title: "Collector is unreachable",
                      desc: "Last host evidence is over 27 hours old.",
                    },
                    {
                      port: 40,
                      title: "Different board on this port",
                      desc: "Observed MAC does not match inventory.",
                    },
                  ].map((i) => (
                    <button
                      className="sm-attention-row"
                      key={i.port}
                      onClick={() => choose(state.ports[i.port - 1])}
                    >
                      <CircleAlert size={16} />
                      <span>
                        <strong>{i.title}</strong>
                        <small>{i.desc}</small>
                      </span>
                      <span className="sm-mono">:{i.port}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </section>
                <section className="sm-card sm-agent-card">
                  <div className="sm-agent-orb">
                    <Bot size={26} />
                  </div>
                  <p className="sm-eyebrow">A SHARED OPERATIONS DESK</p>
                  <h3>Alshival can take the next shift.</h3>
                  <p>
                    Preview an agent-created PoE cycle for the selected board.
                    Same checks. Same evidence. Same activity history.
                  </p>
                  <Button
                    onClick={() => proposeAction("poe", "Alshival")}
                    disabled={!selected}
                  >
                    <Bot size={15} />
                    Draft with Alshival
                    <ArrowRight size={14} />
                  </Button>
                </section>
              </div>
            </>
          )}
          {view === "fleet" && (
            <>
              <div className="sm-section-head">
                <div>
                  <p className="sm-eyebrow">COMPUTE INVENTORY</p>
                  <h2>Find the right board</h2>
                </div>
                <Button onClick={() => setTable(!table)}>
                  <List size={15} />
                  {table ? "Cards" : "Table"}
                </Button>
              </div>
              <div className="sm-card sm-filters">
                {filters}
                <Button
                  onClick={() => {
                    setRam("16");
                    setDisk("nvme");
                    setWorkload("spare");
                    setCapacity("100");
                    setSd("");
                    setVlan("");
                    setQuery("");
                  }}
                >
                  16 GB spares with NVMe <ArrowRight size={14} />
                </Button>
              </div>
              <p className="sm-caption">
                {devices.length} matching boards · Capacity and storage are
                simulated observations with source/timestamp in each inspector.
              </p>
              {table ? (
                fleetTable(devices)
              ) : (
                <div className="sm-fleet-grid">
                  {devices.map((d) => (
                    <button
                      key={d.id}
                      className={`sm-device-card ${selected?.id === d.id ? "selected" : ""}`}
                      onClick={() =>
                        choose(state.ports.find((p) => p.deviceId === d.id)!)
                      }
                    >
                      <div>
                        <span className="sm-device-icon">
                          <Cpu size={22} />
                        </span>
                        <Status
                          value={
                            stale(state.ports.find((p) => p.deviceId === d.id)!)
                              ? "unknown"
                              : d.health
                          }
                        />
                      </div>
                      <h3>{d.hostname}</h3>
                      <span className="sm-mono">
                        {d.ip || "Address pending"} · VLAN {d.vlan}
                      </span>
                      <div className="sm-device-spec">
                        <span>
                          <Database size={14} />
                          {d.ram} GB RAM
                        </span>
                        <span>
                          <HardDrive size={14} />
                          {d.sd} GB SD
                        </span>
                      </div>
                      <p>
                        {d.nvme
                          ? `${d.nvme} GB NVMe detected`
                          : d.hat
                            ? "NVMe HAT only · no drive detected"
                            : "No NVMe detected"}
                      </p>
                      <footer>
                        <span>{d.workload}</span>
                        <strong>{d.capacity}% free</strong>
                      </footer>
                    </button>
                  ))}
                  {!devices.length && (
                    <p className="sm-empty">
                      No matching boards. Clear filters to see the fleet.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {view === "network" && (
            <>
              <div className="sm-section-head">
                <div>
                  <p className="sm-eyebrow">LOGICAL LAYER</p>
                  <h2>See the boundaries</h2>
                </div>
                <Button onClick={() => setTopologyTable(!topologyTable)}>
                  <List size={15} />
                  {topologyTable ? "Topology map" : "Table alternative"}
                </Button>
              </div>
              <div className="sm-network-pills">
                {state.networks.map((n) => (
                  <button
                    aria-pressed={net === n.id}
                    key={n.id}
                    onClick={() => setNet(n.id)}
                  >
                    <ShieldCheck size={15} />
                    <span>
                      VLAN {n.id}
                      <small>{n.name}</small>
                    </span>
                  </button>
                ))}
              </div>
              {topologyTable ? (
                <>
                  <div className="sm-card">
                    <h3>Infrastructure links</h3>
                    <table className="sm-table">
                      <thead>
                        <tr>
                          <th>Node</th>
                          <th>Connection / purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>OPNsense router</td>
                          <td>Aruba SFP+ 1/1/49 · policy & gateways</td>
                        </tr>
                        <tr>
                          <td>pi-admin</td>
                          <td>Control plane · provisioning DHCP</td>
                        </tr>
                        <tr>
                          <td>Aruba core</td>
                          <td>VLANs 10, 41, 72 · 48 Ethernet ports</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {fleetTable(state.devices.filter((d) => d.vlan === net))}
                </>
              ) : (
                <Topology
                  state={state}
                  selected={selected}
                  network={net}
                  onNetwork={setNet}
                  onPort={choose}
                />
              )}
              <div className="sm-card sm-boundary">
                <ShieldCheck size={25} />
                <div>
                  <h3>
                    VLAN {net} ·{" "}
                    {state.networks.find((n) => n.id === net)!.name}
                  </h3>
                  <p>
                    {state.networks.find((n) => n.id === net)!.purpose}. Gateway{" "}
                    <code>
                      {state.networks.find((n) => n.id === net)!.gateway}
                    </code>
                    .
                  </p>
                  <p>
                    {state.networks.find((n) => n.id === net)!.isolated
                      ? "Isolation boundary: no implicit access to other client or compute segments; OPNsense policy governs routing."
                      : "Shared compute boundary: general spares and shared workloads; administration routes require explicit policy."}
                  </p>
                  <small>
                    Source: OPNsense policy fixture ·{" "}
                    {stamp(state.ports[0].collectedAt)} · simulated
                  </small>
                </div>
              </div>
              <p className="sm-caption">
                New client segments require a separate network-design handoff.
                This demo does not create network policy.
              </p>
            </>
          )}
          {view === "provisioning" && (
            <Provisioning
              state={state}
              adapter={adapter}
              run={run}
              handoff={handoff}
              setHandoff={setHandoff}
              notice={setNotice}
              openTray={() => setTray(true)}
              selectPort={(p) => go({ port: p, device: null })}
            />
          )}
          {view === "activity" && (
            <>
              <div className="sm-section-head">
                <div>
                  <p className="sm-eyebrow">ONE AUDIT TRAIL</p>
                  <h2>People and agents, together</h2>
                </div>
                <span className="sm-count">{state.activity.length} events</span>
              </div>
              <div className="sm-activity-filters">
                <label>
                  Actor
                  <select
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  >
                    <option value="all">Everyone</option>
                    <option>Human</option>
                    <option>Alshival</option>
                  </select>
                </label>
                <label>
                  Workflow
                  <select
                    value={workflow}
                    onChange={(e) => setWorkflow(e.target.value)}
                  >
                    <option value="all">All workflows</option>
                    {[
                      "inspect",
                      "provision",
                      "vlan",
                      "poe",
                      "address",
                      "identify",
                    ].map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <label className="sm-checkbox">
                  <input
                    type="checkbox"
                    checked={onlySelected}
                    onChange={(e) => setOnlySelected(e.target.checked)}
                  />
                  Selected device / {selectedPort.id}
                </label>
              </div>
              <div className="sm-timeline">
                {state.activity
                  .filter(
                    (a) =>
                      (actor === "all" || a.actor === actor) &&
                      (workflow === "all" || a.workflow === workflow) &&
                      (!onlySelected ||
                        a.portId === selectedPort.id ||
                        (selected && a.deviceId === selected.id)),
                  )
                  .map((a) => (
                    <article key={a.id}>
                      <div
                        className={`sm-event-icon ${a.actor === "Alshival" ? "agent" : ""}`}
                      >
                        {a.actor === "Alshival" ? (
                          <Bot size={17} />
                        ) : (
                          <Activity size={17} />
                        )}
                      </div>
                      <div>
                        <div className="sm-event-meta">
                          <strong>{a.actor}</strong>
                          <span>{a.workflow}</span>
                          <time dateTime={a.at}>{stamp(a.at)}</time>
                        </div>
                        <h3>{a.title}</h3>
                        <p>{a.evidence}</p>
                        <footer>
                          <Status value={a.result} />
                          <button
                            className="sm-text-button"
                            onClick={() => {
                              const p = state.ports.find(
                                (p) => p.id === a.portId,
                              );
                              if (p) choose(p);
                            }}
                          >
                            {a.portId}
                          </button>
                          {a.jobId && (
                            <button
                              className="sm-text-button"
                              onClick={() => {
                                go({ job: a.jobId! });
                                setTray(true);
                              }}
                            >
                              Inspect job <ArrowRight size={12} />
                            </button>
                          )}
                        </footer>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
        </section>
        <aside
          className="sm-inspector"
          aria-label="Device inspector"
          ref={inspectorRef}
          tabIndex={-1}
        >
          <header>
            <span className="sm-eyebrow">DEVICE INSPECTOR</span>
            <button
              className="sm-close-detail"
              aria-label="Close device inspector"
              onClick={() => {
                go({ detail: null });
              }}
            >
              <X size={18} />
            </button>
          </header>
          <div className="sm-inspector-identity">
            <div className="sm-board-art">
              <Cpu size={48} strokeWidth={1} />
              <i />
              <i />
              <i />
            </div>
            <p className="sm-eyebrow">PORT {selectedPort.id}</p>
            <h2>
              {selected?.hostname ||
                (selectedPort.number === 49
                  ? "Router uplink"
                  : "Unattached port")}
            </h2>
            <Status
              value={stale(selectedPort) ? "unknown" : selectedPort.health}
            />
            <p>
              {selected?.model || selectedPort.type}
              {selected && ` · ${selected.ram} GB`}
            </p>
          </div>
          {!selected ? (
            <div className="sm-inspector-section">
              <h3>
                {selectedPort.number === 49
                  ? "Infrastructure uplink"
                  : "No device detected"}
              </h3>
              <p>
                {selectedPort.number === 49
                  ? "10 Gbps connection to the OPNsense router. No Pi is attached."
                  : "No attached board is recorded. An empty inventory entry does not prove that a physical port is vacant."}
              </p>
              <small>
                {selectedPort.source} · {stamp(selectedPort.collectedAt)}
              </small>
              <Button
                onClick={() => {
                  run(() =>
                    adapter.updateDraft({ portId: selectedPort.id, step: 0 }),
                  );
                  go({ view: "provisioning", detail: null });
                }}
                disabled={selectedPort.type === "SFP+"}
              >
                <Plus size={14} />
                Identify a board
              </Button>
            </div>
          ) : (
            <>
              <div className="sm-inspector-section">
                <div className="sm-section-head">
                  <h3>Connection</h3>
                  <Cable size={15} />
                </div>
                <dl>
                  <dt>IP address</dt>
                  <dd>{selected.ip || "Not allocated"}</dd>
                  <dt>Network</dt>
                  <dd>
                    VLAN {selected.vlan} ·{" "}
                    {state.networks.find((n) => n.id === selected.vlan)?.name}
                  </dd>
                  <dt>Role</dt>
                  <dd>{selected.role}</dd>
                  <dt>Power</dt>
                  <dd>{selected.watts.toFixed(1)} W · PoE+</dd>
                  <dt>Link</dt>
                  <dd>{selectedPort.link}</dd>
                  <dt>SSH</dt>
                  <dd>
                    {selected.ssh === "Not enrolled"
                      ? "Not enrolled"
                      : selected.health === "unknown"
                        ? "Current reachability unknown"
                        : ["powered", "link established"].includes(
                              selected.health,
                            )
                          ? "Not verified reachable"
                          : "Identity enrolled"}
                  </dd>
                </dl>
                <small>
                  {selectedPort.source} · {stamp(selectedPort.collectedAt)}
                  <br />
                  {stale(selectedPort)
                    ? "Stale or unavailable collector; values are last known."
                    : "Fixture observation — not a live hardware reading."}
                </small>
              </div>
              <div className="sm-inspector-section">
                <h3>Board & storage</h3>
                <dl>
                  <dt>Serial</dt>
                  <dd>{selected.serial}</dd>
                  <dt>MAC</dt>
                  <dd>{selected.mac}</dd>
                  <dt>Observed MAC</dt>
                  <dd
                    className={
                      selectedPort.observedMac !== selected.mac
                        ? "sm-amber"
                        : ""
                    }
                  >
                    {selectedPort.observedMac}
                  </dd>
                  <dt>SD card</dt>
                  <dd>{selected.sd} GB nominal</dd>
                  <dt>NVMe HAT</dt>
                  <dd>{selected.hat ? "Present" : "Not recorded"}</dd>
                  <dt>NVMe drive</dt>
                  <dd>
                    {selected.nvme
                      ? `${selected.nvme} GB detected`
                      : "No drive detected"}
                  </dd>
                </dl>
                <small>
                  Inventory / Pi agent fixtures ·{" "}
                  {stamp(selected.observations[0].collectedAt)}
                </small>
              </div>
              <div className="sm-inspector-section">
                <h3>Observations & disagreements</h3>
                {selected.observations.map((o) => (
                  <Evidence key={o.id} item={o} />
                ))}
              </div>
              <div className="sm-inspector-section">
                <h3>Propose a change</h3>
                <Button onClick={() => proposeAction("poe", "Human")}>
                  <Power size={14} />
                  Preview PoE cycle
                </Button>
                <details className="sm-details">
                  <summary>
                    Move to another VLAN <ChevronDown size={14} />
                  </summary>
                  <label>
                    Target network
                    <select
                      value={moveVlan}
                      onChange={(e) => {
                        setMoveVlan(+e.target.value);
                        setMoveIp(
                          `192.168.${e.target.value}.${100 + selectedPort.number}`,
                        );
                      }}
                    >
                      {state.networks.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.id} · {n.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target address
                    <input
                      value={moveIp}
                      onChange={(e) => setMoveIp(e.target.value)}
                    />
                  </label>
                  <p>
                    Changing VLAN interrupts connectivity. Client isolation must
                    be verified before reconnecting.
                  </p>
                  <Button
                    onClick={() =>
                      run(() => {
                        adapter.checkAddress(moveIp, selected.mac);
                        setNotice(
                          "Address evidence collected. Review the result below.",
                        );
                      })
                    }
                  >
                    Check target address
                  </Button>
                  {state.addressCheck?.ip === moveIp && (
                    <AddressEvidence state={state} />
                  )}
                  <Button onClick={() => proposeAction("vlan", "Human")}>
                    Preview VLAN move
                  </Button>
                </details>
              </div>
              <div className="sm-inspector-section">
                <h3>Recent history</h3>
                {state.activity
                  .filter((a) => a.deviceId === selected.id)
                  .slice(0, 4)
                  .map((a) => (
                    <div className="sm-mini-event" key={a.id}>
                      <strong>{a.title}</strong>
                      <small>
                        {a.actor} · {stamp(a.at)}
                      </small>
                    </div>
                  ))}
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="sm-ops-dock">
        <button
          onClick={() => setTray(!tray)}
          aria-expanded={tray}
          aria-controls="sm-operations"
        >
          <PanelBottomOpen size={17} />
          <strong>Operations</strong>
          <span>
            {state.plans.filter((p) => p.status === "proposed").length} proposed
          </span>
          <span>{activeJobs.length} active</span>
          <ChevronDown size={15} className={tray ? "" : "sm-flip"} />
        </button>
        <span>
          <span className="sm-led" />
          Local simulation · changes saved in this browser
        </span>
      </div>
      {(tray || params.get("job")) && (
        <section
          id="sm-operations"
          className="sm-operations"
          aria-label="Operations Tray"
        >
          <header>
            <div>
              <p className="sm-eyebrow">OPERATIONS TRAY</p>
              <h2>Review. Run. Verify.</h2>
            </div>
            <Button
              onClick={() => {
                setTray(false);
                go({ job: null });
              }}
              label="Close Operations Tray"
            >
              <X size={17} />
            </Button>
          </header>
          <div className="sm-operations-content">
            <div>
              <h3>Proposed changes</h3>
              {state.plans
                .filter((p) => p.status === "proposed")
                .map((p) => (
                  <article className="sm-plan" key={p.id}>
                    <Status value="proposed" />
                    <strong>
                      {p.actor} · {p.kind}
                    </strong>
                    <p>{p.summary}</p>
                    <small>
                      Scope: this demo switch and board only. Authorization is
                      simulated; no live capabilities are granted.
                    </small>
                    <Button
                      primary
                      onClick={() =>
                        run(() => {
                          const j = adapter.execute(p.id);
                          go({ job: j.id });
                        })
                      }
                    >
                      Run simulated plan <ArrowRight size={14} />
                    </Button>
                  </article>
                ))}
              {!state.plans.some((p) => p.status === "proposed") && (
                <p className="sm-empty">
                  Select a device and preview a change. Nothing runs without a
                  plan.
                </p>
              )}
            </div>
            <div>
              <h3>Jobs & verification</h3>
              {state.jobs
                .filter((j) => !params.get("job") || j.id === params.get("job"))
                .map((j) => (
                  <JobCard key={j.id} job={j} adapter={adapter} run={run} />
                ))}
              {!state.jobs.length && (
                <p className="sm-empty">
                  No jobs yet. Human and Alshival jobs appear together here.
                </p>
              )}
              {params.get("job") && (
                <button
                  className="sm-text-button"
                  onClick={() => {
                    go({ job: null });
                    setTray(true);
                  }}
                >
                  Show all jobs
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function AddressEvidence({ state }: { state: DemoState }) {
  const c = state.addressCheck;
  return c ? (
    <div className={`sm-address-evidence ${c.status}`}>
      <Status value={c.status} />
      <ul>
        {c.evidence.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <small>Fixture collectors · {stamp(c.checkedAt)}</small>
    </div>
  ) : null;
}

function JobCard({
  job,
  adapter,
  run,
}: {
  job: Job;
  adapter: OperationsAdapter;
  run: (fn: () => void) => void;
}) {
  const count = job.checks.filter((c) => c.state === "passed").length;
  return (
    <article className="sm-job">
      <div className="sm-section-head">
        <strong>
          {job.actor === "Alshival" && <Bot size={15} />} {job.actor} ·{" "}
          {job.kind} · {job.portId}
        </strong>
        <Status value={job.state} />
      </div>
      <small className="sm-mono">
        {job.id.slice(0, 18)} · attempt {job.attempts}
      </small>
      <progress
        value={count}
        max={job.checks.length}
        aria-label={`${job.kind} verification progress`}
      />
      <p>
        {count} / {job.checks.length} checks passed
      </p>
      {job.state === "waiting" && (
        <div className="sm-callout">
          <Unplug size={18} />
          <div>
            <strong>Waiting for physical installation</strong>
            <p>
              The local imaging agent owns the SD write. Simulate inserting the
              prepared card and powering the board.
            </p>
            <Button primary onClick={() => run(() => adapter.install(job.id))}>
              Simulate physical installation
            </Button>
          </div>
        </div>
      )}
      <ol className="sm-checklist">
        {job.checks.map((c) => (
          <li key={c.label}>
            <span>
              {c.state === "passed" ? (
                <CircleCheck size={16} />
              ) : c.state === "failed" ? (
                <CircleAlert size={16} />
              ) : (
                <Circle size={16} />
              )}
            </span>
            <div>
              <strong>{c.label}</strong>
              <small>{c.evidence || "Waiting for observation"}</small>
              {c.collectedAt && (
                <small>
                  {c.source} · {stamp(c.collectedAt)}
                </small>
              )}
            </div>
            <Status value={c.state} />
          </li>
        ))}
      </ol>
      {job.state === "failed" && (
        <Button primary onClick={() => run(() => adapter.resume(job.id))}>
          <RefreshCw size={14} />
          Retry failed check
        </Button>
      )}
    </article>
  );
}

function Provisioning({
  state,
  adapter,
  run,
  handoff,
  setHandoff,
  notice,
  openTray,
  selectPort,
}: {
  state: DemoState;
  adapter: OperationsAdapter;
  run: (fn: () => void) => void;
  handoff: string;
  setHandoff: (s: string) => void;
  notice: (s: string) => void;
  openTray: () => void;
  selectPort: (s: string) => void;
}) {
  const f = state.draft;
  const job = state.jobs.find((j) => j.id === f.jobId);
  const device = state.devices.find(
    (d) => d.id === state.ports.find((p) => p.id === f.portId)?.deviceId,
  );
  const set = (patch: Partial<DemoState["draft"]>) =>
    run(() => adapter.updateDraft(patch));
  const next = () =>
    run(() => {
      if (f.step === 0) adapter.identify();
      if (f.step === 1 && !state.networks.some((n) => n.id === f.vlan))
        throw new Error(
          "A new client segment requires a network-design handoff.",
        );
      if (f.step === 2) {
        const d = adapter.identify();
        const p = adapter.propose({
          kind: "provision",
          actor: "Human",
          deviceId: d.id,
          portId: f.portId,
          vlan: f.vlan,
          ip: f.ip,
        });
        adapter.updateDraft({ planId: p.id });
      }
      if (f.step === 3) {
        if (!f.handoffGenerated || !f.planId)
          throw new Error("Generate and review the SD handoff first.");
        const j = adapter.execute(f.planId);
        adapter.updateDraft({ jobId: j.id });
      }
      if (f.step === 4 && job?.state !== "complete")
        throw new Error("Finish or retry all boot verification checks first.");
      adapter.updateDraft({ step: Math.min(5, f.step + 1) });
    });
  const generate = () => run(() => setHandoff(adapter.handoff()));
  const download = () =>
    run(() => {
      const text = handoff || adapter.handoff();
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `DEMO-pi-${f.portId.replaceAll("/", "-")}-handoff.txt`;
      a.click();
      URL.revokeObjectURL(url);
      notice("Demo handoff downloaded. It does not authorize disk erasure.");
    });
  return (
    <>
      <div className="sm-section-head">
        <div>
          <p className="sm-eyebrow">GUIDED PROVISIONING</p>
          <h2>A new board, without guesswork.</h2>
        </div>
        <span className="sm-count">Step {f.step + 1} / 6</span>
      </div>
      <div className="sm-provision-summary">
        <span>
          <Cpu size={15} />
          {f.model} · {f.ram} GB
        </span>
        <span>Port {f.portId}</span>
        <span>VLAN {f.vlan}</span>
        <code>{f.ip}</code>
      </div>
      <ol className="sm-stepper">
        {steps.map((s, i) => (
          <li
            key={s}
            className={f.step === i ? "active" : f.step > i ? "done" : ""}
          >
            <span>{f.step > i ? <Check size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="sm-card sm-wizard">
        {f.step === 0 && (
          <>
            <h3>Start with the physical board.</h3>
            <p>
              Scenario 02 starts on port 17: a 16 GB Pi with an NVMe HAT, no
              detected drive, an address conflict, and a recoverable package
              error.
            </p>
            <div className="sm-form-grid">
              <label>
                Switch port
                <select
                  value={f.portId}
                  disabled={!!f.jobId}
                  onChange={(e) => {
                    set({ portId: e.target.value });
                    selectPort(e.target.value);
                  }}
                >
                  {state.ports
                    .filter((p) => p.type === "Ethernet")
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.id} ·{" "}
                        {p.deviceId
                          ? state.devices.find((d) => d.id === p.deviceId)
                              ?.hostname
                          : "No device detected"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Model
                <select
                  value={f.model}
                  onChange={(e) => set({ model: e.target.value })}
                >
                  <option>Raspberry Pi 5</option>
                  <option>Raspberry Pi 4</option>
                </select>
              </label>
              <label>
                RAM
                <select
                  value={f.ram}
                  onChange={(e) => set({ ram: +e.target.value })}
                >
                  {[4, 8, 16].map((n) => (
                    <option key={n} value={n}>
                      {n} GB
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Serial
                <input
                  value={f.serial}
                  onChange={(e) => set({ serial: e.target.value })}
                />
              </label>
              <label>
                MAC address
                <input
                  value={f.mac}
                  onChange={(e) => set({ mac: e.target.value.toLowerCase() })}
                />
              </label>
            </div>
            <div className="sm-callout">
              <ShieldCheck size={19} />
              <p>
                Identity follows serial and MAC, not a switch port. An occupied
                port or mismatched identity stops the workflow.
              </p>
            </div>
          </>
        )}
        {f.step === 1 && (
          <>
            <h3>What will this board do?</h3>
            <p>
              General spares belong on VLAN 41. Existing client boundaries
              remain explicit.
            </p>
            <div className="sm-purpose-grid">
              {[
                {
                  title: "General spare",
                  vlan: 41,
                  desc: "Ready for the next workload. Recommended.",
                },
                {
                  title: "Shared workload",
                  vlan: 41,
                  desc: "Shared compute and inference.",
                },
                {
                  title: "Administration",
                  vlan: 10,
                  desc: "Collectors and cluster control.",
                },
                {
                  title: "Client / Atlas",
                  vlan: 72,
                  desc: "Existing isolated client environment.",
                },
              ].map((p) => (
                <button
                  className={f.purpose === p.title ? "selected" : ""}
                  aria-pressed={f.purpose === p.title}
                  key={p.title}
                  onClick={() =>
                    set({
                      purpose: p.title,
                      vlan: p.vlan,
                      ip: `192.168.${p.vlan}.117`,
                    })
                  }
                >
                  <ShieldCheck size={18} />
                  <strong>{p.title}</strong>
                  <small>{p.desc}</small>
                  <span>
                    VLAN {p.vlan} · gateway 192.168.{p.vlan}.1
                  </span>
                </button>
              ))}
            </div>
            <details className="sm-details">
              <summary>Need a new client segment?</summary>
              <p>
                Network-design handoff: document client identity, subnet,
                gateway, isolation rules, DHCP ownership and approved OPNsense
                policy. This is a separate workflow; no new segment is created
                here.
              </p>
            </details>
          </>
        )}
        {f.step === 2 && (
          <>
            <h3>Allocate with evidence.</h3>
            <p>
              A silent ping does not mean an address is free. Review static
              inventory, active leases and DHCP reservations together.
            </p>
            <label>
              Candidate address
              <input
                value={f.ip}
                onChange={(e) => set({ ip: e.target.value })}
              />
            </label>
            <div className="sm-button-row">
              <Button
                primary
                onClick={() =>
                  run(() => {
                    adapter.checkAddress(f.ip, f.mac);
                  })
                }
              >
                Check candidate
              </Button>
              <Button
                onClick={() =>
                  run(() => {
                    adapter.checkAddress(f.ip, f.mac, false);
                  })
                }
              >
                Simulate collector outage
              </Button>
              <Button onClick={() => set({ ip: `192.168.${f.vlan}.118` })}>
                Try .{f.vlan}.118
              </Button>
            </div>
            <AddressEvidence state={state} />
            <div className="sm-table-wrap">
              <table className="sm-table">
                <caption>Known allocations · simulated sources</caption>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Owner</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {state.addresses
                    .filter((a) => a.ip.startsWith(`192.168.${f.vlan}.`))
                    .map((a) => (
                      <tr key={a.ip + a.kind}>
                        <td>{a.ip}</td>
                        <td>
                          {a.owner}
                          <small>{a.mac}</small>
                        </td>
                        <td>
                          {a.kind}
                          <small>
                            {a.source} · {stamp(a.collectedAt)}
                          </small>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {f.step === 3 && (
          <>
            <h3>Prepare the imaging handoff.</h3>
            <p>
              The local imaging agent performs the write. This prototype only
              generates a non-executable demonstration handoff.
            </p>
            <label>
              Verified fixture image
              <select
                value={f.image}
                onChange={(e) => set({ image: e.target.value })}
              >
                <option value={image.id}>{image.name}</option>
              </select>
            </label>
            <div className="sm-image-manifest">
              <ShieldCheck size={20} />
              <div>
                <strong>{image.verified}</strong>
                <code>{image.sha256}</code>
                <small>
                  Demo checksum and key are placeholders, not a production image
                  authorization.
                </small>
              </div>
            </div>
            <div className="sm-button-row">
              <Button primary onClick={generate}>
                <Layers3 size={15} />
                Generate handoff
              </Button>
              <Button onClick={download} disabled={!f.handoffGenerated}>
                <ArrowDownToLine size={15} />
                Download
              </Button>
              <Button
                disabled={!f.handoffGenerated}
                onClick={() => {
                  const text = handoff || adapter.handoff();
                  void navigator.clipboard
                    .writeText(text)
                    .then(() => notice("Handoff copied."))
                    .catch(() =>
                      notice(
                        "Clipboard unavailable. Select the handoff text or download it.",
                      ),
                    );
                }}
              >
                <Copy size={15} />
                Copy
              </Button>
            </div>
            {(handoff || f.handoffGenerated) && (
              <textarea
                className="sm-handoff"
                aria-label="SD preparation handoff"
                readOnly
                value={
                  handoff ||
                  "Handoff was generated in a previous session. Generate it again to view or copy."
                }
              />
            )}
            <div className="sm-callout">
              <CircleAlert size={20} />
              <p>
                No target disk is selected. A real imaging agent must match
                target device path, card serial, capacity and explicit erase
                authorization, then verify image and written-card checksums.
              </p>
            </div>
          </>
        )}
        {f.step === 4 && (
          <>
            <h3>First boot, step by step.</h3>
            <p>
              Failures preserve completed checks. The simulated package-mirror
              failure can be retried safely.
            </p>
            {job && <JobCard job={job} adapter={adapter} run={run} />}
            <Button onClick={openTray}>
              <PanelBottomOpen size={15} />
              Open Operations Tray
            </Button>
          </>
        )}
        {f.step === 5 && (
          <>
            <div className="sm-finish-icon">
              <CheckCheck size={32} />
            </div>
            <h3>
              {f.finished
                ? "The board is ready for its next chapter."
                : "All checks passed. Make it official."}
            </h3>
            <p>
              {f.purpose === "General spare"
                ? "Mark this board available in the demo inventory."
                : `Assign this board to ${f.purpose}.`}
            </p>
            <div className="sm-connection">
              <Terminal size={17} />
              <code>ssh alshival@{f.ip}</code>
              <span>Demo connection details</span>
            </div>
            <div className="sm-form-grid">
              <div className="sm-preview">
                <h4>Inventory update</h4>
                <p>
                  {device?.hostname} · {f.serial}
                </p>
                <p>
                  Port {f.portId} · VLAN {f.vlan}
                </p>
                <p>
                  {f.ram} GB RAM · {device?.sd} GB SD ·{" "}
                  {device?.nvme ? `${device.nvme} GB NVMe` : "No NVMe detected"}
                </p>
                <Status
                  value={
                    f.purpose === "General spare" ? "Available" : "Assigned"
                  }
                />
              </div>
              <div className="sm-preview">
                <h4>1Password documentation preview</h4>
                <p>Title: {device?.hostname}</p>
                <p>Address: {f.ip}</p>
                <p>Reference: Infrastructure / Pi boards</p>
                <small>
                  No secret values. No external documentation or credential
                  writes.
                </small>
              </div>
            </div>
            <Button
              primary
              disabled={f.finished}
              onClick={() =>
                run(() => {
                  if (f.jobId) adapter.finish(f.jobId);
                })
              }
            >
              <CircleCheck size={16} />
              {f.finished
                ? "Inventory updated"
                : f.purpose === "General spare"
                  ? "Mark board available"
                  : "Mark board assigned"}
            </Button>
          </>
        )}
        <footer className="sm-wizard-footer">
          {f.step > 0 && f.step < 4 ? (
            <Button onClick={() => set({ step: f.step - 1 })}>Back</Button>
          ) : (
            <span />
          )}
          {f.step < 5 && (
            <Button
              primary
              onClick={next}
              disabled={f.step === 4 && job?.state !== "complete"}
            >
              {f.step === 2
                ? "Review provisioning plan"
                : f.step === 3
                  ? "Run simulated boot workflow"
                  : f.step === 4
                    ? "Review completion"
                    : "Continue"}
              <ArrowRight size={15} />
            </Button>
          )}
        </footer>
      </div>
    </>
  );
}

function Topology({
  state,
  selected,
  network,
  onNetwork,
  onPort,
}: {
  state: DemoState;
  selected?: Device;
  network: number;
  onNetwork: (n: number) => void;
  onPort: (p: Port) => void;
}) {
  const list = state.devices.filter((d) => d.vlan === network);
  const key = (fn: () => void) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  return (
    <div className="sm-topology">
      <svg
        viewBox={`0 0 800 ${400 + Math.ceil(list.length / 4) * 95}`}
        role="group"
        aria-label="Interactive network topology; use Tab and Enter to select VLANs and devices"
      >
        <defs>
          <pattern
            id="sm-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#25343a" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#sm-grid)" />
        <path
          d="M400 90 V145 M580 180 H690 V90 M400 215 V270 M140 270 H660 M140 270 V302 M400 270 V302 M660 270 V302"
          className="sm-net-path"
        />
        <g className="sm-net-node">
          <rect x="310" y="32" width="180" height="66" rx="10" />
          <text x="400" y="59">
            OPNsense
          </text>
          <text className="sm-net-sub" x="400" y="79">
            ROUTER / POLICY
          </text>
        </g>
        <g className="sm-net-node">
          <rect x="590" y="32" width="190" height="66" rx="10" />
          <text x="685" y="59">
            pi-admin
          </text>
          <text className="sm-net-sub" x="685" y="79">
            PROVISIONING DHCP
          </text>
        </g>
        <g className="sm-net-node main">
          <rect x="230" y="140" width="350" height="78" rx="12" />
          <text x="405" y="172">
            Aruba core · 6200F
          </text>
          <text className="sm-net-sub" x="405" y="196">
            48 ETHERNET / 4 SFP+ / RACK 01
          </text>
        </g>
        {state.networks.map((n, i) => (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`Select VLAN ${n.id}, ${n.name}`}
            aria-pressed={network === n.id}
            onKeyDown={key(() => onNetwork(n.id))}
            onClick={() => onNetwork(n.id)}
            className={`sm-net-node interactive ${network === n.id ? "selected" : ""}`}
          >
            <rect x={40 + i * 260} y="300" width="200" height="66" rx="10" />
            <text x={140 + i * 260} y="327">
              VLAN {n.id} · {n.name}
            </text>
            <text x={140 + i * 260} y="348" className="sm-net-sub">
              {n.gateway}
            </text>
          </g>
        ))}
        <path
          className="sm-net-path"
          d={`M${140 + state.networks.findIndex((n) => n.id === network) * 260} 366 V397`}
        />
        <rect
          x="20"
          y="397"
          width="760"
          height={Math.ceil(list.length / 4) * 95 + 10}
          rx="12"
          className="sm-net-boundary"
        />
        <text x="35" y="389" className="sm-net-boundary-label">
          VLAN {network} ·{" "}
          {state.networks.find((n) => n.id === network)?.isolated
            ? "ISOLATED BOUNDARY"
            : "SHARED COMPUTE BOUNDARY"}
        </text>
        {list.map((d, i) => {
          const x = 35 + (i % 4) * 190;
          const y = 415 + Math.floor(i / 4) * 95;
          return (
            <g
              key={d.id}
              className={`sm-net-node interactive ${selected?.id === d.id ? "selected" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`Inspect ${d.hostname}`}
              onKeyDown={key(() =>
                onPort(state.ports.find((p) => p.deviceId === d.id)!),
              )}
              onClick={() =>
                onPort(state.ports.find((p) => p.deviceId === d.id)!)
              }
            >
              <path className="sm-net-path" d={`M${x + 82} ${y - 18} V${y}`} />
              <rect x={x} y={y} width="165" height="65" rx="8" />
              <text x={x + 82} y={y + 27}>
                {d.hostname}
              </text>
              <text x={x + 82} y={y + 47} className="sm-net-sub">
                {d.ip || "ADDRESS PENDING"}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="sm-caption">
        OPNsense / Aruba / pi-admin fixtures ·{" "}
        {stamp(state.ports[0].collectedAt)}. Select a VLAN to inspect its
        members.
      </p>
    </div>
  );
}
