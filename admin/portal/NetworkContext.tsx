import { Globe2, Network, ShieldCheck } from 'lucide-react';

export type NetworkContext = {
  hostname: string;
  documented_hostname: string;
  addresses: {address: string; interface: string; scope: 'public' | 'local'}[];
  gateways: {address: string; interface: string}[];
  documentation: {field: string; label: string; value: string; source: string; collected_at: string | null}[];
  source: string;
  collected_at: string | null;
  stale: boolean;
  identity_conflict: boolean;
  address_conflict: boolean;
  error: string;
  firewall_verified: boolean;
};
const when = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not collected';
const ruleFields = new Set(['service_ports', 'firewall_rules', 'port_forwarding', 'nat_rules']);

export function DeviceNetwork({context}: {context?: NetworkContext}) {
  const rules = context?.documentation.filter(row => ruleFields.has(row.field)) || [];
  const addresses = context?.documentation.filter(row => !ruleFields.has(row.field)) || [];
  return <section className="sl-network-context" aria-label="Device network context">
    <h3><Network size={16}/> Network</h3>
    {context?.identity_conflict && <p className="sl-warning">Identity conflict · observed host details are withheld until the attached board is verified.</p>}
    {context?.address_conflict && <p className="sl-warning">Address conflict · documented local IP differs from the observed interfaces.</p>}
    <dl>
      <div><dt>Observed hostname</dt><dd>{context?.hostname || 'Not observed'}</dd></div>
      <div><dt>Local addresses</dt><dd>{context?.addresses.filter(row=>row.scope==='local').length ? context.addresses.filter(row=>row.scope==='local').map(row=><span key={row.interface+row.address}><code>{row.address}</code><small>{row.interface}</small></span>) : 'Not observed'}</dd></div>
      <div><dt>Default gateway</dt><dd>{context?.gateways.length ? context.gateways.map(row=><span key={row.interface+row.address}><code>{row.address}</code><small>{row.interface}</small></span>) : 'Not observed'}</dd></div>
      <div><dt><Globe2 size={13}/> Public interface IP</dt><dd>{context?.addresses.filter(row=>row.scope==='public').length ? context.addresses.filter(row=>row.scope==='public').map(row=><span key={row.interface+row.address}><code>{row.address}</code><small>{row.interface}</small></span>) : 'Not observed'}</dd></div>
      <div><dt>Allocation type</dt><dd>Not verified<small>Static / DHCP requires allocation evidence</small></dd></div>
    </dl>
    <p className="sl-hint">{context?.source || 'SSH'} · {when(context?.collected_at || null)}{context?.stale ? ' · Stale / unavailable' : ''}</p>
    {context?.error && <p className="sl-warning">{context.error}</p>}
    <p className="sl-hint">Host readings update every 15 minutes. Refresh port updates switch evidence only. A shared internet address is not a device allocation.</p>
    <details><summary>Documented addresses &amp; assignments</summary>
      <p className="sl-hint">Historical documentation; current assignment has not been verified.</p>
      {context?.documented_hostname && <p>Hostname · {context.documented_hostname}</p>}
      {addresses.length ? addresses.map((row,i)=><div className="sl-doc-row" key={i}><strong>{row.label}</strong><p>{row.value}</p><small>{row.source} · {when(row.collected_at)}</small></div>) : <p>No address assignments recorded.</p>}
      {!addresses.some(row=>['public_ip','public_static_ip'].includes(row.field)) && <p>Public / public static assignment · Not recorded</p>}
    </details>
    <details open={rules.length>0}><summary><ShieldCheck size={14}/> Ports &amp; firewall</summary>
      {rules.map((row,i)=><div className="sl-doc-row" key={i}><strong>{row.label} · documented</strong><p>{row.value}</p><small>{row.source} · {when(row.collected_at)}</small></div>)}
      {!rules.some(row=>row.field==='service_ports') && <p>Service ports · Not recorded</p>}
      {!rules.some(row=>row.field==='firewall_rules') && <p>Firewall rules · Not recorded</p>}
      {!rules.some(row=>['port_forwarding','nat_rules'].includes(row.field)) && <p>Port forwarding / NAT · Not recorded</p>}
      <p className="sl-hint">Router enforcement and external reachability are not verified. A listed service port does not establish that a firewall permits it.</p>
    </details>
  </section>;
}
