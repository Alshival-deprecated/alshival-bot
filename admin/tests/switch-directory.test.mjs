import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'switch-directory-'));
const output = join(dir, 'directory.cjs');
buildSync({ entryPoints: [new URL('../portal/DeviceDirectory.tsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic' });
const { deviceRows, matches, emptyFilters, validPort, addressSummary } = createRequire(import.meta.url)(output);
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
const ports = [{port:'1/1/3',vlan:11,link:'up'}, {port:'1/1/16',vlan:41,link:'down'}, {port:'1/1/20',vlan:41,link:'down'}];
const device = (id, port, extra = {}) => ({id,port,inventory:{title:`Node ${id}`,internal_ip:'192.0.2.16'},facts:{storage:true},ram_gb:8,sd_bytes:64000000000,nvme_bytes:0,nvme_detected:false,stale:false,available:false,...extra});

test('join retains disconnected inventory, unknown live devices and unassigned records', () => {
  const rows = deviceRows(ports, [device('a','1/1/16'),device('b','')]);
  assert.equal(rows.length,4);
  assert.deepEqual(rows.filter(row => matches(row,emptyFilters)).map(row => row.key),['port:1/1/3','device:a','device:b']);
  assert.equal(rows.filter(row => matches(row,{...emptyFilters,unused:true})).length,4);
});
test('duplicate attachments remain separate and explicitly ambiguous', () => {
  const rows = deviceRows(ports,[device('a','1/1/16'),device('b','1/1/16')]);
  assert.equal(rows.filter(row => row.ambiguous).length,2);
});
test('VLAN, search and capacity filters intersect without inventing unknown capacity', () => {
  const rows=deviceRows(ports,[device('a','1/1/16')]);
  assert.equal(rows.filter(row=>matches(row,{...emptyFilters,vlan:'41',query:'node 192.0.2',ram:'8',sd:'60',storage:'sd'})).length,1);
  assert.equal(rows.filter(row=>matches(row,{...emptyFilters,vlan:'11',ram:'8'})).length,0);
  assert.equal(rows.filter(row=>matches(row,{...emptyFilters,spare:true})).length,0);
});
test('stale absence of NVMe is not fresh negative evidence', () => {
  assert.equal(matches({device:device('a','1/1/16',{stale:true})},{...emptyFilters,storage:'sd'}),false);
});
test('port links accept only actual switch ports', () => {
  for(const p of ['1/1/1','1/1/52']) assert.equal(validPort(p),true);
  for(const p of ['',null,'1/1/0','1/1/53','1/1/001','2/1/1','1/1/16?x']) assert.equal(validPort(p),false);
});

test('address summary prefers routed physical IPv4 and retains the count of other observations', () => {
  const local = (address, iface) => ({address,interface:iface,scope:'local'});
  const context = {addresses:[local('172.17.0.1/16','docker0'),local('fe80::1/64','eth0'),local('192.168.41.115/24','eth0'),local('10.0.0.2/24','wlan0'),{address:'203.0.113.1',interface:'eth0',scope:'public'}],gateways:[{address:'192.168.41.1',interface:'eth0'}]};
  assert.deepEqual(addressSummary(context),{primary:'192.168.41.115/24',additional:3});
  assert.deepEqual(addressSummary({...context,gateways:[]}),{primary:'192.168.41.115/24',additional:3});
  assert.deepEqual(addressSummary(),{primary:undefined,additional:0});
  assert.equal(context.addresses[0].address,'172.17.0.1/16');
});
