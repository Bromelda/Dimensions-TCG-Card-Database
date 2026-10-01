// Generate web derivatives; original Unity-exported PNGs are never modified.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');

async function main() {
  const source = path.join(root, 'images/cards');
  const output = path.join(root, 'images/optimized');
  await fs.mkdir(path.join(output, 'thumb'), { recursive: true });
  await fs.mkdir(path.join(output, 'detail'), { recursive: true });
  const names = (await fs.readdir(source)).filter(n => /\.png$/i.test(n)).sort();
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(path.join(root, 'data/artwork-manifest.json'), 'utf8')); } catch {}
  const manifest = {};
  let originalBytes = 0, thumbnailBytes = 0, detailBytes = 0;
  // Bounded work avoids exhausting RAM on the full artwork catalog.
  for (const [index, name] of names.entries()) {
    const bytes = await fs.readFile(path.join(source, name));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    const base = name.replace(/\.png$/i, '.webp');
    const thumb = path.join(output, 'thumb', base);
    const detail = path.join(output, 'detail', base);
    const unchanged = previous['./images/cards/' + name]?.thumb?.endsWith('?v=' + hash)
      && fsSyncExists(thumb) && fsSyncExists(detail);
    if (!unchanged) {
      await sharp(bytes).resize({ width: 420, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(thumb);
      await sharp(bytes).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toFile(detail);
    }
    originalBytes += bytes.length;
    thumbnailBytes += (await fs.stat(thumb)).size;
    detailBytes += (await fs.stat(detail)).size;
    manifest['./images/cards/' + name] = {
      thumb: './images/optimized/thumb/' + base + '?v=' + hash,
      detail: './images/optimized/detail/' + base + '?v=' + hash
    };
    if ((index + 1) % 50 === 0) console.log(`Optimized ${index + 1}/${names.length}`);
  }
  await fs.writeFile(path.join(root, 'data/artwork-manifest.json'), JSON.stringify(manifest));
  console.log(JSON.stringify({ cards: names.length, originalBytes, thumbnailBytes, detailBytes,
    thumbnailReduction: (100 * (1 - thumbnailBytes / originalBytes)).toFixed(1) + '%' }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
function fsSyncExists(file) { return require('node:fs').existsSync(file); }
