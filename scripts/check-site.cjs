// Isolated local browser regression harness. Never opens the user's browser profile.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const totalCards = JSON.parse(fs.readFileSync(path.join(root, 'data/cards.json'), 'utf8')).Items.length;
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
    assert.equal(await page.locator('.card-art .mana-orb').count(), 0);
    assert.equal(await page.locator('.card-body .tag-mana .mana-icon').count(), 36);
    await page.locator('.card-body .tag-mana').first().waitFor({state:'visible'});
    await page.locator('.card-body .tag-mana').first().scrollIntoViewIfNeeded();
    assert.match((await page.locator('.card-body .tag-mana').first().textContent()).trim(), /^Mana \d+$/);
    await page.waitForFunction(() => [...document.querySelectorAll('.card img')].slice(0,4).every(img => img.complete));
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/archive-desktop.png')});
    assert.equal(await page.locator('[id*="import"], [id*="export"], #deckCodeInput').count(), 0);
    await page.locator('#pointsFilter').selectOption('0');
    assert.ok(await page.evaluate(() => filteredCards.length > 0 && filteredCards.every(card => card.deckPoints === 0)));
    assert.match(page.url(), /points=0/);
    await page.reload();
    await page.waitForFunction(total => allCards.length === total, totalCards);
    assert.equal(await page.locator('#pointsFilter').inputValue(), '0');
    assert.ok(await page.evaluate(() => filteredCards.every(card => card.deckPoints === 0)));
    await page.locator('#pointsFilter').selectOption('2');
    const compatibleMana = await page.evaluate(() => String(filteredCards[0].manaCost));
    await page.locator('#manaFilter').selectOption(compatibleMana);
    assert.ok(await page.evaluate(() => filteredCards.length > 0 && filteredCards.every(card => card.deckPoints === 2 && String(card.manaCost) === manaFilter.value)));
    await page.locator('#clearFiltersBtn').click();
    assert.equal(await page.locator('#pointsFilter').inputValue(), '');
    assert.ok(await page.evaluate(() => filteredCards.length === allCards.length));
    // URL filter takes priority over a previously saved selection.
    await page.goto(origin + '/?points=3');
    await page.waitForFunction(total => allCards.length === total, totalCards);
    assert.equal(await page.locator('#pointsFilter').inputValue(), '3');
    assert.ok(await page.evaluate(() => filteredCards.length > 0 && filteredCards.every(card => card.deckPoints === 3)));
    await page.locator('#clearFiltersBtn').click();
    assert.match(await page.locator('script[src*="app.js"]').getAttribute('src'), /\?v=/);
    assert.ok(await page.evaluate(() => allCards.some(card => card.relatedCardIds.length > 0)), 'Published Unity relationships are present');
    assert.ok(await page.evaluate(() => allCards.every(card => card.relatedCardIds.every(id =>
      cardsById.has(id) && id !== card.cardId && cardsById.get(id).relatedCardIds.includes(card.cardId)))),
      'Publication graph has no missing/self/asymmetric links');
    const actualRelation = await page.evaluate(() => {
      const source = allCards.find(card => !isFusionCard(card) && card.relatedCardIds.length > 0 &&
        card.relatedCardIds.length <= 12 && !isFusionCard(getRelatedCards(card)[0]));
      if (!source) throw new Error('No non-Fusion relationship sample in actual exported graph');
      openModal(source);
      return { source: source.name, partner: getRelatedCards(source)[0].name, count: source.relatedCardIds.length };
    });
    assert.match(await page.locator('#modalRelatedJumpBtn').innerText(), new RegExp(`\\(${actualRelation.count}\\)`));
    assert.equal(await page.locator('#modalRelatedCards .related-card').count(), actualRelation.count);
    await page.locator('#modalRelatedJumpBtn').click();
    await page.screenshot({path:path.join(root,'test-results/related-cards-desktop.png')});
    await page.locator('#modalRelatedCards .related-details').first().click();
    assert.equal(await page.locator('#modalName').innerText(), actualRelation.partner);
    await page.locator('#modalRelatedBackBtn').click();
    assert.equal(await page.locator('#modalName').innerText(), actualRelation.source);
    await page.locator('#closeModal').click();
    // Small controlled fixture also covers single-card additions and sidebar relationships.
    const relationFixture = await page.evaluate(() => {
      const source = allCards[0], partner = allCards[1];
      window.relatedGraphFixtureBackup = [source.relatedCardIds, partner.relatedCardIds];
      source.relatedCardIds = [partner.cardId];
      partner.relatedCardIds = [source.cardId];
      openModal(source);
      return { source: source.name, partner: partner.name };
    });
    assert.equal(await page.locator('#modalRelatedCards .related-card').count(), 1);
    await page.locator('#modalRelatedCards .related-details').click();
    assert.equal(await page.locator('#modalName').innerText(), relationFixture.partner);
    await page.locator('#modalRelatedBackBtn').click();
    assert.equal(await page.locator('#modalName').innerText(), relationFixture.source);
    await page.locator('#modalRelatedCards .related-add').click();
    assert.equal(await page.evaluate(() => deckState.main.length + deckState.fusion.length), 1);
    assert.match(await page.locator('#deckRelatedCards').innerText(), new RegExp(relationFixture.source));
    await page.evaluate(() => {
      deckState.main = []; deckState.fusion = [];
      [allCards[0].relatedCardIds, allCards[1].relatedCardIds] = window.relatedGraphFixtureBackup;
      saveDeckLibrary(); renderDeck();
    });
    await page.locator('#closeModal').click();
    assert.ok(await page.evaluate(() => {
      const raw = { cardId: 'freshness-test', name: 'Test', image: './images/cards/questing_villager.png' };
      const revision = artworkManifest[raw.image].artworkRevision;
      const cached = normalizeCardData({...raw,artworkRevision:revision});
      const changed = normalizeCardData({...raw,artworkRevision:'new-revision'});
      const missing = normalizeCardData({...raw,image:'./images/cards/unexported.png'});
      return cached.thumbnail.includes('/optimized/') && changed.thumbnail === raw.image && !changed.imageIssue && missing.imageIssue && !missing.thumbnail;
    }));
    await page.locator('#loadMoreBtn').evaluate(button => button.click());
    assert.equal(await page.locator('.card').count(), 72);
    await page.locator('.load-more-row').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.card').length > 72);
    const automaticallyLoaded = await page.locator('.card').count();
    assert.ok(automaticallyLoaded < totalCards, 'Scrolling appends a batch, not the entire catalog');
    await page.evaluate(() => window.scrollTo(0, 0));
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
      await page.locator('.card-body .tag-mana').first().waitFor({state:'visible'});
      await page.locator('#mobileFiltersToggle').click();
      await page.locator('#clearFiltersBtn').click();
      await page.locator('#pointsFilter').selectOption('0');
      assert.ok(await page.evaluate(() => filteredCards.length > 0 && filteredCards.every(card => card.deckPoints === 0)));
      await page.locator('#pointsFilter').selectOption('');
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
    const fallback = await browser.newPage();
    await fallback.addInitScript(() => { window.IntersectionObserver = undefined; });
    await fallback.goto(origin);
    await fallback.waitForFunction(() => document.querySelectorAll('.card').length === 36);
    await fallback.locator('#loadMoreBtn').click();
    assert.equal(await fallback.locator('.card').count(), 72);
    await fallback.close();
    console.log('PASS: actual Unity related-card graph and non-Fusion browsing, back navigation, single-card partner additions, cache-versioned assets, bounded gallery/scroll loading, search/filters/points/cap, deck persistence, mobile 390/320px, WebP gallery, no JS errors.');
    console.log(`Artwork requests during checks: ${imageRequests.length} (WebP only).`);
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;}).finally(() => server.close());
