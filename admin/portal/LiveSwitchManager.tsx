"use client";

import { DeviceNetwork, type NetworkContext } from "./NetworkContext";
import { ClusterNetwork, useFleet, type ResourceLink } from "./ClusterFleet";
import { DeviceDirectory, DirectoryFilters, InventoryDetails, deviceRows, emptyFilters, matches, validPort, type SwitchPort } from './DeviceDirectory';
import ResponsiveInspector from './ResponsiveInspector';
import { useCallback, useEffect, useRef, useState } from "react";
import { Cable, CheckCircle2, ChevronRight, Clock3, LockKeyhole, Power, RefreshCw, RotateCw, ShieldCheck, Zap } from "lucide-react";

type Device = { label: string; workload: string; expected_mac: string; quality: string; locked: boolean };
type Port = SwitchPort;
type Inspection = { network_context?: NetworkContext; resources?: ResourceLink[]; port: string; link: string; access_vlan: number | null; macs: string[]; poe_enabled: boolean | null;
  poe_status: string | null; watts: number | null; volts: number | null; amps: number | null; fault: string | null;
  collected_at: string; stale?: boolean; refresh_error?: string; refreshing?: boolean; device: Device; protected: string; evidence: Record<string, string> };
type Operation = { id: string; port: string; action: string; state: string; actor: string; source: string; created_at: string;
  preview: { device: Device; macs: string[]; access_vlan: number | null; interruption: string; collected_at: string };
  result: string; evidence: { stage: string; at: string; port?: Inspection; message: string }[] };
type Snapshot = { resources?: ResourceLink[]; stale?: boolean; refresh_error?: string; host: string; collected_at: string; ports: Port[]; operations: Operation[] };

const date = (v: string) => v ? new Date(v).toLocaleTimeString() : "Not collected";
const active = (s: string) => ["queued", "running", "recovery"].includes(s);

