# DIMENSIONS — Card Archive

Static GitHub Pages card database and browser-local deck workshop. No framework, external font, account, or backend is required.

## Features

- A **How to Play** page (`how-to-play.html`) for new players, covering the goal, turn phases, Mana, sealing, the board, card types, combat, keywords, chains, Fusion and deck rules. Its facts come from the Unity game's rules engine; update the page if those rules change. Keyword links open the archive filtered to cards that use each keyword.
- Archive links that carry filters (for example `?type=Spell`) show exactly those filters instead of mixing in the visitor's saved selection.
- "Rift" visual theme: sticky glass header with an always-visible search bar, pill filters (one scrollable row on desktop, a grid on mobile), attribute-tinted card frames with hover glow, a segmented category control, a deck-points progress meter, and an attribute-accented card details dialog.
- Responsive purple/lime archive with card artwork, searchable effects, attribute/archetype/type filters, sorting, and accessible card details.
- Card points on tiles and details, a dedicated Any Points/exact-point filter (including zero), point sorting, `points>=2` advanced search, and a combined Main + Fusion 100-point deck budget.
- Named decks, automatic browser-local saves, renaming, duplication, deck stats, and Fusion suggestions. Existing `dimensions_tcg_decks_v2` saves are preserved.
- Related Cards in each card's details, with a visible count/jump button, partner previews, back navigation, and individual deck additions. The deck sidebar also suggests partners. Relationships come directly from Unity's `DeckRelatedCardLookup`: Fusion recipes, authored support filters, and Special Summon requirements, in both directions—not guessed from effect text or shared names. Partner lists load in small batches and use lazy WebP thumbnails.
- Import/export, deck-code transfer, and shared-deck import controls have been removed. Filter URLs remain supported.
- A 36-card initial gallery that automatically appends the next batch as you approach the bottom, with a manual Load More fallback and native lazy image decoding. No full-size PNG gallery downloads when optimized artwork is available.

## Updating card data and artwork

1. Use the existing Unity Tools exports to update `data/*.json` and `images/cards/*.png`. The JSON exporter includes the game's authoritative `deckPoints` and `relatedCardIds` fields. A relationship-only Unity snapshot can also be applied with `node scripts/sync-related.cjs <snapshot.json>`; this updates links in the existing four catalogs without adding cards or changing other card data.
2. Install Node.js, then run `npm install` once in this repository.
3. After artwork changes, run `npm run optimize`. This regenerates only changed artwork and `data/artwork-manifest.json`. Commit those outputs alongside the new original artwork/data.
4. Commit and push through GitHub Desktop or Git. The existing GitHub Pages deployment publishes the website.

The original PNGs are preserved. Web derivatives live in `images/optimized/thumb` (420px, WebP quality 80) and `images/optimized/detail` (1000px, quality 88). Content hashes in image URLs invalidate browser caches after regeneration. The Unity JSON exporter also records the PNG revision: if fresh artwork has not yet been optimized, the site temporarily uses the new original instead of showing an outdated thumbnail. Records without exported artwork deliberately show a placeholder; they are not silently removed from the catalog.

## Verification

Run `npm test` (install the Playwright Chromium browser with `npx playwright install chromium` if needed; Windows can also use installed Edge). Tests launch an isolated browser, not your personal browser profile. They cover search, filters, progressive loading, modal inspection, deck persistence/management, points and the 100-point cap, responsive 390px/320px layouts, and image request paths.

Preview screenshots are generated under ignored `test-results/`.

Design reference: layered search/filter organization from the official Pokémon TCG and Yu-Gi-Oh! Neuron card databases, with an original DIMENSIONS visual identity rather than a copied layout.
