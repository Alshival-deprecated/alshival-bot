import test from "node:test";
import assert from "node:assert/strict";
import { createDemoAdapter } from "../lib/switch-manager/engine.ts";

function planned(
  adapter,
  kind = "provision",
  actor = "Human",
  deviceId = "pi-17",
  portId = "1/1/17",
) {
  adapter.checkAddress(
    "192.168.41.118",
    adapter.inspect().devices.find((d) => d.id === deviceId).mac,
  );
  return adapter.propose({
    kind,
    actor,
    deviceId,
    portId,
    vlan: 41,
    ip: "192.168.41.118",
  });
}

test("fixtures distinguish detected drive from HAT, complete Pi16, and all 52 ports", () => {
  const s = createDemoAdapter().inspect();
  assert.equal(s.ports.filter((p) => p.type === "Ethernet").length, 48);
  assert.equal(s.ports.filter((p) => p.type === "SFP+").length, 4);
  const completed = s.devices.find((d) => d.id === "pi-16");
  assert.deepEqual(
    [
      completed.ram,
      completed.sd,
      completed.nvme,
      completed.vlan,
      completed.ip,
      completed.health,
    ],
    [8, 64, null, 41, "192.168.41.116", "ready"],
  );
  assert.equal(s.devices.find((d) => d.id === "pi-8").hat, true);
  assert.equal(s.devices.find((d) => d.id === "pi-8").nvme, null);
  assert.ok(
    s.devices
      .find((d) => d.id === "pi-8")
      .observations.some((o) => o.quality === "historical"),
  );
});

test("conflicting addresses and unavailable collectors cannot become candidate allocations", () => {
  const a = createDemoAdapter();
  assert.equal(
    a.checkAddress("192.168.41.117", a.inspect().draft.mac).status,
    "conflict",
  );
  assert.throws(
    () =>
      a.propose({
        kind: "provision",
        actor: "Human",
        deviceId: "pi-17",
        portId: "1/1/17",
        ip: "192.168.41.117",
      }),
    /checks/,
  );
  assert.equal(
    a.checkAddress("192.168.41.118", a.inspect().draft.mac, false).status,
    "incomplete",
  );
  assert.throws(
    () =>
      a.propose({
        kind: "provision",
        actor: "Human",
        deviceId: "pi-17",
        portId: "1/1/17",
        ip: "192.168.41.118",
      }),
    /checks/,
  );
});

test("swapped identity, occupied port, unavailable collectors, and invalid subnets stop plans", () => {
  const a = createDemoAdapter();
  assert.throws(
    () =>
      a.propose({
        kind: "poe",
        actor: "Human",
        deviceId: "pi-40",
        portId: "1/1/40",
      }),
    /identity mismatch/,
  );
  assert.throws(
    () =>
      a.propose({
        kind: "poe",
        actor: "Alshival",
        deviceId: "pi-24",
        portId: "1/1/24",
      }),
    /unavailable or stale/,
  );
  a.updateDraft({ portId: "1/1/16" });
  assert.throws(() => a.identify(), /Occupied port/);
  a.checkAddress("192.168.72.118", a.inspect().draft.mac);
  assert.throws(
    () =>
      a.propose({
        kind: "vlan",
        actor: "Human",
        deviceId: "pi-17",
        portId: "1/1/17",
        vlan: 41,
        ip: "192.168.72.118",
      }),
    /valid host address/,
  );
});

