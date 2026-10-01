# DIMENSIONS — Card Archive

Static GitHub Pages card database and browser-local deck workshop. No framework, external font, account, or backend is required.

## Features

- Responsive purple/lime archive with card artwork, searchable effects, attribute/archetype/type filters, sorting, and accessible card details.
- Card points on tiles and details, point sorting, `points>=2` advanced search, and a combined Main + Fusion 100-point deck budget.
- Named decks, automatic browser-local saves, renaming, duplication, deck stats, and Fusion suggestions. Existing `dimensions_tcg_decks_v2` saves are preserved.
- Import/export, deck-code transfer, and shared-deck import controls have been removed. Filter URLs remain supported.
- A 36-card initial gallery with append-only Load More and native lazy image decoding. No full-size PNG gallery downloads when optimized artwork is available.

## Updating card data and artwork

1. Use the existing Unity Tools exports to update `data/*.json` and `images/cards/*.png`. The JSON exporter includes the game's authoritative `deckPoints` field.
2. Install Node.js, then run `npm install` once in this repository.
3. After artwork changes, run `npm run optimize`. This regenerates only changed artwork and `data/artwork-manifest.json`. Commit those outputs alongside the new original artwork/data.
4. Commit and push through GitHub Desktop or Git. The existing GitHub Pages deployment publishes the website.

The original PNGs are preserved. Web derivatives live in `images/optimized/thumb` (420px, WebP quality 80) and `images/optimized/detail` (1000px, quality 88). Content hashes in image URLs invalidate browser caches after regeneration. Records without exported artwork deliberately show a placeholder; they are not silently removed from the catalog.

## Verification

Run `npm test` (install the Playwright Chromium browser with `npx playwright install chromium` if needed; Windows can also use installed Edge). Tests launch an isolated browser, not your personal browser profile. They cover search, filters, progressive loading, modal inspection, deck persistence/management, points and the 100-point cap, responsive 390px/320px layouts, and image request paths.

Preview screenshots are generated under ignored `test-results/`.

Design reference: layered search/filter organization from the official Pokémon TCG and Yu-Gi-Oh! Neuron card databases, with an original DIMENSIONS visual identity rather than a copied layout.