export default function LiveSwitchManager({ endpoint, csrf }: { endpoint: string; csrf: string }) {
  const {devices, error: fleetError, networks, networkSource} = useFleet(endpoint);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [networkOpen, setNetworkOpen] = useState(() => new URLSearchParams(location.search).get('view') === 'network');
  const directory = useRef<HTMLElement>(null);
  const rack = useRef<HTMLElement>(null);
  const network = useRef<HTMLDetailsElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState(() => { const port = new URLSearchParams(location.search).get("port"); return validPort(port) ? port : ""; });
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [preview, setPreview] = useState<Operation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tray, setTray] = useState(() => new URLSearchParams(location.search).get('view') === 'activity');
  const [accepted, setAccepted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const operations = useRef<HTMLElement>(null);
  const sequence = useRef(0);
  const mounted = useRef(true);

  const api = useCallback(async <T,>(port?: string, body?: object): Promise<T> => {
    const response = await fetch(endpoint + (port ? `?port=${encodeURIComponent(port)}` : ""), {
      method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
      headers: body ? { "Content-Type": "application/json", "X-CSRFToken": csrf } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({ error: "Session expired or server unavailable. Reload and sign in." }));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data as T;
  }, [endpoint, csrf]);

  const refresh = useCallback(async () => {
    const data = await api<Snapshot>();
    if (mounted.current) { setSnapshot(data); }
  }, [api]);

  const inspect = useCallback(async (port: string, force = false) => {
    if (!validPort(port)) return;
    const ticket = ++sequence.current;
    if (!force) setInspection(null); setPreview(null); setAccepted(false);
    try {
      const data = await api<Inspection>(port, force ? { operation: "refresh", port } : undefined);
      if (mounted.current && ticket === sequence.current) { setInspection(data.device ? data : null); setError(data.refresh_error || (data.refreshing ? "A refresh is already in progress." : "")); }
    } catch (e) { if (mounted.current && ticket === sequence.current) setError((e as Error).message); }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => setError(e.message));
    const timer = setInterval(() => { setNow(Date.now()); void refresh().catch(e => setError(e.message)); }, 5000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => { void inspect(selected); }, 0);
    return () => clearTimeout(timer);
  }, [selected, inspect]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const ticket = sequence.current;
      try {
        const data = await api<Inspection>(selected);
        if (!cancelled && ticket === sequence.current && data.device) setInspection(data);
      } catch { /* Retain the last observed reading during transport failures. */ }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [api, selected]);
  useEffect(() => {
    const legacyTarget = () => {
      const view = new URLSearchParams(location.search).get('view');
      if (view === 'network') setNetworkOpen(true);
      if (view === 'activity') setTray(true);
      requestAnimationFrame(() => {
        const target = view === 'fleet' ? directory.current : view === 'network' ? network.current : view === 'activity' ? operations.current : view === 'rack' ? rack.current : null;
        target?.scrollIntoView({ block: 'start' });
      });
    };
    const changed = () => {
      const port = new URLSearchParams(location.search).get('port');
      ++sequence.current;
      setSelected(validPort(port) ? port : ''); setSelectedDevice(''); setInspection(null); setPreview(null); setAccepted(false); setError(''); setSheetOpen(true);
      legacyTarget();
    };
    legacyTarget();
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);
  const attention = (snapshot?.operations || []).filter(job => active(job.state) || job.state === 'failed' || (job.state === 'preview' && job.source === 'Alshival')).map(job => `${job.id}:${job.state}`).join(',');
  useEffect(() => { if (attention) setTray(true); }, [attention]);
  useEffect(() => {
    if (preview) {
      setSheetOpen(false); setTray(true);
      requestAnimationFrame(() => { operations.current?.scrollIntoView({ block: 'start' }); operations.current?.focus({ preventScroll: true }); });
    }
  }, [preview]);
  const previousActive = useRef(false);
  useEffect(() => {
    const running = snapshot?.operations.some(j => active(j.state)) || false;
    if (previousActive.current && !running) queueMicrotask(() => { void inspect(selected, true); });
    previousActive.current = running;
  }, [snapshot, selected, inspect]);

  const choose = (port: string, device = '') => {
    if (busy) return;
    ++sequence.current;
    setSelected(port); setSelectedDevice(device); setInspection(null); setPreview(null); setAccepted(false); setError(''); setSheetOpen(true);
    if (port === selected && port) void inspect(port);
    const url = new URL(location.href);
    url.searchParams.delete('view');
    if (port) url.searchParams.set('port', port); else url.searchParams.delete('port');
    if (url.href !== location.href) history.pushState({}, '', url);
  };
  const prepare = async (action: string) => {
    if (!selected) return;
    setBusy(true); setError(""); setPreview(null); setAccepted(false); setTray(true);
    try { setPreview(await api<Operation>(undefined, { operation: "prepare", port: selected, action })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!preview || !accepted) return;
    setBusy(true); setError("");
    try {
      await api<Operation>(undefined, { operation: preview.source === "Alshival" ? "approve" : "execute", id: preview.id });
      setPreview(null); setAccepted(false); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const stale = !snapshot?.collected_at || snapshot.stale || now - Date.parse(snapshot.collected_at) > 900000;
  const selectedStale = !inspection?.collected_at || inspection.stale || now - Date.parse(inspection.collected_at) > 900000;
  const selectedDevices = devices.filter(device => device.port === selected);
  const running = snapshot?.operations.some(j => active(j.state));
  const protectedPort = inspection?.protected || snapshot?.ports.find(p => p.port === selected)?.protected;
  const disabled = !selected || busy || !!running || !!protectedPort || !!inspection?.device.locked || stale || selectedStale || !!error;

  const rows = deviceRows(snapshot?.ports || [], devices);
  const filteredRows = rows.filter(row => matches(row, filters));
  const matchingPorts = new Set(filteredRows.map(row => row.port?.port));
  const filtering = Object.entries(filters).some(([key,value]) => value !== emptyFilters[key as keyof typeof filters]);
  const unassigned = !selected ? devices.find(device => device.id === selectedDevice) : undefined;
  const selectedOutside = (selected || selectedDevice) && !filteredRows.some(row => selected ? row.port?.port === selected : row.device?.id === selectedDevice);
  const orderedPorts = [...(snapshot?.ports || [])].sort((a, b) => Number(a.port.split("/")[2]) - Number(b.port.split("/")[2]));
  const ethernetPorts = orderedPorts.filter(p => Number(p.port.split("/")[2]) <= 48);
  const sfpPorts = orderedPorts.filter(p => Number(p.port.split("/")[2]) > 48);
  const renderPort = (p: Port) => <button key={p.port} aria-label={`Port ${p.port}, ${p.link}, VLAN ${p.vlan}${p.protected ? ", protected" : ""}`} aria-pressed={selected === p.port}
          className={`sl-port ${p.link === "up" ? "sl-up" : ""} ${selected === p.port ? "sl-selected" : ""} ${filtering && !matchingPorts.has(p.port) ? "sl-filter-muted" : ""}`} onClick={() => choose(p.port)}>
          <span className="sl-port-jack"><i/><i/><i/><i/></span><strong>{p.port.split("/")[2]}</strong><small>{p.mode === "access" ? `V${p.vlan}` : "TRUNK"}</small><small>{p.link === "up" ? "Up" : p.link === "down" ? "Down" : "Unknown"}</small>
          {p.protected && <LockKeyhole size={11} className="sl-lock"/>}</button>;

  return <main className="sl-app">
    <header className="sl-header">
      <div><p className="sl-eyebrow">INFRASTRUCTURE / ARUBA</p><h1>Switch Manager <span className={stale || error ? "sl-badge sl-warning" : "sl-badge"}>{stale || error ? "Unavailable / stale" : "Cached readings"}</span></h1>
        <p>Cluster inventory, network context, and port control.</p></div>
      <span className="sl-badge">Automatic refresh · 15 minutes</span>
    </header>
    {snapshot?.resources?.length ? <nav aria-label="Infrastructure resources">{snapshot.resources.map(resource=><a key={resource.id} className="sl-resource-link" href={resource.url}>{resource.name}</a>)}</nav> : null}
    {(error || snapshot?.refresh_error) && <div role="alert" className="sl-alert">{error || snapshot?.refresh_error} Last successful readings are retained. Use Refresh port to retry.</div>}
    <div className="sl-status"><span><ShieldCheck size={16}/> Switch · {snapshot?.host || "Not observed"}</span><span>{snapshot?.ports.length ?? "—"} ports · {devices.length} recorded devices</span><span>{snapshot ? `Observed ${date(snapshot.collected_at)}` : "Connecting…"}</span></div>

    {fleetError&&<p role="status" className="sl-warning">{fleetError}</p>}
      <section ref={rack} className="sl-rack sl-compact-rack" aria-label="Live switch ports">
        <div className="sl-rack-title"><div><p className="sl-eyebrow">ARUBA 6200F</p><h2>Ports &amp; connections</h2></div><Cable size={28}/></div>
        <p className="sl-hint">48 Ethernet ports · odd numbers above even numbers. Scroll horizontally on smaller screens.</p>
        <div className="sl-port-scroll" role="region" aria-label="48 Ethernet ports" tabIndex={0}>
          <div className="sl-port-grid">{ethernetPorts.map(renderPort)}</div>
        </div>
        {sfpPorts.length > 0 && <div className="sl-sfp"><p className="sl-eyebrow">SFP UPLINKS</p><div className="sl-sfp-grid">{sfpPorts.map(renderPort)}</div></div>}
        <div className="sl-legend"><span><i/> Link up</span><span>Up / Down · observed link</span><span><LockKeyhole size={12}/> Protected</span></div>
        <details ref={network} className="sl-vlan-overview" open={networkOpen} onToggle={e => setNetworkOpen(e.currentTarget.open)}><summary>VLAN overview</summary>
          <ClusterNetwork ports={orderedPorts} devices={devices} choose={choose} networks={networks} networkSource={networkSource} compact selectedVlan={filters.vlan} setVlan={vlan => setFilters(previous => ({ ...previous, vlan }))}/>
        </details>
      </section>
    <div className="sl-workspace">
      <section ref={directory} className="sl-fleet sl-directory" aria-label="Device directory">
        <div className="sl-section-heading"><div><p className="sl-eyebrow">CONNECTED INVENTORY</p><h2>Devices &amp; ports</h2></div><span className="sl-badge">{filteredRows.length} results</span></div>
        <DirectoryFilters filters={filters} setFilters={setFilters} ports={orderedPorts}/>
        <DeviceDirectory rows={filteredRows} selected={selected} selectedDevice={selectedDevice} choose={choose}/>
      </section>
      <ResponsiveInspector active={sheetOpen && !!(selected || unassigned)} close={() => setSheetOpen(false)}>
        {error && <p role="alert" className="sl-alert">{error}</p>}
        {!selected && !unassigned ? <div className="sl-empty"><Cable size={28}/><h2>Select a port or device</h2><p>Inspect identity, addresses, capacity and power from one place.</p></div> : <>
        {selectedOutside && <p className="sl-hint">Selected item is outside the current filters.</p>}
        {unassigned ? <><p className="sl-eyebrow">UNASSIGNED INVENTORY</p><h2>{unassigned.inventory.title}</h2><p>{unassigned.inventory.role}</p><p className="sl-warning">No observed switch port. Power controls are unavailable.</p><InventoryDetails devices={[unassigned]}/><DeviceNetwork context={unassigned.network_context}/></> : <>
        <div className="sl-section-heading"><div><p className="sl-eyebrow">PORT INSPECTOR</p><h2>{selected}</h2></div><span className="sl-badge">{inspection?.link || "Unknown"}</span></div>
        <button disabled={busy} onClick={async () => { setBusy(true); try { await inspect(selected, true); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><RefreshCw size={16}/> {busy ? "Refreshing…" : "Refresh port"}</button>
        {inspection?.resources?.map(resource=><p key={resource.id}><a className="sl-resource-link" href={resource.url}>Open resource · {resource.name}</a></p>)}
        {inspection ? <>
          <p className="sl-hint">Cached switch readings · refreshed every 15 minutes</p>
          {inspection.refresh_error && <p role="status" className="sl-warning">{inspection.refresh_error}</p>}
          <p className="sl-eyebrow">IDENTITY</p><h3>{inspection.device.label}</h3><p>{inspection.device.workload}</p>
          <div className={`sl-identity ${inspection.device.quality !== "verified" ? "sl-warning" : ""}`}><strong>Identity: {inspection.device.quality}{selectedStale ? " · observation stale" : ""}</strong>
            <p>{inspection.device.quality === "verified" ? "Learned MAC matches recorded inventory." : "Attached device or workload is unconfirmed. Review the physical port before removing power."}</p></div>
          <InventoryDetails devices={selectedDevices}/>
          {selectedDevices.length > 1 ? <p className="sl-warning">Multiple inventory records reference this port. Verify attachment before using host details.</p> : <DeviceNetwork context={selectedDevices[0]?.network_context || inspection.network_context}/>}
          <h3>Power &amp; switch link</h3><dl><div><dt>Access VLAN</dt><dd>{inspection.access_vlan ?? "Trunk / unavailable"}</dd></div>
            <div><dt>PoE</dt><dd>{inspection.poe_enabled === null ? "Not supported" : inspection.poe_enabled ? "Enabled" : "Disabled"} · {inspection.poe_status || "—"}</dd></div>
            <div><dt>Actual power</dt><dd>{inspection.watts ?? "—"} W</dd></div><div><dt>Voltage / current</dt><dd>{inspection.volts ?? "—"} V / {inspection.amps ?? "—"} A</dd></div>
            <div><dt>Fault</dt><dd>{inspection.fault || "—"}</dd></div><div><dt>Learned MACs</dt><dd>{inspection.macs.length ? inspection.macs.map(m => <code key={m}>{m}<br/></code>) : "None observed"}</dd></div>
            <div><dt>Observed</dt><dd>{date(inspection.collected_at)}</dd></div></dl>
          {protectedPort && <p className="sl-warning"><LockKeyhole size={14}/> {protectedPort} · power actions blocked</p>}
          <div className="sl-power"><button disabled={disabled} onClick={() => void prepare("off")}><Power size={15}/> PoE off</button><button disabled={disabled} onClick={() => void prepare("on")}><Zap size={15}/> PoE on</button>
            <button disabled={disabled || inspection.poe_status !== "delivering"} onClick={() => void prepare("cycle")}><RotateCw size={15}/> Cycle · 10s</button></div>
          <p className="sl-hint">Each action opens a fresh preview. The worker checks the port again immediately before execution.</p>
          <details><summary>Read-only command evidence</summary>{Object.entries(inspection.evidence).map(([k, v]) => <pre key={k}>{v}</pre>)}</details>
        </> : <p>No cached port reading yet. Select Refresh port or wait for the background collector.</p>}
        </>}
        </>}
      </ResponsiveInspector>
    </div>
    <section ref={operations} className="sl-operations" aria-label="Operations" tabIndex={-1}>
      <button className="sl-tray-toggle" onClick={() => setTray(!tray)} aria-expanded={tray}><Clock3 size={18}/><strong>Operations</strong><span>{running ? "Operation in progress" : `${snapshot?.operations.filter(job => job.state !== "preview").length || 0} recorded \u00b7 review & audit`}</span><ChevronRight size={16}/></button>
      {tray && <div className="sl-tray-body">
        {snapshot?.operations.filter(job => job.state === 'preview' && job.source === 'Alshival').map(job => <article key={job.id} className="sl-job"><h3>Alshival proposed PoE {job.action} / {job.port}</h3><p>{job.preview.device.label} · awaiting your review</p><button disabled={busy} onClick={() => { setPreview(job); setAccepted(false); }}>Review exact plan</button></article>)}
        {preview && <article className="sl-preview"><p className="sl-eyebrow">REVIEW BEFORE EXECUTION</p><h3>PoE {preview.action} / {preview.port}</h3><p><strong>{preview.preview.device.label}</strong> · {preview.preview.device.workload}</p>
          <p className={preview.preview.device.quality !== "verified" ? "sl-warning" : ""}>Identity {preview.preview.device.quality} · MAC {preview.preview.macs.join(", ") || "unknown"} · VLAN {preview.preview.access_vlan}</p>
          <p>{preview.preview.interruption}</p><small>Fresh observation {date(preview.preview.collected_at)} · preview expires after 2 minutes</small>
          <label className="sl-confirm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/> I reviewed this port, device, workload and interruption.</label>
          <div className="sl-actions"><button className="sl-execute" disabled={!accepted || busy || !!running || now - Date.parse(preview.created_at) > 120000} onClick={() => void execute()}>Execute PoE {preview.action}</button><button disabled={busy} onClick={() => setPreview(null)}>Cancel</button></div></article>}
        {!snapshot?.operations.length && !preview && <p className="sl-hint">Select a port to prepare a power action. Every operation records the initiating user or Alshival agent and its verification evidence.</p>}
        {snapshot?.operations.filter(j => j.state !== "preview").map(j => <article key={j.id} className="sl-job"><div className="sl-job-title"><h3>{j.port} / PoE {j.action}</h3><span className={`sl-badge ${["failed", "recovery"].includes(j.state) ? "sl-warning" : ""}`}>{j.state === "complete" && <CheckCircle2 size={13}/>} {j.state}</span></div>
          <p>{j.actor} · {j.source} · {date(j.created_at)} · {j.preview.device.label}</p><p>{j.result || "Awaiting execution and verification; this is not a success result."}</p>
          <details><summary>{j.evidence.length} verification / execution records</summary>{j.evidence.map((e, i) => <div className="sl-evidence" key={i}><strong>{date(e.at)} · {e.stage}</strong>{e.port && <p>Link {e.port.link} · PoE {e.port.poe_status} · {e.port.watts} W · MAC {e.port.macs.join(", ") || "none"}</p>}<pre>{e.message || JSON.stringify(e.port?.evidence, null, 2)}</pre></div>)}</details></article>)}
      </div>}
    </section>
  </main>;
}
