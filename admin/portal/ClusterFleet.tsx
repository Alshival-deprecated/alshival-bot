"use client";
import { useEffect, useState } from 'react';

type NetworkNote = {name:string;subnet_gateway:string;purpose:string};
type NetworkSource = {source:string;collected_at:string|null;source_updated_at?:string|null};
type Observation = {source:string;collected_at:string|null;error?:string;source_updated_at?:string};
export type ResourceLink = {id:string;name:string;url:string;state:string};
export type FleetDevice = {resource?:ResourceLink|null;resource_sync?:string;id:string;serial:string;port:string;inventory:Record<string,string>;facts:Record<string,unknown>;status:string;conflict:boolean;stale:boolean;nvme_detected:boolean;nvme_bytes:number;sd_bytes:number;ram_gb:number|null;assigned:boolean;available:boolean;admitted:boolean;observations:Observation[]};
export function useFleet(endpoint:string) {
  const [devices,setDevices]=useState<FleetDevice[]>([]),[error,setError]=useState('');
  const [networks,setNetworks]=useState<NetworkNote[]>([]),[networkSource,setNetworkSource]=useState<NetworkSource|null>(null);
  useEffect(()=>{let active=true;const refresh=async()=>{
    try{const response=await fetch(endpoint+'?view=fleet',{credentials:'same-origin',cache:'no-store'});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Inventory unavailable');
      if(active){setDevices(body.devices);setNetworks(body.networks||[]);setNetworkSource(body.network_source||null);setError('');}
    }catch{if(active)setError('Inventory collector unavailable. Displayed observations retain their original timestamps.');}
  };void refresh();const timer=setInterval(()=>void refresh(),60000);return()=>{active=false;clearInterval(timer);};},[endpoint]);
  return {devices,error,networks,networkSource};
}
const capacity=(bytes:number)=>bytes?`${(bytes/1e9).toFixed(1)} GB`:'Unknown';
export function ClusterFleet({devices,selected,choose}:{devices:FleetDevice[];selected:string;choose:(port:string)=>void}) {
  const [query,setQuery]=useState(''),[ram,setRam]=useState(''),[storage,setStorage]=useState(''),[spare,setSpare]=useState(false),[sd,setSd]=useState('');
  const filtered=devices.filter(device=>(!query||JSON.stringify([device.serial,device.port,device.inventory]).toLowerCase().includes(query.toLowerCase()))
    &&(!ram||device.ram_gb===Number(ram))&&(!storage||(storage==='nvme'?device.nvme_detected:!device.nvme_detected&&!device.stale&&!!device.observations[1]?.collected_at))
    &&(!spare||device.available)&&(!sd||device.sd_bytes>=Number(sd)*1e9));
  return <section className="sl-fleet" aria-label="Fleet inventory"><header><h2>Fleet</h2><p>Capacity comes from SSH observations. Inventory purpose and detected storage remain separate.</p></header>
    <div className="sl-filters"><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hostname, serial, workload, port…"/></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}><option value="">Any capacity</option>{[2,4,8,16,32].map(n=><option key={n}>{n}</option>)}</select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}><option value="">All observations</option><option value="nvme">NVMe drive detected</option><option value="sd">No NVMe detected · fresh</option></select></label>
      <label>SD capacity<select value={sd} onChange={e=>setSd(e.target.value)}><option value="">Any capacity</option><option value="30">32 GB class or larger</option><option value="60">64 GB class or larger</option><option value="120">128 GB class or larger</option></select></label>
      <label><input type="checkbox" checked={spare} onChange={e=>setSpare(e.target.checked)}/>Available spares</label></div>
    <p>{filtered.length} devices · nominal RAM class estimated from observed usable memory</p>
    <div className="sl-table-scroll"><table><thead><tr><th>Device / identity</th><th>Purpose</th><th>RAM / SD</th><th>NVMe</th><th>Evidence</th></tr></thead><tbody>{filtered.map(device=><tr key={device.id} aria-selected={selected===device.port}>
      <td><button onClick={()=>choose(device.port)}>{device.inventory.title} · {device.port}</button><br/><code>{device.serial||'Serial unknown'}</code>{device.resource&&<p><a className="sl-resource-link" href={device.resource.url}>Open resource · notes &amp; tasks</a></p>}{device.resource_sync&&<small>{device.resource_sync}</small>}</td>
      <td>{device.inventory.role||'Purpose unconfirmed'}<br/>{device.assigned?'Active assignment':device.available?'Available spare':'Availability unconfirmed'}</td>
      <td>{device.ram_gb?`${device.ram_gb} GB`:'Unknown'} / {capacity(device.sd_bytes)}</td>
      <td>{device.nvme_detected?`Drive detected · ${capacity(device.nvme_bytes)}`:device.facts.storage?'No drive detected':'Not observed'}<br/>{device.facts.nvme_hat?`HAT: ${String(device.facts.nvme_hat)}`:'HAT not reported'}</td>
      <td><strong className={device.stale||device.conflict?'sl-warning':''}>{device.status}</strong>{device.observations.map((item,i)=><div key={i}><small>{item.source} · {item.collected_at?new Date(item.collected_at).toLocaleString():'Not collected'}</small>{item.error&&<p className="sl-warning">{item.error}</p>}</div>)}</td>
    </tr>)}</tbody></table></div>
    {!devices.length&&<p>No fleet observations have been collected. The collector imports public inventory fields from 1Password and verifies hosts over SSH.</p>}
  </section>;
}
export function ClusterNetwork({ports,devices,choose,networks,networkSource}:{ports:{port:string;vlan:number;link:string}[];devices:FleetDevice[];choose:(port:string)=>void;networks:NetworkNote[];networkSource:NetworkSource|null}) {
  const vlans=[...new Set(ports.map(port=>port.vlan))].sort((a,b)=>a-b);const [selected,setSelected]=useState<number|null>(null);
  const members=ports.filter(port=>selected===null||port.vlan===selected);
  return <section className="sl-fleet"><h2>Observed network</h2><p>Switch membership is observed. Gateway and isolation policy require router evidence; VLAN membership alone does not verify isolation.</p>
    <svg viewBox={`0 0 800 ${120+vlans.length*55}`} role="img" aria-label="Switch and observed VLANs"><rect x="20" y="20" width="190" height="45" rx="8" fill="currentColor" opacity=".1"/><text x="30" y="48" fill="currentColor">Aruba · router port 1/1/1</text>{vlans.map((vlan,i)=><g key={vlan}><path d={`M 210 42 H 270 V ${105+i*55} H 350`} fill="none" stroke="currentColor" opacity={selected===null||selected===vlan?1:.2}/><rect x="350" y={80+i*55} width="280" height="42" rx="8" fill="currentColor" opacity={selected === vlan ? .22 : .08}/><text x="365" y={107+i*55} fill="currentColor">VLAN {vlan} · {ports.filter(p=>p.vlan===vlan).length} ports</text></g>)}</svg>
    <label>Highlight VLAN<select value={selected??''} onChange={e=>setSelected(e.target.value?Number(e.target.value):null)}><option value="">All VLANs</option>{vlans.map(vlan=><option key={vlan}>{vlan}</option>)}</select></label>
    <div className="sl-table-scroll"><table><caption>Keyboard-accessible topology table</caption><thead><tr><th>Port</th><th>VLAN</th><th>Link</th><th>Inventory purpose</th></tr></thead><tbody>{members.map(port=><tr key={port.port}><td><button onClick={()=>choose(port.port)}>{port.port}</button></td><td>{port.vlan}</td><td>{port.link}</td><td>{devices.find(device=>device.port===port.port)?.inventory.role||'Unknown'}</td></tr>)}</tbody></table></div>
    {networks.length>0&&<details><summary>Documented network purposes · historical inventory</summary><p>{networkSource?.source} · last edited {networkSource?.source_updated_at?new Date(networkSource.source_updated_at).toLocaleString():'Unknown'} · collected {networkSource?.collected_at?new Date(networkSource.collected_at).toLocaleString():'Unknown'}</p><p>These are documented intentions. Router policy and isolation have not been verified by this collector.</p>{networks.map(network=><article key={network.name}><h3>{network.name}</h3><p>{network.subnet_gateway}</p><p>{network.purpose}</p></article>)}</details>}
  </section>;
}
