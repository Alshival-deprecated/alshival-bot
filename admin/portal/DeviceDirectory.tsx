import type { FleetDevice } from './ClusterFleet';

export type SwitchPort = { port: string; vlan: number | null; mode: string; link: string; protected: string };
export type Filters = { query: string; vlan: string; ram: string; storage: string; sd: string; spare: boolean; unused: boolean };
export const emptyFilters: Filters = { query: '', vlan: '', ram: '', storage: '', sd: '', spare: false, unused: false };
export type DeviceRow = { key: string; port?: SwitchPort; device?: FleetDevice; ambiguous: boolean };
export const validPort = (value: string | null | undefined): value is string => /^1\/1\/([1-9]|[1-4][0-9]|5[0-2])$/.test(value || '');
export const portNumber = (port?: string) => validPort(port) ? Number(port.split('/')[2]) : 999;

export function deviceRows(ports: SwitchPort[], devices: FleetDevice[]): DeviceRow[] {
  const rows = ports.flatMap<DeviceRow>(port => {
    const attached = devices.filter(device => device.port === port.port);
    return attached.length ? attached.map(device => ({ key: `device:${device.id}`, port, device, ambiguous: attached.length > 1 }))
      : [{ key: `port:${port.port}`, port, ambiguous: false }];
  });
  for (const device of devices) {
    if (!ports.some(port => port.port === device.port)) rows.push({ key: `device:${device.id}`, device, ambiguous: false });
  }
  return rows.sort((a, b) => portNumber(a.port?.port) - portNumber(b.port?.port) || a.key.localeCompare(b.key));
}

export function matches(row: DeviceRow, filters: Filters): boolean {
  const { device, port } = row;
  if (!filters.unused && !device && port?.link !== 'up') return false;
  if (filters.vlan && String(port?.vlan ?? '') !== filters.vlan) return false;
  if (filters.ram && device?.ram_gb !== Number(filters.ram)) return false;
  if (filters.spare && !device?.available) return false;
  if (filters.sd && (!device || device.sd_bytes < Number(filters.sd) * 1e9)) return false;
  if (filters.storage === 'nvme' && !device?.nvme_detected) return false;
  if (filters.storage === 'sd' && (!device || device.nvme_detected || device.stale || !device.facts.storage)) return false;
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchable = JSON.stringify([port?.port, port?.vlan, device?.serial, device?.inventory, device?.network_context?.hostname, device?.network_context?.addresses]).toLowerCase();
  return terms.every(term => searchable.includes(term));
}

