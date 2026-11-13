import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(process.env.NEON_COUNTY_URL || 'http://127.0.0.1:8791/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.NeonCountyStage1?.world?.enterableHouses?.length, { timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('neon_county_rebuilt_stage_1_v1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.NeonCountyStage1?.world?.enterableHouses?.length, { timeout: 60000 });
  await page.locator('#enter').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#hud')).display !== 'none');

  const houses = await page.evaluate(() => {
    const g = window.NeonCountyStage1;
    return g.world.hotspots.filter(h => h.type === 'house').map(h => ({
      x: h.x, z: h.z, radius: h.radius,
      doorX: h.entrance.doorX, doorZ: h.entrance.doorZ,
      normalX: h.entrance.normalX, normalZ: h.entrance.normalZ,
      facingYaw: h.entrance.facingYaw,
      houseX: h.house.x, houseZ: h.house.z,
    }));
  });
  assert.ok(houses.length >= 2, 'at least two measured house doorways should be enterable');
  await page.waitForTimeout(180);
  const minimapMarker = await page.evaluate(() => {
    const g = window.NeonCountyStage1, p = g.player;
    p.x = -11; p.z = 10; p.vx = p.vz = 0; g.cameraYaw = 0;
    const h = g.world.hotspots.filter(q => q.type === 'house').sort((a,b) => Math.hypot(a.x+11,a.z-10)-Math.hypot(b.x+11,b.z-10))[0];
    const x = Math.round(110 + (h.x-p.x)*.235), y = Math.round(110 + (h.z-p.z)*.235);
    return { x, y, color: [...document.querySelector('#minimap').getContext('2d').getImageData(x,y,1,1).data] };
  });
  assert.ok(minimapMarker.color[1] > minimapMarker.color[0] && minimapMarker.color[1] > minimapMarker.color[2], 'nearest enterable house should appear as a green minimap marker');

  async function approachEnterExit(house, screenshotPath) {
    const start = await page.evaluate(({ h }) => {
      const g = window.NeonCountyStage1;
      const p = g.player;
      // Begin just outside this mesh-measured entrance; the player then walks
      // to the trigger using the actual W input and camera-relative movement.
      p.x = h.x + h.normalX * 5.4;
      p.z = h.z + h.normalZ * 5.4;
      p.vx = p.vz = p.vy = 0;
      p.yaw = h.facingYaw;
      g.cameraYaw = h.facingYaw;
      return { x: p.x, z: p.z };
    }, { h: house });
    await page.keyboard.down('w');
    await page.waitForTimeout(1800);
    await page.keyboard.up('w');
    await page.waitForTimeout(220);
    const promptVisible = await page.locator('#hint').isVisible();
    const prompt = await page.locator('#hint').innerText();
    assert.equal(promptVisible, true, `door prompt should be visible; got ${prompt}`);
    const atDoor = await page.evaluate(() => ({ x: NeonCountyStage1.player.x, z: NeonCountyStage1.player.z }));
    assert.match(prompt, /Press E to Enter House/, `approach should show entry prompt; got ${prompt}; at=${JSON.stringify(atDoor)} marker=${JSON.stringify({x:house.x,z:house.z})}`);
    assert.ok(Math.hypot(atDoor.x - house.x, atDoor.z - house.z) < 2.8, 'keyboard approach should reach the measured door marker');
    await page.keyboard.press('e');
    await page.waitForFunction(() => NeonCountyStage1.insideSafehouse);
    await page.waitForTimeout(900);
    await page.waitForFunction(() => document.querySelector('#hint').classList.contains('hidden'));
    await page.screenshot({ path: screenshotPath });

    const interior = await page.evaluate(() => {
      const g = NeonCountyStage1, h = g.world.safehouse;
      let furniture = 0, walls = 0;
      h.root.traverse(o => { if (o.isMesh && /sofa|bed|kitchen|window/.test(o.name)) furniture++; if (o.isMesh && /wall|divider/.test(o.name)) walls++; });
      return { inside: g.insideSafehouse, visible: h.root.visible, furniture, walls,
        spawnCollision: g.world.safehouseCollision(h.spawnX, h.spawnZ),
        sofaCollision: g.world.safehouseCollision(391.2, 392.55),
        wallCollision: g.world.safehouseCollision(395, 389.2),
        x: g.player.x, z: g.player.z };
    });
    assert.equal(interior.inside, true);
    assert.equal(interior.visible, true);
    assert.ok(interior.furniture >= 8 && interior.walls >= 6, 'interior should contain visible rooms, walls, and furnishings');
    assert.equal(interior.spawnCollision, false, 'spawn should be walkable');
    assert.equal(interior.sofaCollision, true, 'sofa should block movement');
    assert.equal(interior.wallCollision, true, 'room wall should block movement');

    // Walk into the living room, then try to walk through the sofa.
    await page.evaluate(() => { const g = NeonCountyStage1; g.player.x = 394.3; g.player.z = 395.4; g.player.vx = g.player.vz = 0; g.cameraYaw = 0; });
    await page.waitForTimeout(250);
    const cameraBeforeWalk = await page.evaluate(() => ({ x: NeonCountyStage1.camera.position.x, z: NeonCountyStage1.camera.position.z }));
    await page.keyboard.down('a'); await page.waitForTimeout(650); await page.keyboard.up('a');
    const explored = await page.evaluate(() => ({ x: NeonCountyStage1.player.x, z: NeonCountyStage1.player.z, cameraX: NeonCountyStage1.camera.position.x, cameraZ: NeonCountyStage1.camera.position.z }));
    assert.ok(explored.x < 393.5, 'A should let the player explore the living room');
    assert.ok(Math.hypot(explored.cameraX-cameraBeforeWalk.x, explored.cameraZ-cameraBeforeWalk.z) > .1, 'third-person camera should follow the player indoors');
    await page.evaluate(() => { const p = NeonCountyStage1.player; p.x = 391.2; p.z = 394.7; p.vx = p.vz = 0; });
    await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
    const blocked = await page.evaluate(() => ({ z: NeonCountyStage1.player.z, inside: NeonCountyStage1.insideSafehouse }));
    assert.equal(blocked.inside, true, 'interior E should not exit away from the door');
    assert.ok(blocked.z > 392.45, `sofa should stop the player; final z=${blocked.z}`);

    // Return to the open hallway and walk south to the actual interior exit.
    await page.evaluate(() => { const g = NeonCountyStage1; g.player.x = 394.3; g.player.z = 395.4; g.player.vx = g.player.vz = 0; g.cameraYaw = Math.PI; });
    await page.keyboard.down('w'); await page.waitForTimeout(1050); await page.keyboard.up('w');
    await page.waitForTimeout(200);
    const exitVisible = await page.locator('#hint').isVisible();
    const exitPrompt = await page.locator('#hint').innerText();
    assert.equal(exitVisible, true, `exit prompt should be visible; got ${exitPrompt}`);
    assert.match(exitPrompt, /Press E to Exit House/, `interior exit should show prompt; got ${exitPrompt}`);
    await page.keyboard.press('e');
    await page.waitForFunction(() => !NeonCountyStage1.insideSafehouse);
    const returned = await page.evaluate(() => ({ x: NeonCountyStage1.player.x, z: NeonCountyStage1.player.z, visible: NeonCountyStage1.world.safehouse.root.visible }));
    assert.equal(returned.visible, false);
    assert.ok(Math.hypot(returned.x - house.x, returned.z - house.z) < .02, 'exit should return to this house entrance');
    assert.ok(Math.hypot(returned.x - start.x, returned.z - start.z) > .1, 'player walked to the door before entry');
    return { start, atDoor, interior, explored, blocked, returned };
  }

  const first = await approachEnterExit(houses[0], 'tests/gameplay-house-interior.png');
  const repeat = await approachEnterExit(houses[0], 'tests/gameplay-house-interior-repeat.png');
  const second = await approachEnterExit(houses[1], 'tests/gameplay-house-interior-second.png');

  // Check that the feature hasn't captured the car interaction or a melee input.
  const car = await page.evaluate(() => {
    const g = NeonCountyStage1, c = g.world.cars.find(q => q.id === 3);
    g.player.x = c.x; g.player.z = c.z + 3; g.player.vx = g.player.vz = 0;
    return { x: g.player.x, z: g.player.z, carX: c.x, carZ: c.z };
  });
  await page.keyboard.press('f');
  await page.waitForTimeout(120);
  const driving = await page.evaluate(() => !!NeonCountyStage1.car);
  assert.equal(driving, true, 'F should still enter a vehicle after house use');
  await page.keyboard.press('f');
  await page.waitForTimeout(120);
  const exitedCar = await page.evaluate(() => !NeonCountyStage1.car);
  assert.equal(exitedCar, true, 'F should still exit a vehicle after house use');
  const consoleErrors = [...errors];
  assert.deepEqual(consoleErrors, [], `browser should have no console errors: ${consoleErrors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, houses: houses.slice(0, 2), first, repeat, second, driving, exitedCar, consoleErrors }, null, 2));
} finally {
  await browser.close();
}
