import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const shotDir = path.resolve('.test-shots');
fs.mkdirSync(shotDir, { recursive: true });

const server = await createServer({ server: { port: 5190 } });
await server.listen();
const url = 'http://localhost:5190/';

const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 920 } });

const errors = [];
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text());
});

console.log('Opening', url);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Main menu screenshot
await page.screenshot({ path: path.join(shotDir, '01-main-menu.png') });
console.log('Saved 01-main-menu.png');

// Switch to Necropolis in setup just to test UI reactivity, then back to Castle
await page.click('[data-fac="necropolis"]');
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(shotDir, '01b-menu-necropolis.png') });
await page.click('[data-fac="castle"]');
await page.waitForTimeout(200);

// 2. Start new game -> Adventure map
await page.click('#btn-start-new');
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(shotDir, '02-adventure-map.png') });
console.log('Saved 02-adventure-map.png');

// 3. Plan a path & move hero a couple tiles
await page.evaluate(async () => {
  const g = window.__game;
  const ui = window.__ui;
  const h = ui.selectedHero;
  // Find a reachable nearby tile
  await ui.onTileClick(h.x + 2, h.y + 2);
});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, '03-pathfinding.png') });
console.log('Saved 03-pathfinding.png');

// 4. Open Hero Screen
await page.click('#insp-hero-open');
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(shotDir, '04-hero-screen.png') });
console.log('Saved 04-hero-screen.png');
await page.click('.modal-card [data-close]');
await page.waitForTimeout(300);

// 5. Open Castle 3D Town Screen (and build a structure)
await page.evaluate(() => {
  const g = window.__game;
  const ui = window.__ui;
  const town = g.state.objects[g.state.townIds[0]];
  // Add extra buildings to showcase the 3D town diorama
  for (const b of ['hall2', 'citadel', 'castle', 'marketplace', 'blacksmith', 'mage1', 'mage2', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7']) {
    if (!town.built.includes(b)) town.built.push(b);
  }
  ui.openTown(town, ui.selectedHero);
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(shotDir, '05-town-castle-3d.png') });
console.log('Saved 05-town-castle-3d.png');

// Open Build modal inside town
await page.click('#tbtn-build');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, '06-town-build-modal.png') });
console.log('Saved 06-town-build-modal.png');
await page.click('.modal-card [data-close]');
await page.waitForTimeout(250);
await page.click('#btn-town-exit');
await page.waitForTimeout(350);

// 7. Open Necropolis 3D Town Screen
await page.evaluate(() => {
  const g = window.__game;
  const ui = window.__ui;
  const town = g.state.objects[g.state.townIds[1]];
  for (const b of ['hall2', 'citadel', 'castle', 'marketplace', 'blacksmith', 'mage1', 'mage2', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7', 'special']) {
    if (!town.built.includes(b)) town.built.push(b);
  }
  ui.openTown(town, null);
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(shotDir, '07-town-necropolis-3d.png') });
console.log('Saved 07-town-necropolis-3d.png');
await page.click('#btn-town-exit');
await page.waitForTimeout(350);

// 8. Trigger a 3D Battle with diverse units
page.evaluate(() => {
  const g = window.__game;
  const ui = window.__ui;
  const h = ui.selectedHero;
  h.spells = ['magicArrow', 'lightningBolt', 'fireball', 'bless', 'haste', 'cure'];
  h.mana = 50;
  h.army = [
    { type: 'halberdier', count: 28 },
    { type: 'marksman', count: 16 },
    { type: 'royalGriffin', count: 9 },
    { type: 'crusader', count: 6 },
    { type: 'zealot', count: 5 },
    { type: 'champion', count: 3 },
    { type: 'archangel', count: 2 },
  ];
  const defArmy = [
    { type: 'skeletonWarrior', count: 40 },
    { type: 'zombie', count: 20 },
    { type: 'wraith', count: 10 },
    { type: 'vampireLord', count: 6 },
    { type: 'powerLich', count: 4 },
    { type: 'dreadKnight', count: 3 },
    { type: 'boneDragon', count: 2 },
  ];
  g.fight(h, { army: defArmy, owner: 1, name: 'צבא האופל' }, 'monster');
});
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(shotDir, '08-battle-3d.png') });
console.log('Saved 08-battle-3d.png');

// Open spellbook in battle
await page.click('#bbtn-spell');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, '09-battle-spellbook.png') });
console.log('Saved 09-battle-spellbook.png');

console.log('Captured errors count:', errors.length);
for (const e of errors) console.error(e);

await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
