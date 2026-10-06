"use client";

import { ClusterFleet, ClusterNetwork, useFleet } from "./ClusterFleet";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cable, CheckCircle2, ChevronRight, Clock3, LockKeyhole, Power, RefreshCw, RotateCw, ShieldCheck, Zap } from "lucide-react";

type Device = { label: string; workload: string; expected_mac: string; quality: string; locked: boolean };
type Port = { port: string; vlan: number; mode: string; link: string; protected: string };
type Inspection = { port: string; link: string; access_vlan: number | null; macs: string[]; poe_enabled: boolean | null;
  poe_status: string | null; watts: number | null; volts: number | null; amps: number | null; fault: string | null;
  collected_at: string; device: Device; protected: string; evidence: Record<string, string> };
type Operation = { id: string; port: string; action: string; state: string; actor: string; source: string; created_at: string;
  preview: { device: Device; macs: string[]; access_vlan: number | null; interruption: string; collected_at: string };
  result: string; evidence: { stage: string; at: string; port?: Inspection; message: string }[] };
type Snapshot = { host: string; collected_at: string; ports: Port[]; operations: Operation[] };

const date = (v: string) => new Date(v).toLocaleTimeString();
const active = (s: string) => ["queued", "running", "recovery"].includes(s);

export default function LiveSwitchManager({ endpoint, csrf }: { endpoint: string; csrf: string }) {
  const {devices, error: fleetError, networks, networkSource} = useFleet(endpoint);
  const [view,setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'rack');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get("port") || "1/1/16");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [preview, setPreview] = useState<Operation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tray, setTray] = useState(true);
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

  const inspect = useCallback(async (port: string) => {
    const ticket = ++sequence.current;
    setInspection(null); setPreview(null); setAccepted(false);
    try {
      const data = await api<Inspection>(port);
      if (mounted.current && ticket === sequence.current) { setInspection(data); setError(""); }
    } catch (e) { if (mounted.current && ticket === sequence.current) setError((e as Error).message); }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => setError(e.message));
    const timer = setInterval(() => { setNow(Date.now()); void refresh().catch(e => setError(e.message)); }, 5000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => { void inspect(selected); }, 0);
    return () => clearTimeout(timer);
  }, [selected, inspect]);
  useEffect(() => {
    const changed=()=>{const params=new URLSearchParams(window.location.search);setSelected(params.get('port')||'1/1/16');setView(params.get('view')||'rack');};
    window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed);
  },[]);
  const previousActive = useRef(false);
  useEffect(() => {
    const running = snapshot?.operations.some(j => active(j.state)) || false;
    if (previousActive.current && !running) queueMicrotask(() => { void inspect(selected); });
    previousActive.current = running;
  }, [snapshot, selected, inspect]);

  const choose = (port: string) => {
    if (busy) return;
    setSelected(port); setInspection(null); setPreview(null); setAccepted(false); setError(""); setTray(true);
    const url = new URL(window.location.href); url.searchParams.set("port", port); window.history.replaceState({}, "", url);
  };
  const prepare = async (action: string) => {
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

  const stale = !snapshot || now - Date.parse(snapshot.collected_at) > 30000;
  const selectedStale = !inspection || now - Date.parse(inspection.collected_at) > 30000;
  const running = snapshot?.operations.some(j => active(j.state));
  const protectedPort = inspection?.protected || snapshot?.ports.find(p => p.port === selected)?.protected;
  const disabled = busy || !!running || !!protectedPort || !!inspection?.device.locked || stale || selectedStale || !!error;

  return <main className="sl-app">
    <header className="sl-header">
      <div><p className="sl-eyebrow">INFRASTRUCTURE / ARUBA</p><h1>Switch Manager <span className={stale || error ? "sl-badge sl-warning" : "sl-badge"}>{stale || error ? "Unavailable / stale" : "Live SSH"}</span></h1>
        <p>52 ports. One place to inspect, understand, and control power.</p></div>
      <button disabled={busy} onClick={() => { void refresh().catch(e => setError(e.message)); void inspect(selected); }}><RefreshCw size={16}/> Refresh switch</button>
    </header>
    {error && <div role="alert" className="sl-alert">{error} No success is assumed. Refresh the switch before continuing.</div>}
    <div className="sl-status"><span><ShieldCheck size={16}/> Server-side control · 192.168.40.2</span><span>Manager .41.106 / VLAN 41</span><span>{snapshot ? `Observed ${date(snapshot.collected_at)}` : "Connecting…"}</span></div>
    <nav className="sl-filters" aria-label="Infrastructure views">{['rack','fleet','network','activity'].map(item=><button key={item} aria-pressed={view===item} onClick={()=>{setView(item);const url=new URL(location.href);url.searchParams.set('view',item);history.pushState({},'',url);}}>{item[0].toUpperCase()+item.slice(1)}</button>)}</nav>
    {fleetError&&<p role="status" className="sl-warning">{fleetError}</p>}
    <div className="sl-layout">
      {view==='fleet' ? <ClusterFleet devices={devices} selected={selected} choose={choose}/> : view==='network' ? <ClusterNetwork ports={snapshot?.ports||[]} devices={devices} choose={choose} networks={networks} networkSource={networkSource}/> : view==='activity' ? <section className="sl-fleet"><h2>Activity</h2><p>Human and Alshival power operations share the audit history below.</p><p>{snapshot?.operations.filter(job=>job.state!=="preview").length || 0} recorded operations</p><button onClick={()=>{setTray(true);operations.current?.scrollIntoView({block:"start"});}}>View operation history</button></section> :
      <section className="sl-rack" aria-label="Live switch ports">
        <div className="sl-rack-title"><div><p className="sl-eyebrow">ARUBA 6200F</p><h2>The physical switch</h2></div><Cable size={28}/></div>
        <div className="sl-port-grid">{(snapshot?.ports || []).map(p => <button key={p.port} aria-label={`Port ${p.port}, ${p.link}, VLAN ${p.vlan}${p.protected ? ", protected" : ""}`} aria-pressed={selected === p.port}
          className={`sl-port ${p.link === "up" ? "sl-up" : ""} ${selected === p.port ? "sl-selected" : ""}`} onClick={() => choose(p.port)}>
          <span className="sl-port-jack"><i/><i/><i/><i/></span><strong>{p.port.split("/")[2]}</strong><small>{p.mode === "access" ? `V${p.vlan}` : "TRUNK"}</small>
          {p.protected && <LockKeyhole size={11} className="sl-lock"/>}</button>)}</div>
        <div className="sl-legend"><span><i/> Link up</span><span>Dark jack · link down</span><span><LockKeyhole size={12}/> Protected</span></div>
        <div className="sl-boundary"><ShieldCheck size={20}/><div><strong>Single port operations</strong><p>Management host 13, provisioning host 48, router uplink 1 and SFP ports are protected. VLAN and provisioning changes remain outside live power control.</p></div></div>
      </section>}
      <aside className="sl-inspector" aria-label="Port inspector">
        <div className="sl-section-heading"><div><p className="sl-eyebrow">PORT INSPECTOR</p><h2>{selected}</h2></div><span className="sl-badge">{inspection?.link || "Refreshing"}</span></div>
        {inspection ? <>
          <h3>{inspection.device.label}</h3><p>{inspection.device.workload}</p>
          <div className={`sl-identity ${inspection.device.quality !== "verified" ? "sl-warning" : ""}`}><strong>Identity: {inspection.device.quality}{selectedStale ? " · observation stale" : ""}</strong>
            <p>{inspection.device.quality === "verified" ? "Learned MAC matches recorded inventory." : "Attached device or workload is unconfirmed. Review the physical port before removing power."}</p></div>
          <dl><div><dt>Access VLAN</dt><dd>{inspection.access_vlan ?? "Trunk / unavailable"}</dd></div>
            <div><dt>PoE</dt><dd>{inspection.poe_enabled === null ? "Not supported" : inspection.poe_enabled ? "Enabled" : "Disabled"} · {inspection.poe_status || "—"}</dd></div>
            <div><dt>Actual power</dt><dd>{inspection.watts ?? "—"} W</dd></div><div><dt>Voltage / current</dt><dd>{inspection.volts ?? "—"} V / {inspection.amps ?? "—"} A</dd></div>
            <div><dt>Fault</dt><dd>{inspection.fault || "—"}</dd></div><div><dt>Learned MACs</dt><dd>{inspection.macs.length ? inspection.macs.map(m => <code key={m}>{m}<br/></code>) : "None observed"}</dd></div>
            <div><dt>Observed</dt><dd>{date(inspection.collected_at)}</dd></div></dl>
          {protectedPort && <p className="sl-warning"><LockKeyhole size={14}/> {protectedPort} · power actions blocked</p>}
          <div className="sl-power"><button disabled={disabled} onClick={() => void prepare("off")}><Power size={15}/> PoE off</button><button disabled={disabled} onClick={() => void prepare("on")}><Zap size={15}/> PoE on</button>
            <button disabled={disabled || inspection.poe_status !== "delivering"} onClick={() => void prepare("cycle")}><RotateCw size={15}/> Cycle · 10s</button></div>
          <p className="sl-hint">Each action opens a fresh preview. The worker checks the port again immediately before execution.</p>
          <details><summary>Read-only command evidence</summary>{Object.entries(inspection.evidence).map(([k, v]) => <pre key={k}>{v}</pre>)}</details>
        </> : <p>Reading interface, MAC table and PoE telemetry…</p>}
      </aside>
    </div>
    <section ref={operations} className="sl-operations" aria-label="Operations Tray">
      <button className="sl-tray-toggle" onClick={() => setTray(!tray)} aria-expanded={tray}><Clock3 size={18}/><strong>Operations Tray</strong><span>{running ? "Operation in progress" : "Review & audit"}</span><ChevronRight size={16}/></button>
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
