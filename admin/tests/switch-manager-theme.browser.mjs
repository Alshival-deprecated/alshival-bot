import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SWITCH_DEMO_URL || 'http://127.0.0.1:18787';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.SWITCH_ARTIFACTS || '/tmp/switch-theme-artifacts';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE });
try {
  const page = await browser.newPage({ viewport: {width:1536,height:1080}, colorScheme:'light' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/staff/infrastructure/switch-manager/`);
  const shell = page.locator('.switch-manager-shell');
  await shell.waitFor();
  const theme = value => page.locator(`[data-theme-choice="${value}"]`).click();
  const resolved = value => page.waitForFunction(expected => document.querySelector('#switch-manager-root').shadowRoot.querySelector('.switch-manager-shell').dataset.smTheme === expected, value);
  const tab = name => page.getByRole('navigation', { name:'Switch Manager views' }).getByRole('button', {name:name==='Activity'?/^Activity/:name,exact:name!=='Activity'});
  await resolved('light');
  for (const mode of ['light','dark']) {
    await theme(mode);
    await resolved(mode);
    for (const name of ['Rack','Network','Fleet','Provisioning','Activity']) {
      await tab(name).click();
      await page.screenshot({path:`${output}/${mode}-${name.toLowerCase()}.png`,fullPage:true});
    }
    await page.getByRole('button',{name:'Operations 0 proposed 0 active'}).click();
    await page.screenshot({path:`${output}/${mode}-operations.png`,fullPage:true});
    await page.getByRole('button',{name:'Operations 0 proposed 0 active'}).click();
  }
  await tab('Rack').click();
  await page.getByRole('button',{name:/^Port 1\/1\/17,/}).click();
  const selected = page.url();
  await theme('light');
  assert.equal(page.url(), selected, 'Theme changes preserve device selection');
  await page.reload();
  await resolved('light');
  assert.equal(page.url(), selected);
  await theme('system');
  await page.emulateMedia({colorScheme:'dark'});
  await resolved('dark');
  await page.emulateMedia({colorScheme:'light'});
  await resolved('light');
  await page.setViewportSize({width:390,height:844});
  for (const mode of ['light','dark']) {
    await theme(mode);
    await resolved(mode);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${output}/${mode}-mobile.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS light/dark across five views and tray; saved choice, OS theme changes, selection retention, mobile width, no browser exceptions.');
} finally { await browser.close(); }
