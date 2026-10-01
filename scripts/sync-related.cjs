// Applies a read-only Unity DeckRelatedCardLookup snapshot to the existing publication catalog.
// Never adds cards or replaces artwork, rules text, points, or any other card data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/sync-related.cjs <Unity relationship snapshot.json>');
const rows = JSON.parse(fs.readFileSync(source, 'utf8'));
const graph = new Map(rows.map(row => [String(row.cardId), row.relatedCardIds]));
assert.equal(graph.size, rows.length, 'Duplicate snapshot IDs');
for (const [id, related] of graph) {
  assert.ok(Array.isArray(related), `Missing graph for ${id}`);
  assert.equal(new Set(related).size, related.length, `Duplicate partners for ${id}`);
  for (const partner of related) {
    assert.notEqual(partner, id, 'Self relation');
    assert.ok(graph.has(partner), `Unpublished partner ${partner}`);
    assert.ok(graph.get(partner).includes(id), `Asymmetric relation ${id}/${partner}`);
  }
}
const root = path.resolve(__dirname, '..');
const pending = [];
for (const name of ['cards', 'creatures', 'spells', 'fusions']) {
  const file = path.join(root, 'data', `${name}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cards = Array.isArray(data) ? data : data.Items;
  assert.ok(Array.isArray(cards), `Invalid ${name} catalog`);
  for (const card of cards) {
    assert.ok(graph.has(String(card.cardId)), `Unexported card ${card.cardId}`);
    card.relatedCardIds = graph.get(String(card.cardId));
  }
  pending.push([file, JSON.stringify(data, null, 4) + '\n']);
}
for (const [file, data] of pending) fs.writeFileSync(file, data);
console.log(`Synchronized ${graph.size} published card relationships across all four catalogs.`);