export function DirectoryFilters({ filters, setFilters, ports }: { filters: Filters; setFilters: (filters: Filters) => void; ports: SwitchPort[] }) {
  const update = (key: keyof Filters, value: string | boolean) => setFilters({ ...filters, [key]: value });
  const advanced = !!(filters.ram || filters.storage || filters.sd || filters.spare);
  const vlans = [...new Set(ports.map(port => port.vlan).filter((v): v is number => v !== null))].sort((a,b) => a-b);
  return <div className="sl-directory-filters">
    <div className="sl-search-line">
      <label>Find a device or port<input type="search" value={filters.query} onChange={e => update('query', e.target.value)} placeholder="Name, IP, port, or serial…"/></label>
      <label>VLAN<select value={filters.vlan} onChange={e => update('vlan', e.target.value)}><option value="">All VLANs</option>{vlans.map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="sl-check"><input type="checkbox" checked={filters.unused} onChange={e => update('unused', e.target.checked)}/>Show unused ports</label>
    </div>
    <details className="sl-more-filters"><summary>More filters{advanced ? ' · active' : ''}</summary><div className="sl-search-line">
      <label>RAM<select value={filters.ram} onChange={e => update('ram', e.target.value)}><option value="">Any capacity</option>{[2,4,8,16,32].map(n => <option key={n} value={n}>{n} GB</option>)}</select></label>
      <label>Storage<select value={filters.storage} onChange={e => update('storage', e.target.value)}><option value="">All observations</option><option value="nvme">NVMe detected</option><option value="sd">No NVMe · fresh evidence</option></select></label>
      <label>SD capacity<select value={filters.sd} onChange={e => update('sd', e.target.value)}><option value="">Any capacity</option><option value="30">32 GB class or larger</option><option value="60">64 GB class or larger</option><option value="120">128 GB class or larger</option></select></label>
      <label className="sl-check"><input type="checkbox" checked={filters.spare} onChange={e => update('spare', e.target.checked)}/>Available spares</label>
    </div></details>
    {Object.entries(filters).some(([key,value]) => value !== emptyFilters[key as keyof Filters]) && <button className="sl-clear-filters" onClick={() => setFilters(emptyFilters)}>Clear filters</button>}
  </div>;
}

export function DeviceDirectory({ rows, selected, selectedDevice, choose }: { rows: DeviceRow[]; selected: string; selectedDevice: string; choose: (port: string, device?: string) => void }) {
  return <div className="sl-device-list" role="list" aria-label="Devices and ports">
    {rows.map(({ key, port, device, ambiguous }) => {
      const context = device?.network_context;
      const observed = context?.addresses.filter(row => row.scope === 'local') || [];
      const conflict = !!(device?.conflict || context?.identity_conflict);
      const selectedRow = port ? selected === port.port : selectedDevice === device?.id;
      return <div role="listitem" key={key}><button aria-pressed={selectedRow} className={`sl-device-row ${selectedRow ? 'is-selected' : ''}`} onClick={() => choose(port?.port || '', device?.id)} aria-label={`Inspect ${device?.inventory.title || (port?.link === 'up' ? 'Unidentified device' : 'Unused port')}${port ? ` on ${port.port}` : ', unassigned'}`}>
        <span className="sl-device-identity"><strong>{device?.inventory.title || (port?.link === 'up' ? 'Unidentified device' : 'Unused port')}</strong><small>{!conflict && (context?.hostname || device?.inventory.hostname) || device?.inventory.role || 'Identity not confirmed'}</small>{(ambiguous || conflict) && <small className="sl-warning">{ambiguous ? 'Multiple inventory records' : 'Identity conflict'}</small>}</span>
        <span><strong>{port?.port || 'Unassigned'}</strong><small>{port ? `VLAN ${port.vlan ?? 'unknown'} · ${port.link}` : 'No observed port'}</small></span>
        <span><strong className="sl-address">{conflict ? 'Address withheld' : observed.length ? observed.map(row => row.address).join(', ') : device?.inventory.internal_ip || 'IP unknown'}</strong><small>{conflict ? 'Verify device identity' : observed.length ? (context?.stale ? 'Observed · stale' : 'Observed address') : device?.inventory.internal_ip ? 'Documented · unverified' : 'Not observed'}</small></span>
        <span><strong>{device?.ram_gb ? `${device.ram_gb} GB RAM` : 'Capacity unknown'}</strong><small>{device?.nvme_detected ? `${(device.nvme_bytes / 1e9).toFixed(0)} GB NVMe` : device?.sd_bytes ? `${(device.sd_bytes / 1e9).toFixed(0)} GB SD` : 'No storage evidence'}{device?.stale ? ' · stale' : ''}</small></span>
      </button></div>;
    })}
    {!rows.length && <p className="sl-empty">No devices or ports match these filters. Clear filters or include unused ports.</p>}
  </div>;
}

export function InventoryDetails({ devices }: { devices: FleetDevice[] }) {
  return <>{devices.map(device => <div key={device.id} className="sl-inventory-detail">
    <strong>{device.inventory.title}</strong>
    <p>{device.ram_gb ? `${device.ram_gb} GB RAM` : 'RAM unknown'} · {device.nvme_detected ? `${(device.nvme_bytes / 1e9).toFixed(0)} GB NVMe` : device.facts.storage ? 'No NVMe detected' : 'NVMe unknown'} · {device.sd_bytes ? `${(device.sd_bytes / 1e9).toFixed(0)} GB SD` : 'SD unknown'}</p>
    <code>{device.serial || 'Serial unknown'}</code>
    <p className={device.stale || device.conflict ? 'sl-warning' : ''}>{device.status}{device.stale ? ' · stale' : ''} · {device.assigned ? 'Active assignment' : device.available ? 'Available spare' : 'Availability unconfirmed'}</p>
    {device.resource && <a className="sl-resource-link" href={device.resource.url}>Open resource</a>}
    <details><summary>Inventory evidence</summary>
      {device.resource_sync && <p>{device.resource_sync}</p>}
      <p>{device.facts.nvme_hat ? `NVMe HAT: ${String(device.facts.nvme_hat)}` : 'NVMe HAT not reported'}</p>
      {device.observations.map((item,i) => <p key={i}>{item.source} · {item.collected_at ? new Date(item.collected_at).toLocaleString() : 'Not observed'}{item.error && <span className="sl-warning"> · {item.error}</span>}</p>)}
    </details>
  </div>)}</>;
}
