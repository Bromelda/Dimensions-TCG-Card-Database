// Isolated local browser regression harness. Never opens the user's browser profile.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.png':'image/png' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(data);
  });
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await chromium.launch({headless:true}); }
  catch (error) {
    if (!error.message.includes("Executable doesn't exist")) throw error;
    browser = await chromium.launch({headless:true,channel:'msedge'});
  }
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [], imageRequests = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('BROWSER ERROR:', e.message); });
    page.on('request', r => {if (/images\//.test(r.url())) imageRequests.push(r.url());});
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 36);
    assert.equal(await page.locator('.card').count(), 36);
    assert.equal(await page.locator('.points-tag').count(), 36);
    await page.waitForFunction(() => [...document.querySelectorAll('.card img')].slice(0,4).every(img => img.complete));
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/archive-desktop.png')});
    assert.equal(await page.locator('[id*="import"], [id*="export"], #deckCodeInput').count(), 0);
    await page.locator('#loadMoreBtn').click();
    assert.equal(await page.locator('.card').count(), 72);
    await page.locator('#searchInput').fill('quest');
    await page.waitForFunction(() => document.querySelectorAll('.card').length > 0 && document.querySelectorAll('.card').length < 36);
    assert.match(await page.locator('.card-grid').innerText(), /Questing Villager/);
    await page.locator('.details-btn').first().click();
    await page.locator('#cardModal').waitFor({state:'visible'});
    assert.notEqual(await page.locator('#modalPoints').innerText(), '');
    await page.screenshot({path:path.join(root,'test-results/card-details.png')});
    await page.locator('#closeModal').click();
    await page.locator('#clearFiltersBtn').click();
    await page.locator('[data-card-type="Spell"]').click();
    assert.ok(await page.evaluate(() => filteredCards.every(c => c.cardType === 'Spell')));
    await page.locator('[data-card-type=""]').click();
    await page.locator('#searchInput').fill('points>=3');
    await page.waitForFunction(() => filteredCards.length > 0 && filteredCards.every(c => c.deckPoints >= 3));
    await page.locator('#sortSelect').selectOption('points-desc');
    assert.ok(await page.evaluate(() => filteredCards.every((c,i,a) => i === 0 || a[i-1].deckPoints >= c.deckPoints)));
    await page.locator('.add-deck-btn').first().click();
    assert.equal(await page.locator('#mainDeckCount').innerText(), '1');
    assert.notEqual(await page.locator('#deckPointsValue').innerText(), '0 / 100');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#mainDeckCount').textContent === '1');
    await page.locator('#deckNameInput').fill('Regression deck');
    await page.locator('#renameDeckBtn').click();
    await page.locator('#duplicateDeckBtn').click();
    assert.equal(await page.locator('#deckSelect option').count(), 2);
    await page.locator('#deleteDeckBtn').click();
    assert.equal(await page.locator('#deckSelect option').count(), 1);
    assert.ok(await page.evaluate(() => {
      const before = getDeckPoints(); const card = allCards.find(c => c.deckPoints > 0);
      const original = card.deckPoints; card.deckPoints = 101;
      addCardToDeck(card); card.deckPoints = original; return getDeckPoints() === before;
    }));
    await page.locator('#clearFiltersBtn').click();
    assert.ok(await page.evaluate(() => allCards.every(c => Number.isInteger(c.deckPoints) && c.deckPoints >= 0)));
    await page.locator('#searchHelpBtn').click();
    await page.locator('#searchHelp').waitFor({state:'visible'});
    assert.equal(imageRequests.filter(url => /images\/cards\//.test(url)).length, 0);
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/desktop.png')});
    for (const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      await page.reload();
      await page.waitForFunction(() => document.querySelectorAll('.card').length > 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`);
      await page.locator('#mobileFiltersToggle').click();
      await page.locator('#searchInput').fill('quest');
      await page.waitForFunction(() => filteredCards.length > 0 && filteredCards.length < 36);
      await page.locator('.details-btn').first().click();
      await page.locator('#cardModal').waitFor({state:'visible'});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#closeModal').click();
      await page.locator('#mobileFiltersToggle').click();
      await page.locator('#deckCollapseBtn').click();
      await page.locator('#deckSelect').waitFor({state:'visible'});
      await page.locator('#deckCollapseBtn').click();
      await page.screenshot({path:path.join(root,`test-results/mobile-${width}.png`)});
    }
    assert.deepEqual(errors, []);
    console.log('PASS: bounded gallery, progressive loading, partial/advanced search, filters, points/sorting/cap, card modal, deck persistence/rename/duplicate/delete, mobile 390/320px, no original PNG gallery requests, no JS errors.');
    console.log(`Artwork requests during checks: ${imageRequests.length} (WebP only).`);
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;}).finally(() => server.close());
