import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.SWITCH_DEMO_URL || "http://127.0.0.1:18786";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = process.env.SWITCH_ARTIFACTS || "/tmp/switch-manager-artifacts";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1536, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const root = `${base}${process.env.SWITCH_DEMO_PATH || "/infrastructure/switch-manager"}`;
const tab = (name) =>
  page
    .getByRole("navigation", { name: "Switch Manager views" })
    .getByRole("button", { name, exact: true });
const button = (name) => page.getByRole("button", { name, exact: true });
const wait = async (fn) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await page.waitForTimeout(150);
  }
  throw new Error("Timed out awaiting acceptance condition.");
};
try {
  await page.goto(root);
  await page.locator(".sm-port").first().waitFor();
  assert.equal(await page.locator(".sm-port").count(), 52);
  for (let n = 1; n <= 52; n++) {
    const p = page.getByRole("button", { name: new RegExp(`^Port 1/1/${n},`) });
    await p.focus();
    await page.keyboard.press("Enter");
    await wait(
      async () => new URL(page.url()).searchParams.get("port") === `1/1/${n}`,
    );
  }
  await page.getByRole("button", { name: /^Port 1\/1\/16,/ }).click();
  await page.screenshot({ path: `${output}/rack-desktop.png`, fullPage: true });
  await tab("Fleet").click();
  await button("16 GB spares with NVMe").click();
  assert.equal(await page.locator(".sm-device-card").count(), 1);
  assert.match(
    await page.locator(".sm-device-card").innerText(),
    /pi-spare-12/,
  );
  await button("Clear filters").click();
  await page.getByRole("combobox", { name: /^Storage/ }).selectOption("hat");
  assert.equal(await page.locator(".sm-device-card").count(), 2);
  assert.match(
    await page.locator(".sm-device-card").first().innerText(),
    /no drive detected/,
  );
  await button("Table").click();
  assert.ok((await page.locator(".sm-table tbody tr").count()) >= 2);
  await tab("Rack").click();
  await page.getByRole("button", { name: /^Port 1\/1\/8,/ }).click();
  assert.match(
    await page.locator(".sm-inspector").innerText(),
    /disagrees with current detection/,
  );
  await page.getByRole("button", { name: /^Port 1\/1\/24,/ }).click();
  assert.match(await page.locator(".sm-inspector").innerText(), /unreachable/i);
  await button("Preview PoE cycle").click();
  assert.match(
    await page.locator(".sm-error").innerText(),
    /unavailable or stale/,
  );
  await page.getByRole("button", { name: /^Port 1\/1\/40,/ }).click();
  await button("Preview PoE cycle").click();
  assert.match(
    await page.locator(".sm-error").innerText(),
    /identity mismatch/,
  );
  await button("Dismiss error").click();
  await tab("Network").click();
  await page
    .getByRole("button", { name: "Select VLAN 72, Client / Atlas" })
    .focus();
  await page.keyboard.press("Enter");
  assert.match(
    await page.locator(".sm-boundary").innerText(),
    /Isolation boundary/,
  );
  await button("Table alternative").click();
  assert.match(await page.locator(".sm-center").innerText(), /pi-atlas-21/);
  await page.screenshot({
    path: `${output}/network-table.png`,
    fullPage: true,
  });
  await tab("Rack").click();
  await page.getByRole("button", { name: /^Port 1\/1\/16,/ }).click();
  await button("Draft with Alshival").click();
  await button("Run simulated plan").click();
  await wait(async () =>
    /5 \/ 5 checks passed/.test(
      await page.locator(".sm-operations").innerText(),
    ),
  );
  assert.match(await page.locator(".sm-operations").innerText(), /Alshival/);
  await page.screenshot({ path: `${output}/agent-job.png`, fullPage: true });
  await button("Close Operations Tray").click();
  await page
    .locator(".sm-inspector")
    .getByText("Move to another VLAN", { exact: true })
    .click();
  await button("Check target address").click();
  await button("Preview VLAN move").click();
  await button("Run simulated plan").click();
  await wait(async () =>
    /5 \/ 5 checks passed/.test(
      await page.locator(".sm-operations").innerText(),
    ),
  );
  await button("Close Operations Tray").click();
  assert.match(
    await page.locator(".sm-inspector").innerText(),
    /192.168.72.116/,
  );
  await button("Provision a Pi").click();
  await button("Continue").click();
  await button("Continue").click();
  await button("Check candidate").click();
  assert.match(
    await page.locator(".sm-address-evidence").innerText(),
    /Conflict/,
  );
  await button("Review provisioning plan").click();
  assert.match(
    await page.locator(".sm-error").innerText(),
    /complete address checks/,
  );
  await button("Try .41.118").click();
  await button("Simulate collector outage").click();
  assert.match(
    await page.locator(".sm-address-evidence").innerText(),
    /Incomplete/,
  );
  await button("Check candidate").click();
  await button("Review provisioning plan").click();
  await button("Generate handoff").click();
  assert.match(
    await page.getByLabel("SD preparation handoff").inputValue(),
    /ssh_authorized_keys/,
  );
  const download = page.waitForEvent("download");
  await button("Download").click();
  assert.match((await download).suggestedFilename(), /^DEMO-/);
  await button("Run simulated boot workflow").click();
  assert.match(
    await page.locator(".sm-wizard").innerText(),
    /Waiting for physical installation/,
  );
  await page.reload();
  await button("Simulate physical installation").click();
  await wait(async () => await button("Retry failed check").isVisible());
  assert.match(await page.locator(".sm-wizard").innerText(), /503/);
  await page.screenshot({
    path: `${output}/provisioning-failure.png`,
    fullPage: true,
  });
  await button("Retry failed check").click();
  await wait(async () => await button("Review completion").isEnabled());
  await button("Review completion").click();
  await button("Mark board available").click();
  assert.match(
    await page.locator(".sm-wizard").innerText(),
    /Inventory updated/,
  );
  await page.screenshot({
    path: `${output}/provisioning-complete.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Switch Manager views" })
    .getByRole("button", { name: /^Activity/ })
    .click();
  await page.getByRole("combobox", { name: /^Actor/ }).selectOption("Alshival");
  assert.match(
    await page.locator(".sm-timeline").innerText(),
    /Verification complete/,
  );
  await page.screenshot({ path: `${output}/activity.png`, fullPage: true });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(root);
  await mobile.locator(".sm-port").first().waitFor();
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile overflow",
  );
  await mobile.screenshot({
    path: `${output}/rack-mobile.png`,
    fullPage: true,
  });
  await mobile.getByRole("button", { name: /^Port 1\/1\/16,/ }).click();
  assert.ok(await mobile.locator(".sm-inspector").isVisible());
  assert.equal(await mobile.locator(".sm-center").isVisible(), false);
  const detailUrl = mobile.url();
  await mobile.reload();
  await mobile.locator(".sm-inspector").waitFor();
  assert.equal(mobile.url(), detailUrl);
  await mobile.screenshot({
    path: `${output}/inspector-mobile.png`,
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "Close device inspector" }).click();
  await mobile.getByRole("button", { name: "Network", exact: true }).click();
  assert.equal(
    await mobile
      .locator(".sm-net-path")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await mobile.close();
  page.once("dialog", (d) => d.accept());
  await button("Reset demo").click();
  await page.locator(".sm-port").first().waitFor();
  assert.equal(await page.locator(".sm-port").count(), 52);
  await button("Operations 0 proposed 0 active").click();
  assert.match(await page.locator(".sm-operations").innerText(), /No jobs yet/);
  assert.deepEqual(errors, [], "No browser exceptions or hydration errors");
  console.log(
    "PASS: 52 keyboard ports, fleet/HAT filters, conflicting/stale/swapped evidence, topology/table, agent PoE + human VLAN, provisioning/retry/persistence, mobile detail URLs, reduced motion, reset.",
  );
} finally {
  await browser.close();
}