test("provisioning waits for installation, fails recoverably, and persists successful evidence", () => {
  const a = createDemoAdapter();
  const plan = planned(a);
  a.updateDraft({ ip: plan.ip, planId: plan.id });
  // Input changes invalidate the check; check and re-plan with final inputs.
  const valid = planned(a);
  a.updateDraft({ planId: valid.id });
  const handoff = a.handoff();
  assert.match(handoff, /TARGET CARD: intentionally UNSELECTED/);
  assert.match(handoff, /#cloud-config/);
  assert.match(handoff, /SHA-256/);
  assert.match(handoff, /ssh_authorized_keys/);
  const job = a.execute(valid.id);
  a.updateDraft({ jobId: job.id });
  assert.equal(job.state, "waiting");
  assert.equal(a.execute(valid.id).id, job.id, "execution is idempotent");
  a.advance();
  assert.equal(a.follow(job.id).checks[0].state, "pending");
  a.install(job.id);
  for (let i = 0; i < 12; i++) a.advance();
  assert.equal(a.follow(job.id).state, "failed");
  const firstEvidence = a.follow(job.id).checks[0].collectedAt;
  assert.match(
    a.follow(job.id).checks.find((c) => c.state === "failed").evidence,
    /503/,
  );
  a.resume(job.id);
  for (let i = 0; i < 4; i++) a.advance();
  assert.equal(a.follow(job.id).state, "complete");
  assert.equal(a.follow(job.id).checks[0].collectedAt, firstEvidence);
  a.finish(job.id);
  assert.equal(
    a.inspect().devices.find((d) => d.id === "pi-17").role,
    "General spare",
  );
  assert.equal(a.inspect().draft.finished, true);
  assert.equal(
    a.inspect().devices.find((d) => d.id === "pi-17").ip,
    "192.168.41.118",
  );
});

test("human and Alshival use same plans, verification and activity; active job survives restoration", () => {
  const a = createDemoAdapter();
  const p = a.propose({
    kind: "poe",
    actor: "Alshival",
    deviceId: "pi-16",
    portId: "1/1/16",
  });
  const j = a.execute(p.id);
  a.advance();
  const b = createDemoAdapter();
  assert.ok(b.restore(JSON.parse(JSON.stringify(a.inspect()))));
  for (let i = 0; i < 6; i++) b.advance();
  assert.equal(b.follow(j.id).state, "complete");
  assert.ok(
    b
      .inspect()
      .activity.some(
        (e) =>
          e.actor === "Alshival" && e.jobId === j.id && e.result === "Complete",
      ),
  );
  b.reset();
  assert.equal(b.inspect().jobs.length, 0);
});

test("VLAN move preserves stable device identity and changes network only after verification", () => {
  const a = createDemoAdapter();
  const before = structuredClone(
    a.inspect().devices.find((d) => d.id === "pi-16"),
  );
  a.checkAddress("192.168.72.116", before.mac);
  const p = a.propose({
    kind: "vlan",
    actor: "Human",
    deviceId: before.id,
    portId: "1/1/16",
    vlan: 72,
    ip: "192.168.72.116",
  });
  const j = a.execute(p.id);
  assert.equal(a.inspect().devices.find((d) => d.id === before.id).vlan, 41);
  for (let i = 0; i < 5; i++) a.advance();
  const after = a.inspect().devices.find((d) => d.id === before.id);
  assert.equal(a.follow(j.id).state, "complete");
  assert.deepEqual(
    [after.id, after.mac, after.serial],
    [before.id, before.mac, before.serial],
  );
  assert.equal(after.vlan, 72);
  assert.equal(a.inspect().ports[15].vlan, 72);
});

test("execution reserves addresses against concurrent plans and rejects invalid candidates", () => {
  const a = createDemoAdapter();
  assert.equal(
    a.checkAddress("192.168.41.999", a.inspect().draft.mac).status,
    "incomplete",
  );
  const first = planned(a, "vlan");
  const second = planned(a, "vlan", "Human", "pi-16", "1/1/16");
  a.execute(first.id);
  assert.throws(() => a.execute(second.id), /Address conflict/);
});

test("refresh creates timestamped demo evidence without reviving an unreachable collector", () => {
  const a = createDemoAdapter(new Date(Date.now() - 10 * 60000).toISOString());
  assert.throws(
    () =>
      a.propose({
        kind: "poe",
        actor: "Human",
        deviceId: "pi-16",
        portId: "1/1/16",
      }),
    /unavailable or stale/,
  );
  const old = a.inspect().ports[23].collectedAt;
  a.refresh();
  assert.ok(
    a.propose({
      kind: "poe",
      actor: "Human",
      deviceId: "pi-16",
      portId: "1/1/16",
    }),
  );
  assert.equal(a.inspect().ports[23].collectedAt, old);
  assert.equal(a.inspect().ports[23].quality, "unreachable");
  assert.ok(
    a
      .inspect()
      .devices.find((d) => d.id === "pi-16")
      .observations.some((o) => o.quality === "historical"),
  );
});

test("provisioning cannot execute before the imaging handoff exists", () => {
  const a = createDemoAdapter();
  const p = planned(a);
  assert.throws(() => a.execute(p.id), /reviewed SD handoff/);
});
