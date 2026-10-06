/** Demo-only operations boundary. No network, credentials, shell, or disk access. */
export type View = "rack" | "network" | "fleet" | "provisioning" | "activity";
export type Actor = "Human" | "Alshival";
export type Health =
  | "no device detected"
  | "powered"
  | "link established"
  | "SSH reachable"
  | "ready"
  | "maintenance"
  | "unknown";
export type Observation = {
  id: string;
  subject: string;
  label: string;
  value: string;
  source: string;
  collectedAt: string;
  quality: "current" | "stale" | "unreachable" | "historical";
};
export type Network = {
  id: number;
  name: string;
  purpose: string;
  gateway: string;
  subnet: string;
  isolated: boolean;
};
export type Device = {
  id: string;
  serial: string;
  mac: string;
  model: string;
  ram: number;
  sd: number;
  nvme: number | null;
  hat: boolean;
  hostname: string;
  ip: string;
  role: string;
  workload: string;
  vlan: number;
  health: Health;
  capacity: number;
  watts: number;
  ssh: string;
  observations: Observation[];
};
export type Port = {
  id: string;
  number: number;
  type: "Ethernet" | "SFP+";
  deviceId: string | null;
  observedMac: string | null;
  link: string;
  vlan: number;
  mbps: number;
  health: Health;
  source: string;
  collectedAt: string;
  quality: Observation["quality"];
};
export type Switch = {
  id: string;
  name: string;
  model: string;
  rack: string;
  poeBudget: number;
};
export type AddressAllocation = {
  ip: string;
  mac: string;
  kind: "static" | "lease" | "reservation";
  owner: string;
  source: string;
  collectedAt: string;
};
export type AddressCheck = {
  ip: string;
  checkedAt: string;
  status: "conflict" | "incomplete" | "candidate";
  evidence: string[];
};
export type PlanKind = "provision" | "vlan" | "poe";
export type Plan = {
  id: string;
  kind: PlanKind;
  actor: Actor;
  deviceId: string;
  portId: string;
  expectedMac: string;
  expectedSerial: string;
  handoffReady?: boolean;
  vlan: number;
  ip: string;
  status: "proposed" | "executed";
  createdAt: string;
  summary: string;
};
export type Check = {
  label: string;
  state: "pending" | "passed" | "failed";
  evidence: string;
  source: string;
  collectedAt: string | null;
};
export type Job = {
  id: string;
  planId: string;
  deviceId: string;
  portId: string;
  actor: Actor;
  kind: PlanKind;
  state: "waiting" | "running" | "failed" | "complete";
  checks: Check[];
  failOnce: boolean;
  attempts: number;
  createdAt: string;
};
export type ActivityEvent = {
  id: string;
  actor: Actor;
  deviceId: string;
  portId: string;
  workflow: string;
  at: string;
  title: string;
  evidence: string;
  result: string;
  jobId?: string;
};
export type Draft = {
  step: number;
  portId: string;
  model: string;
  ram: number;
  mac: string;
  serial: string;
  purpose: string;
  vlan: number;
  ip: string;
  image: string;
  handoffGenerated: boolean;
  planId: string | null;
  jobId: string | null;
  finished: boolean;
};
export type DemoState = {
  version: 1;
  clock: string;
  switches: Switch[];
  networks: Network[];
  ports: Port[];
  devices: Device[];
  addresses: AddressAllocation[];
  addressCheck: AddressCheck | null;
  plans: Plan[];
  jobs: Job[];
  activity: ActivityEvent[];
  draft: Draft;
};
export type PlanInput = {
  kind: PlanKind;
  actor: Actor;
  deviceId: string;
  portId: string;
  vlan?: number;
  ip?: string;
};
export type OperationsAdapter = {
  getSnapshot(): DemoState;
  subscribe(listener: () => void): () => void;
  inspect(): DemoState;
  refresh(): void;
  checkAddress(ip: string, mac: string, complete?: boolean): AddressCheck;
  propose(input: PlanInput): Plan;
  execute(planId: string): Job;
  follow(jobId: string): Job;
  advance(): void;
  resume(jobId: string): void;
  install(jobId: string): void;
  finish(jobId: string): void;
  updateDraft(patch: Partial<Draft>): void;
  identify(): Device;
  handoff(): string;
  reset(): void;
  restore(value: unknown): boolean;
};
const time = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
export const image = {
  name: "Ubuntu Server 24.04 LTS · arm64",
  id: "ubuntu-pi-demo-24.04",
  file: "ubuntu-24.04-pi-demo.img.xz",
  sha256: "a62ec3f8cf092728d3548d560cbe639b2ad44dbd46f3e9cb7afb5bd9c10222e8",
  verified: "Fixture manifest checked · signature simulated",
};
const networks: Network[] = [
  {
    id: 10,
    name: "Control plane",
    purpose: "Administration & collectors",
    gateway: "192.168.10.1",
    subnet: "192.168.10.0/24",
    isolated: true,
  },
  {
    id: 41,
    name: "General compute",
    purpose: "General spares & shared workloads",
    gateway: "192.168.41.1",
    subnet: "192.168.41.0/24",
    isolated: false,
  },
  {
    id: 72,
    name: "Client / Atlas",
    purpose: "Existing isolated client environment",
    gateway: "192.168.72.1",
    subnet: "192.168.72.0/24",
    isolated: true,
  },
];
export function createFixtures(now = time()): DemoState {
  const old = new Date(Date.parse(now) - 1000 * 60 * 60 * 27).toISOString();
  const specs: [
    number,
    number,
    number,
    number | null,
    boolean,
    string,
    Health,
    number,
  ][] = [
    [3, 8, 64, 256, true, "pi-control", "ready", 10],
    [7, 16, 128, 512, true, "pi-worker-07", "ready", 41],
    [8, 16, 64, null, true, "pi-spare-08", "ready", 41],
    [12, 16, 128, 1024, true, "pi-spare-12", "ready", 41],
    [16, 8, 64, null, false, "pi-spare-16", "ready", 41],
    [17, 16, 64, null, true, "pi-new-17", "powered", 41],
    [21, 8, 64, 256, true, "pi-atlas-21", "maintenance", 72],
    [24, 8, 32, null, false, "pi-worker-24", "unknown", 41],
    [28, 4, 64, null, false, "pi-edge-28", "link established", 41],
    [32, 8, 64, 256, true, "pi-atlas-32", "SSH reachable", 72],
    [36, 16, 128, 512, true, "pi-worker-36", "ready", 41],
    [40, 8, 64, null, false, "pi-spare-40", "unknown", 41],
  ];
  const devices = specs.map(
    ([n, ram, sd, nvme, hat, hostname, health, vlan]): Device => ({
      id: `pi-${n}`,
      serial: `10000000a1b2${n.toString().padStart(4, "0")}`,
      mac: `dc:a6:32:41:00:${n.toString(16).padStart(2, "0")}`,
      model: "Raspberry Pi 5",
      ram,
      sd,
      nvme,
      hat,
      hostname,
      ip: n === 17 ? "" : `192.168.${vlan}.${100 + n}`,
      role:
        vlan === 10
          ? "Administration"
          : vlan === 72
            ? "Client / Atlas"
            : hostname.includes("spare")
              ? "General spare"
              : "Shared workload",
      workload:
        hostname.includes("spare") || n === 17
          ? "Unassigned"
          : vlan === 10
            ? "Cluster control"
            : vlan === 72
              ? "Atlas services"
              : "Inference worker",
      vlan,
      health,
      capacity: hostname.includes("spare") ? 100 : n === 17 ? 100 : 35,
      watts: n === 17 ? 3.2 : 5.8 + (n % 4) * 1.3,
      ssh: n === 17 ? "Not enrolled" : "SHA256:DEMO-pi-" + n + "-host-identity",
      observations: [
        {
          id: `host-${n}`,
          subject: `pi-${n}`,
          label: "Host health",
          value: health,
          source: "Pi agent · simulated",
          collectedAt: n === 24 ? old : now,
          quality: n === 24 ? "unreachable" : "current",
        },
        {
          id: `disk-${n}`,
          subject: `pi-${n}`,
          label: "Storage detection",
          value: nvme ? `${nvme} GB NVMe detected` : "No NVMe detected",
          source: "lsblk / Pi agent · simulated",
          collectedAt: now,
          quality: "current",
        },
        ...(n === 8
          ? [
              {
                id: "old-storage",
                subject: "pi-8",
                label: "Inventory note",
                value:
                  "512 GB NVMe installed — disagrees with current detection",
                source: "Human inventory note",
                collectedAt: old,
                quality: "historical" as const,
              },
            ]
          : []),
        ...(n === 40
          ? [
              {
                id: "swap",
                subject: "pi-40",
                label: "Board identity",
                value: "Observed dc:a6:32:ff:00:40 differs from recorded board",
                source: "Aruba MAC table · simulated",
                collectedAt: now,
                quality: "current" as const,
              },
            ]
          : []),
      ],
    }),
  );
  const ports = Array.from({ length: 52 }, (_, i): Port => {
    const n = i + 1;
    const d = devices.find((x) => x.id === `pi-${n}`);
    return {
      id: `1/1/${n}`,
      number: n,
      type: n > 48 ? "SFP+" : "Ethernet",
      deviceId: d?.id ?? null,
      observedMac: n === 40 ? "dc:a6:32:ff:00:40" : d?.mac ?? null,
      link:
        n === 49
          ? "10 Gbps uplink"
          : d
            ? n === 17
              ? "Waiting for link"
              : "1 Gbps"
            : "No link",
      vlan: d?.vlan ?? (n > 48 ? 10 : 41),
      mbps: n === 49 ? 840 : d ? (n % 3) * 38 + 2 : 0,
      health: n === 49 ? "ready" : d?.health ?? "no device detected",
      source: "Aruba collector · simulated",
      collectedAt: n === 24 ? old : now,
      quality: n === 24 ? "unreachable" : "current",
    };
  });
  return {
    version: 1,
    clock: now,
    switches: [
      {
        id: "aruba-core",
        name: "Aruba core",
        model: "Aruba 6200F · JL728A",
        rack: "Kiki lab / Rack 01 / U24",
        poeBudget: 740,
      },
    ],
    networks: structuredClone(networks),
    ports,
    devices,
    addresses: [
      ...devices
        .filter((d) => d.ip)
        .map((d) => ({
          ip: d.ip,
          mac: d.mac,
          kind: "static" as const,
          owner: d.hostname,
          source: "Inventory · simulated",
          collectedAt: now,
        })),
      {
        ip: "192.168.41.117",
        mac: "dc:a6:32:aa:00:55",
        kind: "reservation",
        owner: "pi-build-reserved",
        source: "pi-admin DHCP · simulated",
        collectedAt: now,
      },
      {
        ip: "192.168.41.119",
        mac: "dc:a6:32:aa:00:56",
        kind: "lease",
        owner: "pi-lease-119",
        source: "OPNsense leases · simulated",
        collectedAt: now,
      },
    ],
    addressCheck: null,
    plans: [],
    jobs: [],
    activity: [
      {
        id: "completed-16",
        actor: "Human",
        deviceId: "pi-16",
        portId: "1/1/16",
        workflow: "provision",
        at: now,
        title: "Pi 16 is available",
        evidence:
          "PoE, MAC, SSH identity, cloud-init, root growth, DNS, updates and reboot passed in this fixture. 8 GB RAM · nominal 64 GB SD · no NVMe detected.",
        result: "Complete",
      },
      {
        id: "collector-down",
        actor: "Alshival",
        deviceId: "pi-24",
        portId: "1/1/24",
        workflow: "inspect",
        at: now,
        title: "Collector unavailable on port 24",
        evidence:
          "Last host response is 27 hours old. Current health is unknown, not ready.",
        result: "Needs attention",
      },
      {
        id: "inventory-diff",
        actor: "Human",
        deviceId: "pi-8",
        portId: "1/1/8",
        workflow: "inspect",
        at: old,
        title: "Storage inventory needs reconciliation",
        evidence:
          "Historical note says 512 GB NVMe; current host detection finds only an NVMe HAT, no drive.",
        result: "Conflict",
      },
    ],
    draft: {
      step: 0,
      portId: "1/1/17",
      model: "Raspberry Pi 5",
      ram: 16,
      mac: devices.find((d) => d.id === "pi-17")!.mac,
      serial: devices.find((d) => d.id === "pi-17")!.serial,
      purpose: "General spare",
      vlan: 41,
      ip: "192.168.41.117",
      image: image.id,
      handoffGenerated: false,
      planId: null,
      jobId: null,
      finished: false,
    },
  };
}
export function createDemoAdapter(initialTime?: string): OperationsAdapter {
  let state = createFixtures(initialTime);
  const listeners = new Set<() => void>();
  const publish = () => {
    state = { ...state, clock: time() };
    listeners.forEach((fn) => fn());
  };
  const edit = () => {
    state = structuredClone(state);
  };
  const event = (
    actor: Actor,
    deviceId: string,
    portId: string,
    workflow: string,
    title: string,
    evidence: string,
    result: string,
    jobId?: string,
  ) =>
    state.activity.unshift({
      id: uid("event"),
      actor,
      deviceId,
      portId,
      workflow,
      at: time(),
      title,
      evidence,
      result,
      jobId,
    });
  const device = (id: string) => {
    const d = state.devices.find((d) => d.id === id);
    if (!d) throw new Error("Device not found.");
    return d;
  };
  const port = (id: string) => {
    const p = state.ports.find((p) => p.id === id);
    if (!p) throw new Error("Port not found.");
    return p;
  };
  const job = (id: string) => {
    const j = state.jobs.find((j) => j.id === id);
    if (!j) throw new Error("Job not found.");
    return j;
  };
  const network = (id: number) => {
    const n = state.networks.find((n) => n.id === id);
    if (!n)
      throw new Error(
        "New segments require a separate network-design handoff.",
      );
    return n;
  };
  const identity = (p: Port, d: Device) => {
    if (p.deviceId !== d.id || p.observedMac !== d.mac)
      throw new Error(
        "Board identity mismatch. Reconcile the attachment before executing any operation.",
      );
    if (
      p.quality !== "current" ||
      Date.now() - Date.parse(p.collectedAt) > 300000
    )
      throw new Error(
        "Collector evidence is unavailable or stale. Refresh observations before planning.",
      );
  };
  const inNetwork = (ip: string, vlan: number) =>
    new RegExp(`^192\\.168\\.${vlan}\\.([0-9]{1,3})$`).test(ip) &&
    Number(ip.split(".").pop()) > 1 &&
    Number(ip.split(".").pop()) < 255;
  const validate = (p: Plan) => {
    const d = device(p.deviceId);
    const pt = port(p.portId);
    identity(pt, d);
    if (d.mac !== p.expectedMac || d.serial !== p.expectedSerial)
      throw new Error("The board has changed since this plan was drafted.");
    network(p.vlan);
    if (
      state.jobs.some(
        (j) =>
          j.deviceId === d.id &&
          ["waiting", "running", "failed"].includes(j.state),
      )
    )
      throw new Error(
        "This device already has an unfinished job. Resume it first.",
      );
    if (p.kind !== "poe") {
      if (!inNetwork(p.ip, p.vlan))
        throw new Error(
          "Choose a valid host address in the selected VLAN subnet.",
        );
      const check = state.addressCheck;
      if (
        !check ||
        check.ip !== p.ip ||
        check.status !== "candidate" ||
        Date.now() - Date.parse(check.checkedAt) > 300000
      )
        throw new Error(
          "Run complete address checks before proposing or executing this plan.",
        );
      if (state.addresses.some((a) => a.ip === p.ip && a.mac !== d.mac))
        throw new Error("Address conflict: another device owns this address.");
    }
  };
  const api: OperationsAdapter = {
    getSnapshot: () => state,
    inspect: () => state,
    refresh() {
      edit();
      const collectedAt = time();
      for (const p of state.ports)
        if (p.quality === "current") p.collectedAt = collectedAt;
      for (const d of state.devices) {
        const fresh = d.observations
          .filter((o) => o.quality === "current")
          .map((o) => ({ ...o, id: uid("observation"), collectedAt }));
        d.observations
          .filter((o) => o.quality === "current")
          .forEach((o) => {
            o.quality = "historical";
          });
        d.observations.unshift(...fresh);
      }
      event(
        "Human",
        "",
        "",
        "inspect",
        "Demo collectors sampled",
        "New simulated readings recorded. Unreachable collectors and identity disagreements remain unresolved.",
        "Complete",
      );
      publish();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    checkAddress(ip, mac, complete = true) {
      edit();
      const validAddress = state.networks.some((n) => inNetwork(ip, n.id));
      const conflicts = state.addresses.filter(
        (a) => a.ip === ip && a.mac !== mac,
      );
      state.addressCheck = {
        ip,
        checkedAt: time(),
        status: !validAddress
          ? "incomplete"
          : conflicts.length
            ? "conflict"
            : complete
              ? "candidate"
              : "incomplete",
        evidence: !validAddress
          ? [
              "Not a valid host address in a known VLAN subnet. No allocation can be proposed.",
            ]
          : conflicts.length
            ? conflicts.map(
                (a) => `${a.kind}: ${a.owner} (${a.mac}) · ${a.source}`,
              )
            : complete
              ? [
                  "Inventory static assignments: no conflicting owner",
                  "OPNsense leases + ARP: no conflicting owner (simulated)",
                  "pi-admin DHCP reservations: no conflicting owner",
                  "Ping silence is supplementary, not proof. Candidate requires an authorized reservation.",
                ]
              : [
                  "DHCP collector unreachable. Static inventory alone cannot establish availability.",
                  "Silent ping does not prove an address is free.",
                ],
      };
      event(
        "Human",
        state.devices.find((d) => d.mac === mac)?.id ?? "",
        state.ports.find(
          (p) => p.deviceId === state.devices.find((d) => d.mac === mac)?.id,
        )?.id ?? state.draft.portId,
        "address",
        `Address check: ${ip}`,
        state.addressCheck.evidence.join("; "),
        state.addressCheck.status,
      );
      publish();
      return state.addressCheck;
    },
    propose(input) {
      if (!["Human", "Alshival"].includes(input.actor))
        throw new Error("Actor has no delegated demo capability.");
      const d = device(input.deviceId);
      const p: Plan = {
        id: uid("plan"),
        kind: input.kind,
        actor: input.actor,
        deviceId: d.id,
        portId: input.portId,
        expectedMac: d.mac,
        expectedSerial: d.serial,
        vlan: input.vlan ?? d.vlan,
        ip: input.ip ?? d.ip,
        status: "proposed",
        createdAt: time(),
        summary: "",
      };
      validate(p);
      p.summary =
        p.kind === "poe"
          ? `Cycle PoE on ${p.portId}; interrupt ${d.hostname}, then verify identity and SSH.`
          : p.kind === "vlan"
            ? `Move ${d.hostname}: VLAN ${d.vlan} → ${p.vlan}; address ${d.ip} → ${p.ip}. Verify isolation and reconnect.`
            : `Provision ${d.hostname} on ${p.portId} · VLAN ${p.vlan} · ${p.ip}. SD writing is a separate imaging-agent handoff.`;
      edit();
      state.plans.unshift(p);
      event(
        p.actor,
        d.id,
        p.portId,
        p.kind,
        "Plan proposed",
        p.summary,
        "Awaiting execution",
      );
      publish();
      return p;
    },
    execute(id) {
      const original = state.plans.find((p) => p.id === id);
      if (!original) throw new Error("Plan not found.");
      const existing = state.jobs.find((j) => j.planId === id);
      if (existing) return existing;
      validate(original);
      if (original.kind === "provision" && !original.handoffReady)
        throw new Error(
          "Generate the reviewed SD handoff before running a provisioning plan.",
        );
      edit();
      const p = state.plans.find((p) => p.id === id)!;
      p.status = "executed";
      const labels =
        p.kind === "provision"
          ? [
              "PoE delivery",
              "Ethernet link",
              "Expected MAC",
              "Allocated IP",
              "SSH host identity",
              "cloud-init",
              "Root filesystem growth",
              "DNS resolution",
              "Package updates",
              "Reboot & reconnect",
            ]
          : p.kind === "poe"
            ? [
                "Power off confirmed",
                "PoE restored",
                "Expected MAC",
                "SSH host identity",
                "Service health",
              ]
            : [
                "Port VLAN applied",
                "Isolation boundary",
                "Allocated IP",
                "Expected MAC",
                "SSH host identity",
              ];
      const j: Job = {
        id: uid("job"),
        planId: id,
        kind: p.kind,
        deviceId: p.deviceId,
        portId: p.portId,
        actor: p.actor,
        state: p.kind === "provision" ? "waiting" : "running",
        checks: labels.map((label) => ({
          label,
          state: "pending",
          evidence: "",
          source: /PoE|Power|Ethernet|MAC|VLAN/.test(label)
            ? "Aruba · simulated"
            : /IP|DNS|Isolation/.test(label)
              ? "OPNsense / pi-admin · simulated"
              : "Pi agent / SSH · simulated",
          collectedAt: null,
        })),
        failOnce: p.kind === "provision" && p.deviceId === "pi-17",
        attempts: 1,
        createdAt: time(),
      };
      state.jobs.unshift(j);
      if (
        p.kind !== "poe" &&
        !state.addresses.some((a) => a.ip === p.ip && a.mac === p.expectedMac)
      ) {
        state.addresses.push({
          ip: p.ip,
          mac: p.expectedMac,
          kind: "reservation",
          owner: device(p.deviceId).hostname,
          source: `Demo job ${j.id}`,
          collectedAt: time(),
        });
      }
      device(p.deviceId).health = "maintenance";
      port(p.portId).health = "maintenance";
      event(
        j.actor,
        j.deviceId,
        j.portId,
        j.kind,
        "Job started",
        j.state === "waiting"
          ? "Waiting for physical installation. No disk write performed."
          : p.summary,
        j.state,
        j.id,
      );
      publish();
      return j;
    },
    follow: job,
    advance() {
      if (!state.jobs.some((j) => j.state === "running")) {
        if (Date.now() - Date.parse(state.clock) > 30000) publish();
        return;
      }
      edit();
      for (const j of state.jobs.filter((j) => j.state === "running")) {
        const p = state.plans.find((p) => p.id === j.planId)!;
        const d = device(j.deviceId);
        const pt = port(j.portId);
        const next = j.checks.find((c) => c.state === "pending");
        if (!next) continue;
        next.collectedAt = time();
        if (
          d.mac !== p.expectedMac ||
          d.serial !== p.expectedSerial ||
          pt.observedMac !== p.expectedMac
        ) {
          next.state = "failed";
          next.evidence =
            "Board identity changed. Stop and reconcile before retry.";
          j.state = "failed";
        } else if (next.label === "Package updates" && j.failOnce) {
          next.state = "failed";
          next.evidence =
            "Temporary package mirror error (HTTP 503). Retry is safe; previous checks are preserved.";
          j.failOnce = false;
          j.state = "failed";
        } else {
          next.state = "passed";
          next.evidence =
            next.label === "Expected MAC"
              ? p.expectedMac
              : next.label === "Allocated IP"
                ? p.ip
                : next.label === "Root filesystem growth"
                  ? `${d.sd} GB nominal SD · root expanded to available capacity`
                  : next.label === "SSH host identity"
                    ? `Expected enrolled demo identity for ${d.serial} matched`
                    : `${next.label} confirmed by fixture collector`;
        }
        event(
          j.actor,
          j.deviceId,
          j.portId,
          j.kind,
          next.label,
          `${next.source}: ${next.evidence}`,
          next.state,
          j.id,
        );
        if (j.checks.every((c) => c.state === "passed")) {
          j.state = "complete";
          d.health = "ready";
          pt.health = "ready";
          pt.link = "1 Gbps";
          pt.collectedAt = time();
          pt.quality = "current";
          if (p.kind !== "poe") {
            d.vlan = p.vlan;
            pt.vlan = p.vlan;
            d.ip = p.ip;
            state.addresses = state.addresses.filter(
              (a) =>
                !(
                  a.mac === d.mac &&
                  (a.kind === "static" ||
                    (a.kind === "reservation" &&
                      a.source === `Demo job ${j.id}`))
                ),
            );
            state.addresses.push({
              ip: p.ip,
              mac: d.mac,
              kind: "static",
              owner: d.hostname,
              source: "Authorized demo plan",
              collectedAt: time(),
            });
          }
          d.ssh = `SHA256:DEMO-${d.serial}`;
          d.observations
            .filter((o) => /health/i.test(o.label))
            .forEach((o) => {
              o.quality = "historical";
            });
          d.observations.unshift({
            id: uid("observation"),
            subject: d.id,
            label: "Verified health",
            value: "ready",
            source: `Job ${j.id} · simulated`,
            collectedAt: time(),
            quality: "current",
          });
          event(
            j.actor,
            j.deviceId,
            j.portId,
            j.kind,
            "Verification complete",
            "All checks passed. Evidence retained in this job.",
            "Complete",
            j.id,
          );
        }
      }
      publish();
    },
    install(id) {
      if (job(id).state !== "waiting")
        throw new Error("Job is not waiting for installation.");
      edit();
      job(id).state = "running";
      event(
        job(id).actor,
        job(id).deviceId,
        job(id).portId,
        "provision",
        "Physical installation simulated",
        "Continue first-boot verification; no hardware touched.",
        "Running",
        id,
      );
      publish();
    },
    resume(id) {
      const j = job(id);
      if (j.state !== "failed")
        throw new Error("Only failed jobs can be resumed.");
      identity(port(j.portId), device(j.deviceId));
      edit();
      const next = job(id);
      next.checks
        .filter((c) => c.state === "failed")
        .forEach((c) => {
          c.state = "pending";
          c.evidence = "";
          c.collectedAt = null;
        });
      next.state = "running";
      next.attempts++;
      event(
        next.actor,
        next.deviceId,
        next.portId,
        next.kind,
        "Verification resumed",
        "Retry failed check; preserve successful evidence.",
        "Running",
        id,
      );
      publish();
    },
    finish(id) {
      const j = job(id);
      if (j.state !== "complete")
        throw new Error("All verification checks must pass first.");
      if (state.draft.finished) return;
      edit();
      const d = device(j.deviceId);
      d.role = state.draft.purpose;
      d.workload = d.role === "General spare" ? "Unassigned" : d.role;
      state.draft.finished = true;
      state.draft.step = 5;
      event(
        "Human",
        d.id,
        j.portId,
        "provision",
        d.role === "General spare"
          ? "Board marked available"
          : "Board assigned",
        "Inventory updated in demo. 1Password changes are preview only; no external writes.",
        "Complete",
        id,
      );
      publish();
    },
    updateDraft(patch) {
      edit();
      const invalidate = [
        "portId",
        "model",
        "ram",
        "mac",
        "serial",
        "purpose",
        "vlan",
        "ip",
        "image",
      ].some(
        (k) =>
          k in patch &&
          patch[k as keyof Draft] !== state.draft[k as keyof Draft],
      );
      if (invalidate && state.draft.jobId)
        throw new Error(
          "A provisioning job already exists. Finish or reset the demo before changing its inputs.",
        );
      state.draft = {
        ...state.draft,
        ...patch,
        ...(invalidate ? { handoffGenerated: false, planId: null } : {}),
      };
      if (invalidate) state.addressCheck = null;
      publish();
    },
    identify() {
      const f = state.draft;
      const pt = port(f.portId);
      if (pt.type !== "Ethernet")
        throw new Error("Choose an Ethernet PoE port.");
      if (
        !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(f.mac) ||
        !/^[a-z0-9]{8,32}$/i.test(f.serial)
      )
        throw new Error("Enter a valid MAC and 8–32 character board serial.");
      const known = state.devices.find(
        (d) => d.mac === f.mac || d.serial === f.serial,
      );
      if (known && (known.mac !== f.mac || known.serial !== f.serial))
        throw new Error(
          "MAC and serial identify different boards. Reconcile inventory.",
        );
      if (pt.deviceId && pt.deviceId !== known?.id)
        throw new Error(
          "Occupied port: this attachment belongs to a different board.",
        );
      if (known) {
        identity(pt, known);
        if (known.ram !== f.ram || known.model !== f.model)
          throw new Error(
            "Recorded model or RAM disagrees with the detected board.",
          );
        return known;
      }
      edit();
      const d: Device = {
        id: uid("pi"),
        serial: f.serial,
        mac: f.mac.toLowerCase(),
        model: f.model,
        ram: f.ram,
        sd: 64,
        nvme: null,
        hat: false,
        hostname: `pi-new-${pt.number}`,
        ip: "",
        role: f.purpose,
        workload: "Unassigned",
        vlan: f.vlan,
        health: "powered",
        capacity: 100,
        watts: 3.2,
        ssh: "Not enrolled",
        observations: [
          {
            id: uid("obs"),
            subject: f.serial,
            label: "Board identity",
            value: `${f.mac} / ${f.serial}`,
            source: "Human identification · demo",
            collectedAt: time(),
            quality: "current",
          },
        ],
      };
      state.devices.push(d);
      const target = port(f.portId);
      target.deviceId = d.id;
      target.observedMac = d.mac;
      target.health = "powered";
      target.collectedAt = time();
      target.quality = "current";
      event(
        "Human",
        d.id,
        target.id,
        "identify",
        "Board identified",
        "Attachment recorded using MAC and serial.",
        "Recorded",
      );
      publish();
      return d;
    },
    handoff() {
      const f = state.draft;
      if (f.image !== image.id)
        throw new Error("Select the verified fixture image.");
      const d = api.identify();
      const p = state.plans.find((p) => p.id === f.planId);
      if (!p)
        throw new Error(
          "Review a provisioning plan before creating the handoff.",
        );
      validate(p);
      const text = `# DEMO ONLY — NOT AN EXECUTABLE IMAGING REQUEST\n# Checksums, public key and image below are fixtures; do not write a disk.\n\nPlan: ${p.id}\nBoard: ${d.serial}\nExpected MAC: ${d.mac}\nPort: ${f.portId}\nImage: ${image.file}\nFixture SHA-256: ${image.sha256}\nManifest verification: SIMULATED, replace with a signed verified production manifest.\n\nTARGET CARD: intentionally UNSELECTED\nLocal imaging agent must identify physical device path, card serial and capacity, exclude system disks, and obtain matching explicit disk-erasure authorization. No erase authorization is included here.\n\n#cloud-config\nhostname: ${d.hostname}\nusers:\n  - name: alshival\n    groups: [sudo]\n    shell: /bin/bash\n    ssh_authorized_keys:\n      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICt3YUrMR4stqNgyYxiNORZbl7DdH8/O6XNFivRl+zUI demo-only-no-private-key-retained\nssh_pwauth: false\ndisable_root: true\ngrowpart:\n  mode: auto\n  devices: ['/']\nresize_rootfs: true\npackage_update: true\n\n# network-config (fixture)\nversion: 2\nethernets:\n  eth0:\n    match:\n      macaddress: '${d.mac}'\n    dhcp4: false\n    addresses: [${f.ip}/24]\n    routes:\n      - to: default\n        via: ${network(f.vlan).gateway}\n    nameservers:\n      addresses: [${network(f.vlan).gateway}]\n\nVerification: verify signed manifest and image checksum; confirm target-card identity; verify written bytes; physically install; confirm PoE, link, expected MAC/IP and trusted SSH host identity; verify cloud-init, root growth, DNS, updates, reboot and reconnection.\nInventory/1Password: preview only. Credentials remain server-side in future adapters.\n`;
      edit();
      state.draft.handoffGenerated = true;
      state.plans.find((plan) => plan.id === p.id)!.handoffReady = true;
      publish();
      return text;
    },
    reset() {
      state = createFixtures();
      publish();
    },
    restore(value) {
      try {
        const parsed = value as DemoState;
        if (
          parsed.version !== 1 ||
          !Array.isArray(parsed.ports) ||
          parsed.ports.length !== 52 ||
          !Array.isArray(parsed.devices) ||
          !Array.isArray(parsed.jobs) ||
          !Array.isArray(parsed.activity) ||
          !parsed.draft ||
          !Array.isArray(parsed.networks) ||
          !Array.isArray(parsed.addresses) ||
          !Array.isArray(parsed.plans)
        )
          return false;
        state = structuredClone(parsed);
        publish();
        return true;
      } catch {
        return false;
      }
    },
  };
  return api;
}
