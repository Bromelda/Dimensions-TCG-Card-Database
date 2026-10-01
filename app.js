
let allCards = [];
let filteredCards = [];
let visibleCount = 0;
let cardsById = new Map();
let relatedHistory = [];
let relatedModalLimit = 12;
let relatedDeckLimit = 6;
const DECK_LIBRARY_STORAGE_KEY = "dimensions_tcg_decks_v2";
const LEGACY_DECK_STORAGE_KEY = "dimensions_tcg_deck_v1";
const UI_STORAGE_KEY = "dimensions_tcg_ui_v2";
const PAGE_SIZE = 36;
let artworkManifest = {};

const appState = {
  activeDeckId: null,
  deckLibrary: loadDeckLibrary(),
  currentModalCard: null,
  currentModalIndex: -1,
  modalLastFocus: null,
  mobileFiltersOpen: false,
  previewEnabled: false,
  ui: loadUiState()
};

if (!appState.deckLibrary.decks.length) {
  appState.deckLibrary = createDefaultDeckLibrary();
  saveDeckLibrary();
}
if (!appState.deckLibrary.activeDeckId || !appState.deckLibrary.decks.some((d) => d.id === appState.deckLibrary.activeDeckId)) {
  appState.deckLibrary.activeDeckId = appState.deckLibrary.decks[0]?.id || null;
}
appState.activeDeckId = appState.deckLibrary.activeDeckId;
let deckState = getActiveDeck();

const searchInput = document.getElementById("searchInput");
const manaFilter = document.getElementById("manaFilter");
const pointsFilter = document.getElementById("pointsFilter");
const attributeFilter = document.getElementById("attributeFilter");
const archetypeFilter = document.getElementById("archetypeFilter");
const typeFilter = document.getElementById("typeFilter");
const fusionFilter = document.getElementById("fusionFilter");
const deckViewFilter = document.getElementById("deckViewFilter");
const hideFullToggle = document.getElementById("hideFullToggle");
const cardGrid = document.getElementById("cardGrid");
const resultsCount = document.getElementById("resultsCount");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const gallerySentinel = document.querySelector(".load-more-row");
const galleryObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
  if (entries.some(entry => entry.isIntersecting) && visibleCount < filteredCards.length
      && cardModal.classList.contains("hidden")) {
    loadMoreCards();
  }
}, { rootMargin: "600px 0px" }) : null;
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const toggleDeckBtn = document.getElementById("toggleDeckBtn");
const mobileFiltersToggle = document.getElementById("mobileFiltersToggle");
const filtersPanel = document.getElementById("filtersPanel");
const deckPanel = document.getElementById("deckPanel");
const closeDeckBtn = document.getElementById("closeDeckBtn");
const mainDeckCount = document.getElementById("mainDeckCount");
const fusionDeckCount = document.getElementById("fusionDeckCount");
const avgManaValue = document.getElementById("avgManaValue");
const deckStatus = document.getElementById("deckStatus");
const deckWarning = document.getElementById("deckWarning");
const mainDeckList = document.getElementById("mainDeckList");
const fusionDeckList = document.getElementById("fusionDeckList");
const clearDeckBtn = document.getElementById("clearDeckBtn");
const duplicateDeckBtn = document.getElementById("duplicateDeckBtn");
const renameDeckBtn = document.getElementById("renameDeckBtn");
const deleteDeckBtn = document.getElementById("deleteDeckBtn");
const newDeckBtn = document.getElementById("newDeckBtn");
const deckSelect = document.getElementById("deckSelect");
const deckNameInput = document.getElementById("deckNameInput");
const emptyState = document.getElementById("emptyState");
const sortSelect = document.getElementById("sortSelect");
const deckStatsSummary = document.getElementById("deckStatsSummary");
const deckStatsWarnings = document.getElementById("deckStatsWarnings");
const fusionSuggestions = document.getElementById("fusionSuggestions");
const deckCollapseBtn = document.getElementById("deckCollapseBtn");

const cardPreview = document.getElementById("cardPreview");
const toastEl = document.getElementById("toast");

const cardModal = document.getElementById("cardModal");
const closeModal = document.getElementById("closeModal");
const modalImage = document.getElementById("modalImage");
const modalName = document.getElementById("modalName");
const modalMana = document.getElementById("modalMana");
const modalAttribute = document.getElementById("modalAttribute");
const modalArchetype = document.getElementById("modalArchetype");
const modalType = document.getElementById("modalType");
const modalStats = document.getElementById("modalStats");
const modalRules = document.getElementById("modalRules");
const modalKeywordBadges = document.getElementById("modalKeywordBadges");
const modalDeckCount = document.getElementById("modalDeckCount");
const modalImageStatus = document.getElementById("modalImageStatus");
const modalFusionHint = document.getElementById("modalFusionHint");
const modalPrevBtn = document.getElementById("modalPrevBtn");
const modalNextBtn = document.getElementById("modalNextBtn");
const modalAddDeckBtn = document.getElementById("modalAddDeckBtn");

Promise.all([fetch("./data/cards.json?v=20260930-related-1"), fetch("./data/artwork-manifest.json?v=20260930-related-1").then(r => r.ok ? r.json() : {}).catch(() => ({}))])
  .then(([response, manifest]) => {
    artworkManifest = manifest;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading cards.json`);
    }
    return response.json();
  })
  .then((data) => {
    const cards = Array.isArray(data) ? data : (data.Items || []);

    if (!Array.isArray(cards)) {
      throw new Error("cards.json did not contain an array or Items array");
    }

    allCards = cards.map(normalizeCardData);
    cardsById = new Map(allCards.map(card => [card.cardId, card]));
    buildFilters(allCards);
    hydrateDeckLibraryAgainstCardPool();
    applyUiState();
    refreshView();
    renderDeck();
  })
  .catch((error) => {
    console.error("Failed to load card database:", error);
    resultsCount.textContent = `Failed to load card database: ${error.message}`;
  });

function normalizeCardData(rawCard) {
  const card = { ...rawCard };
  card.cardId = String(card.cardId || card.id || cryptoRandomId());
  card.name = tidySpaces(card.name);
  card.attribute = normalizeTitleValue(card.attribute, "None");
  card.archetype = normalizeTitleValue(card.archetype, "None");
  card.cardType = normalizeCardType(card.cardType);
  card.manaCost = normalizeNumber(card.manaCost);
  card.deckPoints = Math.max(0, Math.floor(normalizeNumber(card.deckPoints)));
  card.relatedCardIds = [...new Set((rawCard.relatedCardIds || []).map(String))].filter(id => id !== card.cardId);
  card.atk = normalizeNumber(card.atk);
  card.def = normalizeNumber(card.def);
  card.rulesText = normalizeRulesText(card.rulesText);
  card.image = normalizeImagePath(card.image);
  const candidateArtwork = artworkManifest[card.image];
  const artwork = candidateArtwork && (!card.artworkRevision || candidateArtwork.artworkRevision === card.artworkRevision)
    ? candidateArtwork : null;
  const hasManifest = Object.keys(artworkManifest).length > 0;
  const originalAvailable = !hasManifest || Boolean(card.artworkRevision);
  card.thumbnail = artwork?.thumb || (originalAvailable ? card.image : "");
  card.detailImage = artwork?.detail || (originalAvailable ? card.image : "");
  card.keywords = extractKeywords(card.rulesText || "");
  card.cleanedRules = cleanRulesText(card.rulesText || "");
  card.searchBlob = [card.name, card.cleanedRules, card.archetype, card.attribute, card.cardType, ...card.keywords].join(" ").toLowerCase();
  card.isLegendary = String(card.archetype || "").toLowerCase() === "legendary";
  card.imageIssue = !card.image || (hasManifest && !artwork && !originalAvailable);
  return card;
}

function normalizeRulesText(value) {
  return tidySpaces(String(value || "").replace(/\s*\n\s*/g, " ").replace(/\s*;\s*/g, "; ").replace(/\s*\.\s*/g, ". "));
}

function normalizeTitleValue(value, fallback) {
  const text = tidySpaces(value);
  if (!text) return fallback;
  return text
    .split(" ")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function normalizeCardType(value) {
  const v = tidySpaces(value).toLowerCase();
  if (!v) return "Unknown";
  if (v === "fusion") return "Fusion";
  if (v === "spell") return "Spell";
  if (v === "creature") return "Creature";
  return normalizeTitleValue(v, "Unknown");
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeImagePath(value) {
  const text = tidySpaces(value);
  if (!text) return "";
  return text.replace(/\\/g, "/");
}

function tidySpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanRulesText(rulesText) {
  if (!rulesText) return "";

  return String(rulesText)
    .replace(/^(Hand|Play|Fusion|SpecialSummon)\s*;\s*/i, "")
    .trim();
}

function extractKeywords(rulesText) {
  if (!rulesText) return [];

  const found = [];
  const regex = /\b(Hand|Play|Fusion|SpecialSummon)\s*;/gi;
  let match;

  while ((match = regex.exec(String(rulesText))) !== null) {
    const value = normalizeKeyword(match[1]);
    if (!found.includes(value)) found.push(value);
  }

  return found;
}

function normalizeKeyword(value) {
  const v = String(value || "").toLowerCase();
  if (v === "specialsummon") return "SpecialSummon";
  if (v === "fusion") return "Fusion";
  if (v === "play") return "Play";
  if (v === "hand") return "Hand";
  return value;
}

function buildFilters(cards) {
  const manaValues = [...new Set(cards.map((c) => c.manaCost))]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .sort((a, b) => Number(a) - Number(b));

  const attributes = [...new Set(cards.map((c) => c.attribute).filter(Boolean))].sort();
  const archetypes = [...new Set(cards.map((c) => c.archetype).filter(Boolean))].sort();
  const types = [...new Set(cards.map((c) => c.cardType).filter(Boolean))].sort();

  fillSelect(manaFilter, "Any Mana", manaValues);
  fillSelect(pointsFilter, "Any Points", [...new Set(cards.map(card => card.deckPoints))].sort((a, b) => a - b));
  for (const option of [...pointsFilter.options].slice(1)) option.textContent = `${option.value} Points`;
  fillSelect(attributeFilter, "Any Attribute", attributes);
  fillSelect(archetypeFilter, "Any Archetype", archetypes);
  fillSelect(typeFilter, "Any Type", types);
}

function fillSelect(select, placeholder, values) {
  select.innerHTML = "";
  const initial = document.createElement("option");
  initial.value = "";
  initial.textContent = placeholder;
  select.appendChild(initial);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function getFilteredCards() {
  const search = searchInput.value.trim().toLowerCase();
  const mana = manaFilter.value;
  const points = pointsFilter.value;
  const attribute = attributeFilter.value;
  const archetype = archetypeFilter.value;
  const type = typeFilter.value;
  const sortMode = sortSelect.value;
  const fusionMode = fusionFilter.value;
  const deckMode = deckViewFilter.value;
  const hideFull = hideFullToggle.checked;

  const candidateCards = getSearchCandidates(search);
  let cards = candidateCards.filter((card) => {
    const matchesSearch = matchesAdvancedSearch(card, {
      raw: search,
      cleanedRules: card.cleanedRules,
      keywords: card.keywords
    });

    const matchesMana = !mana || String(card.manaCost) === mana;
    const matchesPoints = points === "" || String(card.deckPoints) === points;
    const matchesAttribute = !attribute || card.attribute === attribute;
    const matchesArchetype = !archetype || card.archetype === archetype;
    const matchesType = !type || card.cardType === type;
    const matchesFusion = fusionMode === "" || (fusionMode === "fusion" ? isFusionCard(card) : !isFusionCard(card));
    const section = getDeckSection(card);
    const copies = getCardCopiesInSection(card, section);
    const limit = getCardCopyLimit(card);
    const inDeck = copies > 0;
    const matchesDeckMode =
      deckMode === "" ||
      (deckMode === "in-deck" && inDeck) ||
      (deckMode === "not-in-deck" && !inDeck) ||
      (deckMode === "main" && section === "main") ||
      (deckMode === "fusion" && section === "fusion");
    const matchesHideFull = !hideFull || copies < limit;

    return matchesSearch && matchesMana && matchesPoints && matchesAttribute && matchesArchetype && matchesType && matchesFusion && matchesDeckMode && matchesHideFull;
  });

  cards = sortCards(cards, sortMode);

  return cards;
}

function buildSearchIndex(cards) {
  const tokenMap = new Map();
  for (const card of cards) {
    const tokens = tokenizeSearchText(card.searchBlob || "");
    for (const token of tokens) {
      if (!tokenMap.has(token)) tokenMap.set(token, new Set());
      tokenMap.get(token).add(card.cardId);
    }
  }
  searchIndex = { tokenMap, cardsById: new Map(cards.map((card) => [card.cardId, card])) };
}

function getSearchCandidates(search) {
  // A few hundred indexed records are cheap to scan. Do not reject partial
  // words or quoted phrases before the authoritative search matcher runs.
  return allCards;
}

function tokenizeSearchText(value) {
  return [...new Set(String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [])];
}

function matchesAdvancedSearch(card, context) {
  const raw = context.raw;
  if (!raw) return true;

  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const textHaystack = card.searchBlob || [
    card.name || "",
    context.cleanedRules || "",
    card.archetype || "",
    card.attribute || "",
    card.cardType || "",
    ...context.keywords
  ].join(" ").toLowerCase();

  for (let token of tokens) {
    token = token.trim();
    if (!token) continue;
    if (isFieldToken(token)) {
      if (!matchesFieldToken(card, token)) return false;
    } else {
      const needle = stripQuotes(token).toLowerCase();
      if (!textHaystack.includes(needle)) return false;
    }
  }

  return true;
}

function isFieldToken(token) {
  return /^(mana|points|atk|def|attribute|type|archetype|keyword|name|text|deck|legendary|has|copies|section|fusion)\s*[:<>=]/i.test(token);
}

function matchesFieldToken(card, token) {
  const normalizedToken = token.replace(/^section\s*[:=]/i, "deck:");
  const numericMatch = normalizedToken.match(/^(mana|points|atk|def|copies)\s*(>=|<=|=|>|<|:)\s*(\d+)$/i);
  if (numericMatch) {
    const field = numericMatch[1].toLowerCase();
    const operator = numericMatch[2] === ":" ? "=" : numericMatch[2];
    const expected = Number(numericMatch[3]);
    const actual =
      field === "mana" ? Number(card.manaCost || 0)
      : field === "points" ? card.deckPoints
      : field === "atk" ? Number(card.atk || 0)
      : field === "def" ? Number(card.def || 0)
      : getCardCopiesInSection(card, getDeckSection(card));

    switch (operator) {
      case "=": return actual === expected;
      case ">": return actual > expected;
      case "<": return actual < expected;
      case ">=": return actual >= expected;
      case "<=": return actual <= expected;
      default: return true;
    }
  }

  const textMatch = normalizedToken.match(/^(attribute|type|archetype|keyword|name|text|deck|legendary|has|fusion)\s*[:=]\s*(.+)$/i);
  if (textMatch) {
    const field = textMatch[1].toLowerCase();
    const value = stripQuotes(textMatch[2]).toLowerCase();

    if (field === "attribute") return String(card.attribute || "").toLowerCase().includes(value);
    if (field === "type") return String(card.cardType || "").toLowerCase().includes(value);
    if (field === "archetype") return String(card.archetype || "").toLowerCase().includes(value);
    if (field === "name") return String(card.name || "").toLowerCase().includes(value);
    if (field === "text") return String(card.cleanedRules || "").toLowerCase().includes(value);
    if (field === "keyword") return card.keywords.some((k) => k.toLowerCase().includes(value));
    if (field === "deck") {
      const section = getDeckSection(card);
      const copies = getCardCopiesInSection(card, section);
      if (value === "main" || value === "fusion") return section === value;
      if (value === "yes" || value === "true") return copies > 0;
      if (value === "no" || value === "false") return copies === 0;
    }
    if (field === "fusion") {
      const fusion = isFusionCard(card);
      return value === "true" || value === "yes" ? fusion : value === "false" || value === "no" ? !fusion : true;
    }
    if (field === "legendary") {
      return value === "true" || value === "yes" ? card.isLegendary : value === "false" || value === "no" ? !card.isLegendary : true;
    }
    if (field === "has") {
      if (value === "rules") return Boolean(card.cleanedRules);
      if (value === "image") return Boolean(card.image);
      if (value === "keywords") return card.keywords.length > 0;
      if (value === "stats") return isStatsCard(card);
    }
  }

  return true;
}

function stripQuotes(value) {
  return String(value || "").replace(/^"|"$/g, "").trim();
}

function sortCards(cards, sortMode) {
  const copy = [...cards];

  switch (sortMode) {
    case "points-asc": return copy.sort((a,b) => a.deckPoints - b.deckPoints || a.name.localeCompare(b.name));
    case "points-desc": return copy.sort((a,b) => b.deckPoints - a.deckPoints || a.name.localeCompare(b.name));
    case "name-asc":
      return copy.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    case "name-desc":
      return copy.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
    case "mana-asc":
      return copy.sort((a, b) => Number(a.manaCost || 0) - Number(b.manaCost || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "mana-desc":
      return copy.sort((a, b) => Number(b.manaCost || 0) - Number(a.manaCost || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "atk-desc":
      return copy.sort((a, b) => Number(b.atk || 0) - Number(a.atk || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "atk-asc":
      return copy.sort((a, b) => Number(a.atk || 0) - Number(b.atk || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "def-desc":
      return copy.sort((a, b) => Number(b.def || 0) - Number(a.def || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "def-asc":
      return copy.sort((a, b) => Number(a.def || 0) - Number(b.def || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    case "attribute":
    case "attribute-asc":
      return copy.sort((a, b) => String(a.attribute || "").localeCompare(String(b.attribute || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    case "type":
    case "type-asc":
      return copy.sort((a, b) => String(a.cardType || "").localeCompare(String(b.cardType || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    case "deck-copies":
      return copy.sort((a, b) => getCardCopiesInSection(b, getDeckSection(b)) - getCardCopiesInSection(a, getDeckSection(a)) || String(a.name || "").localeCompare(String(b.name || "")));
    default:
      return copy;
  }
}

function isStatsCard(card) {
  return card.cardType === "Creature" || card.cardType === "Fusion";
}

function isFusionCard(card) {
  return String(card.cardType || "").toLowerCase() === "fusion";
}

function refreshView(resetPage = true) {
  saveUiState();
  filteredCards = getFilteredCards();
  visibleCount = Math.min(resetPage === false ? Math.max(PAGE_SIZE, visibleCount) : PAGE_SIZE, filteredCards.length);
  renderCards(filteredCards.slice(0, visibleCount));
  updateLoadMore();
  syncUrlFromUi();
}

function renderCards(cards, append = false) {
  if (!append) cardGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  resultsCount.textContent = `${filteredCards.length} cards · showing ${visibleCount}`;

  if (!cards.length) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  for (const card of cards) {
    const div = document.createElement("article");
    div.className = `card card-${slugify(card.attribute)}`;
    div.tabIndex = 0;
    div.setAttribute("role", "group");
    div.setAttribute("aria-label", `Open details for ${card.name || "card"}`);

    const keywords = card.keywords;
    const cleanedRules = card.cleanedRules;
    const section = getDeckSection(card);
    const copies = getCardCopiesInSection(card, section);
    const limit = getCardCopyLimit(card);
    const isFull = copies >= limit;

    div.innerHTML = `
      <div class="card-art"><img src="${escapeHtml(card.thumbnail || createFallbackImage(card.name || "No Image"))}" alt="${escapeHtml(card.name || "")}" width="420" height="560" loading="lazy" decoding="async"></div>
      <div class="card-body">
        <h3>${escapeHtml(card.name || "")}</h3>
        <div class="tags">
          ${renderManaBadge(card)}
          <span class="tag points-tag">${card.deckPoints} PTS</span>
          <span class="tag attr-${slugify(card.attribute || "none")}">${escapeHtml(card.attribute || "None")}</span>
          <span class="tag archetype-tag">${escapeHtml(card.archetype || "None")}</span>
          <span class="tag type-${slugify(card.cardType || "unknown")}">${escapeHtml(card.cardType || "Unknown")}</span>
          ${isStatsCard(card) ? `<span class="tag stats-tag">ATK ${card.atk ?? 0} / DEF ${card.def ?? 0}</span>` : ""}
          ${card.imageIssue ? `<span class="tag issue-tag">Image Missing</span>` : ""}
          ${isFull ? `<span class="tag full-tag">Full</span>` : ""}
        </div>
        ${keywords.length ? `<div class="keyword-row">${keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
        <p class="card-rules-preview">${escapeHtml(shorten(cleanedRules || "No rules text.", 90))}</p>
        <div class="card-actions">
          <button class="mini-btn details-btn" type="button">Details</button>
          <button class="mini-btn add-deck-btn" type="button" ${isFull ? "disabled" : ""}>${copies ? `Add (${copies}/${limit})` : `Add to Deck (${copies}/${limit})`}</button>
        </div>
      </div>
    `;

    const img = div.querySelector("img");
    attachImageFallback(img, card.name || "No Image");

    div.querySelector(".details-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(card);
    });

    const addDeckBtn = div.querySelector(".add-deck-btn");
    if (addDeckBtn) {
      addDeckBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        addCardToDeck(card);
        refreshView(false);
      });
    }

    div.addEventListener("click", () => openModal(card));
    div.addEventListener("keydown", (e) => {
      if (e.target === div && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openModal(card);
      }
    });

    if (appState.previewEnabled) {
      div.addEventListener("mouseenter", (e) => showHoverPreview(card, e));
      div.addEventListener("mousemove", moveHoverPreview);
      div.addEventListener("mouseleave", hideHoverPreview);
    }

    fragment.appendChild(div);
  }
  cardGrid.appendChild(fragment);
}

function openModal(card, options = {}) {
  if (options.fromRelated && appState.currentModalCard) relatedHistory.push(appState.currentModalCard);
  else if (!options.preserveHistory) relatedHistory = [];
  relatedModalLimit = 12;
  const index = filteredCards.findIndex((item) => item.cardId === card.cardId);
  appState.currentModalCard = card;
  appState.currentModalIndex = index;
  if (cardModal.classList.contains("hidden")) appState.modalLastFocus = document.activeElement;

  modalImage.src = card.detailImage || createFallbackImage(card.name || "No Image");
  modalImage.alt = card.name || "";
  modalName.textContent = card.name || "";
  modalMana.textContent = card.manaCost ?? 0;
  document.getElementById("modalPoints").textContent = card.deckPoints;
  modalAttribute.textContent = card.attribute || "None";
  modalArchetype.textContent = card.archetype || "None";
  modalType.textContent = card.cardType || "Unknown";
  modalStats.textContent = isStatsCard(card) ? `${card.atk ?? 0} / ${card.def ?? 0}` : "-";

  attachImageFallback(modalImage, card.name || "No Image", () => {
    modalImageStatus.textContent = "Showing fallback image";
  });


  const keywords = card.keywords;
  const cleanedRules = card.cleanedRules;
  const section = getDeckSection(card);
  const copies = getCardCopiesInSection(card, section);
  const limit = getCardCopyLimit(card);

  modalKeywordBadges.innerHTML = keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("");
  modalRules.textContent = cleanedRules || "No rules text.";
  modalDeckCount.textContent = `${copies}/${limit} in ${section === "fusion" ? "Fusion" : "Main"} Deck`;
  modalImageStatus.textContent = card.imageIssue ? "Artwork not yet exported to the archive." : "";
  modalFusionHint.textContent = getFusionHint(card);
  modalFusionHint.classList.toggle("hidden", !modalFusionHint.textContent);
  modalAddDeckBtn.textContent = `Add to ${section === "fusion" ? "Fusion" : "Main"} Deck`;
  modalAddDeckBtn.disabled = copies >= limit;
  modalPrevBtn.disabled = appState.currentModalIndex <= 0;
  modalNextBtn.disabled = appState.currentModalIndex < 0 || appState.currentModalIndex >= filteredCards.length - 1;

  decorateModalLabels(card);
  renderModalRelated();
  document.getElementById("modalRelatedJumpBtn").textContent = `Related Cards (${getRelatedCards(card).length})`;
  document.getElementById("modalRelatedBackBtn").classList.toggle("hidden", !relatedHistory.length);
  cardModal.querySelector(".modal-content").scrollTop = 0;
  cardModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  trapFocusToModal();
}

function getRelatedCards(card) {
  return (card?.relatedCardIds || []).map(id => cardsById.get(id)).filter(Boolean);
}

function renderRelatedList(container, items, inModal) {
  container.innerHTML = items.map(({ card, sources }) => `
    <article class="related-card">
      <img src="${escapeHtml(card.thumbnail || createFallbackImage(card.name))}" alt="" loading="lazy" width="54" height="72">
      <div class="related-info"><strong>${escapeHtml(card.name)}</strong>
        <small>${escapeHtml(card.cardType)} · Mana ${card.manaCost} · ${card.deckPoints} PTS</small>
        ${sources ? `<small>Related to ${escapeHtml(sources.join(", "))}</small>` : ""}
        <div class="related-actions"><button class="mini-btn related-details" data-id="${escapeHtml(card.cardId)}" type="button">Details</button>
        <button class="mini-btn related-add" data-id="${escapeHtml(card.cardId)}" type="button" ${getCardCopiesInSection(card, getDeckSection(card)) >= getCardCopyLimit(card) ? "disabled" : ""}>Add to Deck</button></div>
      </div>
    </article>`).join("");
  container.querySelectorAll("img").forEach(img => attachImageFallback(img, "Related card"));
  container.querySelectorAll(".related-details").forEach(button => button.addEventListener("click", () => {
    openModal(cardsById.get(button.dataset.id), { fromRelated: inModal });
  }));
  container.querySelectorAll(".related-add").forEach(button => button.addEventListener("click", () => {
    addCardToDeck(cardsById.get(button.dataset.id));
    refreshView(false);
    if (!cardModal.classList.contains("hidden")) renderModalRelated();
  }));
}

function renderModalRelated() {
  const related = getRelatedCards(appState.currentModalCard);
  const container = document.getElementById("modalRelatedCards");
  renderRelatedList(container, related.slice(0, relatedModalLimit).map(card => ({ card })), true);
  if (!related.length) container.textContent = "No authored related cards in this catalog.";
  document.getElementById("modalRelatedMoreBtn").classList.toggle("hidden", related.length <= relatedModalLimit);
}

function renderDeckRelated() {
  const candidates = new Map();
  const deckCards = new Map([...deckState.main, ...deckState.fusion].map(card => [card.cardId, card]));
  for (const source of deckCards.values()) {
    for (const card of getRelatedCards(source)) {
      if (deckCards.has(card.cardId)) continue;
      if (!candidates.has(card.cardId)) candidates.set(card.cardId, { card, sources: [] });
      candidates.get(card.cardId).sources.push(source.name);
    }
  }
  const items = [...candidates.values()].sort((a, b) => b.sources.length - a.sources.length || a.card.name.localeCompare(b.card.name));
  const container = document.getElementById("deckRelatedCards");
  renderRelatedList(container, items.slice(0, relatedDeckLimit), false);
  if (!items.length) container.textContent = deckCards.size ? "No other authored partners in this catalog." : "Add a card to discover its related partners.";
  document.getElementById("deckRelatedMoreBtn").classList.toggle("hidden", items.length <= relatedDeckLimit);
}

document.getElementById("modalRelatedMoreBtn").addEventListener("click", () => { relatedModalLimit += 12; renderModalRelated(); });
document.getElementById("modalRelatedJumpBtn").addEventListener("click", () => {
  document.getElementById("modalRelatedHeading").scrollIntoView({ block: "start" });
});
document.getElementById("deckRelatedMoreBtn").addEventListener("click", () => { relatedDeckLimit += 6; renderDeckRelated(); });
document.getElementById("modalRelatedBackBtn").addEventListener("click", () => {
  const card = relatedHistory.pop();
  if (card) openModal(card, { preserveHistory: true });
});

function getFusionHint(card) {
  if (!isFusionCard(card)) return "";
  const text = card.cleanedRules || "";
  const beforePeriod = text.split(/[.!?]/)[0] || "";
  return beforePeriod ? `Fusion hint: ${beforePeriod}.` : "Fusion card";
}

function decorateModalLabels(card) {
  modalAttribute.className = `detail-pill attr-${slugify(card.attribute || "none")}`;
  modalType.className = `detail-pill type-${slugify(card.cardType || "unknown")}`;
}

function closeModalAndRestoreFocus() {
  cardModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  updateLoadMore();
  hideHoverPreview();
  const focusTarget = appState.modalLastFocus;
  if (focusTarget && typeof focusTarget.focus === "function") {
    focusTarget.focus();
  }
}

closeModal.addEventListener("click", closeModalAndRestoreFocus);
modalPrevBtn.addEventListener("click", () => moveModal(-1));
modalNextBtn.addEventListener("click", () => moveModal(1));
modalAddDeckBtn.addEventListener("click", () => {
  if (appState.currentModalCard) {
    addCardToDeck(appState.currentModalCard);
    if (appState.currentModalCard) openModal(appState.currentModalCard, { preserveHistory: true });
    refreshView();
  }
});

cardModal.addEventListener("click", (e) => {
  if (e.target === cardModal) {
    closeModalAndRestoreFocus();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModalAndRestoreFocus();
  }

  if (!cardModal.classList.contains("hidden")) {
    if (e.key === "ArrowRight") moveModal(1);
    if (e.key === "ArrowLeft") moveModal(-1);
    if (e.key === "Tab") handleModalTabTrap(e);
  }
});

function moveModal(step) {
  if (appState.currentModalIndex < 0) return;
  const nextIndex = appState.currentModalIndex + step;
  if (nextIndex < 0 || nextIndex >= filteredCards.length) return;
  openModal(filteredCards[nextIndex]);
}

function trapFocusToModal() {
  setTimeout(() => {
    const first = getFocusableElements(cardModal)[0];
    if (first) first.focus();
  }, 0);
}

function handleModalTabTrap(event) {
  const focusable = getFocusableElements(cardModal);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getFocusableElements(container) {
  return [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.classList.contains("hidden"));
}

searchInput.addEventListener("input", debounce(refreshView, 150));
[manaFilter, pointsFilter, attributeFilter, archetypeFilter, typeFilter, fusionFilter, deckViewFilter].forEach((el) => {
  el.addEventListener("change", refreshView);
});
hideFullToggle.addEventListener("change", refreshView);
sortSelect.addEventListener("change", refreshView);
clearFiltersBtn.addEventListener("click", clearFilters);
loadMoreBtn.addEventListener("click", loadMoreCards);

if (toggleDeckBtn) {
  toggleDeckBtn.addEventListener("click", () => {
    deckPanel.classList.remove("hidden");
    deckPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

if (mobileFiltersToggle) {
  mobileFiltersToggle.addEventListener("click", () => {
    appState.mobileFiltersOpen = !appState.mobileFiltersOpen;
    filtersPanel.classList.toggle("mobile-open", appState.mobileFiltersOpen);
    mobileFiltersToggle.setAttribute("aria-expanded", String(appState.mobileFiltersOpen));
  });
}

if (closeDeckBtn) {
  closeDeckBtn.addEventListener("click", () => {
    deckPanel.classList.add("hidden");
  });
}

clearDeckBtn.addEventListener("click", clearDeck);
if (deckCollapseBtn) {
  deckCollapseBtn.addEventListener("click", toggleDeckCollapse);
}
duplicateDeckBtn.addEventListener("click", duplicateCurrentDeck);
renameDeckBtn.addEventListener("click", renameCurrentDeck);
deleteDeckBtn.addEventListener("click", deleteCurrentDeck);
newDeckBtn.addEventListener("click", createNewDeckFromInput);
deckSelect.addEventListener("change", onDeckSelectChange);
deckNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") renameCurrentDeck();
});

function clearFilters() {
  searchInput.value = "";
  manaFilter.value = "";
  pointsFilter.value = "";
  attributeFilter.value = "";
  archetypeFilter.value = "";
  typeFilter.value = "";
  fusionFilter.value = "";
  deckViewFilter.value = "";
  hideFullToggle.checked = false;
  sortSelect.value = "name-asc";
  refreshView();
  toast("Filters cleared");
}

function loadMoreCards() {
  if (visibleCount >= filteredCards.length) return;
  const previousCount = visibleCount;
  visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredCards.length);
  renderCards(filteredCards.slice(previousCount, visibleCount), true);
  updateLoadMore();
}

function updateLoadMore() {
  // Re-arm after appending or changing filters. This also fills short result
  // pages without waiting for another intersection crossing.
  galleryObserver?.disconnect();
  if (visibleCount < filteredCards.length) galleryObserver?.observe(gallerySentinel);
  loadMoreBtn.classList.toggle("hidden", visibleCount >= filteredCards.length);
  loadMoreBtn.textContent = "Load next " + Math.min(PAGE_SIZE, filteredCards.length - visibleCount) + " cards";
  document.querySelectorAll("[data-card-type]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.cardType === typeFilter.value));
  });
}

function showHoverPreview(card, event) {
  if (!appState.previewEnabled) return;
  const keywords = card.keywords;
  const cleanedRules = card.cleanedRules;

  cardPreview.innerHTML = `
    <img src="${escapeHtml(card.image || createFallbackImage(card.name || "No Image"))}" alt="${escapeHtml(card.name || "")}">
    <div class="hover-preview-body">
      <div class="hover-preview-title">${escapeHtml(card.name || "")}</div>
      <div class="hover-preview-tags">
        ${renderManaBadge(card)}
        <span class="tag attr-${slugify(card.attribute || "none")}">${escapeHtml(card.attribute || "None")}</span>
        <span class="tag type-${slugify(card.cardType || "unknown")}">${escapeHtml(card.cardType || "Unknown")}</span>
      </div>
      ${keywords.length ? `<div class="keyword-row">${keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
      <div class="hover-preview-rules">${escapeHtml(shorten(cleanedRules || "No rules text.", 120))}</div>
    </div>
  `;

  const previewImg = cardPreview.querySelector("img");
  if (previewImg) {
    attachImageFallback(previewImg, card.name || "No Image");
  }

  cardPreview.classList.remove("hidden");
  cardPreview.classList.add("show");
  moveHoverPreview(event);
}

function moveHoverPreview(event) {
  const offset = 18;
  const maxX = window.innerWidth - cardPreview.offsetWidth - 8;
  const maxY = window.innerHeight - cardPreview.offsetHeight - 8;
  cardPreview.style.left = `${Math.min(event.clientX + offset, maxX)}px`;
  cardPreview.style.top = `${Math.min(event.clientY + offset, maxY)}px`;
}

function hideHoverPreview() {
  cardPreview.classList.remove("show");
  cardPreview.classList.add("hidden");
}

function getDeckSection(card) {
  return isFusionCard(card) ? "fusion" : "main";
}

function addFusionSuggestionPackage(fusionCard) {
  if (!fusionCard) return;

  addCardToDeck(fusionCard);

  const required = parseFusionMaterials(fusionCard);
  for (const requirement of required) {
    let remaining = Number(requirement.count || 1);
    if (!remaining) continue;

    const exactMatches = allCards.filter((card) =>
      !isFusionCard(card) &&
      String(card.name || "").toLowerCase() === String(requirement.name || "").toLowerCase()
    );

    for (const materialCard of exactMatches) {
      const section = getDeckSection(materialCard);
      const currentCopies = getCardCopiesInSection(materialCard, section);
      const limit = getCardCopyLimit(materialCard);
      const missingCopies = Math.max(0, Math.min(limit - currentCopies, remaining));

      for (let i = 0; i < missingCopies; i += 1) {
        addCardToDeck(materialCard);
      }

      remaining -= missingCopies;
      if (remaining <= 0) break;
    }
  }

  const fusionSpell = allCards.find((card) =>
    !isFusionCard(card) && String(card.name || "").toLowerCase() === "fusion spell"
  );

  if (fusionSpell && getCardCopiesInSection(fusionSpell, "main") < 1) {
    addCardToDeck(fusionSpell);
  }
}


function getCardCopyLimit(card) {
  return card?.isLegendary ? 1 : 3;
}

function getCardCopiesInSection(card, section) {
  const list = section === "fusion" ? deckState.fusion : deckState.main;
  return list.filter((item) => String(item.name || "") === String(card?.name || "")).length;
}

function summarizeDeckSection(items) {
  const map = new Map();

  items.forEach((card) => {
    const key = String(card.name || "");
    if (!map.has(key)) {
      map.set(key, { card, count: 1 });
    } else {
      map.get(key).count += 1;
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    b.count - a.count || String(a.card.name || "").localeCompare(String(b.card.name || ""))
  );
}

function addCardToDeck(card) {
  try {
    if (!card) return;
    if (getDeckPoints() + card.deckPoints > 100) { toast("That card would exceed the 100-point Main + Fusion deck limit."); return; }

    const section = getDeckSection(card);
    const copyLimit = getCardCopyLimit(card);
    const currentCopies = getCardCopiesInSection(card, section);

    if (currentCopies >= copyLimit) {
      toast(`${card.name || "Card"} is already at ${copyLimit}/${copyLimit}`);
      return;
    }

    if (section === "fusion") {
      if (deckState.fusion.length >= 10) {
        toast("Fusion deck is full (max 10)");
        return;
      }

      deckState.fusion.push(card);
      persistDeckState(`${card.name || "Card"} added to Fusion Deck (${currentCopies + 1}/${copyLimit})`);
      return;
    }

    if (deckState.main.length >= 80) {
      toast("Main deck is full (max 80)");
      return;
    }

    deckState.main.push(card);
    persistDeckState(`${card.name || "Card"} added to Main Deck (${currentCopies + 1}/${copyLimit})`);
  } catch (error) {
    console.error("addCardToDeck failed:", error);
    alert(`Add to Deck failed: ${error.message}`);
  }
}

function removeCardFromDeck(cardName, section) {
  try {
    const list = section === "fusion" ? deckState.fusion : deckState.main;
    const index = list.findIndex((card) => String(card.name || "") === String(cardName || ""));
    if (index === -1) return;
    list.splice(index, 1);

    persistDeckState();
    refreshView();
  } catch (error) {
    console.error("removeCardFromDeck failed:", error);
    alert(`Remove failed: ${error.message}`);
  }
}

function clearDeck() {
  try {
    deckState.main = [];
    deckState.fusion = [];
    persistDeckState("Deck cleared");
    refreshView();
  } catch (error) {
    console.error("clearDeck failed:", error);
    alert(`Clear deck failed: ${error.message}`);
  }
}

function renderDeck() {
  try {
    const mainCount = deckState.main.length;
    const fusionCount = deckState.fusion.length;

    mainDeckCount.textContent = mainCount;
    fusionDeckCount.textContent = fusionCount;

    const avgMana = mainCount
      ? (deckState.main.reduce((sum, card) => sum + Number(card.manaCost || 0), 0) / mainCount).toFixed(1)
      : "0.0";
    avgManaValue.textContent = avgMana;
    const pointTotal = getDeckPoints();
    document.getElementById("deckPointsValue").textContent = `${pointTotal} / 100`;
    document.querySelector(".point-summary").classList.toggle("over-limit", pointTotal > 100);

    deckStatus.textContent = `Main: ${mainCount}/60-80 · Fusion: ${fusionCount}/10`;

    let warning = "";
    if (mainCount < 60) warning = "Main deck must have at least 60 cards.";
    else if (mainCount > 80) warning = "Main deck cannot exceed 80 cards.";
    else if (fusionCount > 10) warning = "Fusion deck cannot exceed 10 cards.";
    else if (pointTotal > 100) warning = "Main + Fusion deck exceeds the 100-point limit.";
    else warning = "Deck is valid.";

    deckWarning.textContent = warning;
    deckWarning.className = `deck-warning ${warning === "Deck is valid." ? "valid" : "warning"}`;

    const mainSummary = summarizeDeckSection(deckState.main);
    const fusionSummary = summarizeDeckSection(deckState.fusion);

    mainDeckList.innerHTML = mainSummary.length
      ? mainSummary.map((entry) => `
        <div class="deck-item">
          <div class="deck-item-name">
            <span>${escapeHtml(entry.card.name || "")}</span>
            <small>${escapeHtml(entry.card.cardType || "Unknown")} · Mana ${entry.card.manaCost ?? 0} · ${entry.card.deckPoints} PTS each</small>
          </div>
          <span class="deck-qty">${entry.count}/${getCardCopyLimit(entry.card)}</span>
          <button type="button" class="mini-btn remove-deck-btn" data-section="main" data-name="${escapeHtml(entry.card.name || "")}">Remove 1</button>
        </div>
      `).join("")
      : `<div class="deck-empty">No main deck cards yet.</div>`;

    fusionDeckList.innerHTML = fusionSummary.length
      ? fusionSummary.map((entry) => `
        <div class="deck-item">
          <div class="deck-item-name">
            <span>${escapeHtml(entry.card.name || "")}</span>
            <small>${escapeHtml(entry.card.cardType || "Unknown")} · Mana ${entry.card.manaCost ?? 0} · ${entry.card.deckPoints} PTS each</small>
          </div>
          <span class="deck-qty">${entry.count}/${getCardCopyLimit(entry.card)}</span>
          <button type="button" class="mini-btn remove-deck-btn" data-section="fusion" data-name="${escapeHtml(entry.card.name || "")}">Remove 1</button>
        </div>
      `).join("")
      : `<div class="deck-empty">No fusion cards yet.</div>`;

    deckPanel.querySelectorAll(".remove-deck-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeCardFromDeck(btn.dataset.name, btn.dataset.section);
      });
    });

    renderDeckStats();
    renderDeckSelect();
  } catch (error) {
    console.error("renderDeck failed:", error);
    alert(`Render deck failed: ${error.message}`);
  }
}

function renderDeckStats() {
  renderDeckRelated();
  const typeCounts = countBy(deckState.main, (card) => card.cardType);
  const attrCounts = countBy(deckState.main, (card) => card.attribute);
  const archeCounts = countBy(deckState.main, (card) => card.archetype);
  const warnings = [];
  const suggestions = getFusionSuggestions();

  for (const fusionCard of deckState.fusion) {
    const required = parseFusionMaterials(fusionCard);
    if (!required.length) continue;
    const mainCounts = countDeckNames(deckState.main);
    const missing = [];
    for (const requirement of required) {
      const owned = mainCounts.get(requirement.name.toLowerCase()) || 0;
      if (owned < requirement.count) {
        missing.push(`${requirement.name} (${owned}/${requirement.count})`);
      }
    }
    if (missing.length) {
      warnings.push(`${fusionCard.name}: missing ${missing.join(", ")}.`);
    }
  }

  deckStatsSummary.innerHTML = `
    <div><strong>Types:</strong> ${formatCountList(typeCounts)}</div>
    <div><strong>Attributes:</strong> ${formatCountList(attrCounts)}</div>
    <div><strong>Top Archetypes:</strong> ${formatCountList(archeCounts, 4)}</div>
  `;

  deckStatsWarnings.innerHTML = warnings.length
    ? warnings.map((item) => `<div>${escapeHtml(item)}</div>`).join("")
    : `<div>No fusion material warnings found.</div>`;

  if (fusionSuggestions) {
    fusionSuggestions.innerHTML = suggestions.length
      ? suggestions.map((item) => `
        <div class="suggestion-item">
          <div class="suggestion-meta">
            <strong>${escapeHtml(item.card.name || "Unknown Fusion")}</strong>
            <small>${escapeHtml(item.status)}</small>
          </div>
          <button type="button" class="mini-btn fusion-suggest-btn" data-card-id="${escapeHtml(item.card.cardId)}">Add Fusion</button>
        </div>
      `).join("")
      : `<div>No fusion suggestions yet.</div>`;

    fusionSuggestions.querySelectorAll('.fusion-suggest-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = allCards.find((entry) => entry.cardId === btn.dataset.cardId);
        if (card) {
          addFusionSuggestionPackage(card);
          refreshView();
        }
      });
    });
  }
}

function countDeckNames(items) {
  const map = new Map();
  for (const card of items) {
    const key = String(card?.name || '').toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function parseFusionMaterials(card) {
  if (!isFusionCard(card)) return [];
  const text = String(card.cleanedRules || card.rulesText || '');
  let line = text.split(/[.!?]/)[0] || '';
  line = line.replace(/^fusion(?:\s+cost)?\s*:\s*/i, '').trim();
  if (!line) return [];

  const parts = line.split(/\s*\+\s*/).map((part) => part.trim()).filter(Boolean);
  const requirements = [];
  for (let part of parts) {
    part = part.replace(/^\d+\s+different\s+/i, '');
    const exact = part.match(/^(\d+)\s+(.+)$/i);
    const count = exact ? Number(exact[1]) : 1;
    const rawName = exact ? exact[2] : part;
    const name = tidySpaces(rawName.replace(/(card|creature|monster|monsters)/gi, ''));
    if (!name || /^(fire|water|wind|earth|light|dark|neutral)$/i.test(name)) continue;
    if (/^(different|listed cards|summon by using|cannot be summoned)/i.test(name)) continue;
    requirements.push({ name, count });
  }
  return requirements;
}

function getFusionSuggestions() {
  const mainCounts = countDeckNames(deckState.main);
  const ownedFusion = new Set(deckState.fusion.map((card) => String(card.name || '').toLowerCase()));
  return allCards
    .filter((card) => isFusionCard(card) && !ownedFusion.has(String(card.name || '').toLowerCase()))
    .map((card) => {
      const requirements = parseFusionMaterials(card);
      if (!requirements.length) return null;
      let matched = 0;
      const missing = [];
      for (const requirement of requirements) {
        const owned = mainCounts.get(requirement.name.toLowerCase()) || 0;
        if (owned >= requirement.count) matched += 1;
        else missing.push(`${requirement.name} (${owned}/${requirement.count})`);
      }
      if (!matched) return null;
      return {
        card,
        score: matched / requirements.length,
        status: missing.length ? `Missing: ${missing.join(', ')}` : 'All listed materials found in Main Deck'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.card.name || '').localeCompare(String(b.card.name || '')))
    .slice(0, 6);
}

function countBy(items, getter) {
  const map = new Map();
  for (const item of items) {
    const key = getter(item) || "None";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function formatCountList(entries, limit = 6) {
  if (!entries.length) return "None";
  return entries.slice(0, limit).map(([key, value]) => `${escapeHtml(key)} (${value})`).join(" · ");
}

function persistDeckState(message) {
  syncActiveDeckReference();
  saveDeckLibrary();
  renderDeck();
  if (message) toast(message);
}

function syncActiveDeckReference() {
  const index = appState.deckLibrary.decks.findIndex((deck) => deck.id === appState.activeDeckId);
  if (index >= 0) {
    appState.deckLibrary.decks[index] = sanitizeDeck(deckState);
  }
}

function sanitizeDeck(deck) {
  return {
    id: String(deck.id || cryptoRandomId()),
    name: tidySpaces(deck.name) || "Untitled Deck",
    main: Array.isArray(deck.main) ? deck.main.map((card) => normalizeCardData(card)) : [],
    fusion: Array.isArray(deck.fusion) ? deck.fusion.map((card) => normalizeCardData(card)) : []
  };
}

function loadDeckLibrary() {
  try {
    const raw = localStorage.getItem(DECK_LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        activeDeckId: parsed.activeDeckId || null,
        decks: Array.isArray(parsed.decks) ? parsed.decks.map(sanitizeDeck) : []
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_DECK_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const migrated = {
        id: cryptoRandomId(),
        name: "My Deck",
        main: Array.isArray(legacy.main) ? legacy.main.map(normalizeCardData) : [],
        fusion: Array.isArray(legacy.fusion) ? legacy.fusion.map(normalizeCardData) : []
      };
      return { activeDeckId: migrated.id, decks: [migrated] };
    }
  } catch (error) {
    console.warn("Could not load deck library:", error);
  }
  return createDefaultDeckLibrary();
}

function createDefaultDeckLibrary() {
  const deck = {
    id: cryptoRandomId(),
    name: "My Deck",
    main: [],
    fusion: []
  };
  return { activeDeckId: deck.id, decks: [deck] };
}

function getActiveDeck() {
  return sanitizeDeck(appState.deckLibrary.decks.find((deck) => deck.id === appState.activeDeckId) || createDefaultDeckLibrary().decks[0]);
}

function saveDeckLibrary() {
  try {
    appState.deckLibrary.activeDeckId = appState.activeDeckId;
    localStorage.setItem(DECK_LIBRARY_STORAGE_KEY, JSON.stringify(appState.deckLibrary));
  } catch (error) {
    console.warn("Could not save decks to localStorage:", error);
  }
}

function hydrateDeckLibraryAgainstCardPool() {
  const poolById = new Map(allCards.map((card) => [tidySpaces(card.cardId).toLowerCase(), card]));
  const poolByName = new Map(allCards.map((card) => [tidySpaces(card.name).toLowerCase(), card]));

  function resolveCard(card, forceFusion) {
    const normalized = normalizeCardData(card || {});
    const byId = poolById.get(tidySpaces(normalized.cardId).toLowerCase());
    if (byId) return byId;
    const byName = poolByName.get(tidySpaces(normalized.name).toLowerCase());
    if (byName) return byName;
    if (forceFusion) return normalizeCardData({ ...normalized, cardType: "Fusion" });
    return normalized;
  }

  appState.deckLibrary.decks = appState.deckLibrary.decks.map((deck) => ({
    ...deck,
    main: (deck.main || []).map((card) => resolveCard(card, false)),
    fusion: (deck.fusion || []).map((card) => resolveCard(card, true))
  }));
  deckState = getActiveDeck();
  syncActiveDeckReference();
  saveDeckLibrary();
}

function renderDeckSelect() {
  deckSelect.innerHTML = appState.deckLibrary.decks.map((deck) => `
    <option value="${escapeHtml(deck.id)}" ${deck.id === appState.activeDeckId ? "selected" : ""}>${escapeHtml(deck.name)}</option>
  `).join("");
  deckNameInput.value = deckState.name || "";
}

function onDeckSelectChange() {
  const nextId = deckSelect.value;
  const nextDeck = appState.deckLibrary.decks.find((deck) => deck.id === nextId);
  if (!nextDeck) return;
  appState.activeDeckId = nextId;
  deckState = sanitizeDeck(nextDeck);
  saveDeckLibrary();
  renderDeck();
  refreshView();
}

function createNewDeckFromInput() {
  const name = tidySpaces(deckNameInput.value) || `Deck ${appState.deckLibrary.decks.length + 1}`;
  const deck = { id: cryptoRandomId(), name, main: [], fusion: [] };
  appState.deckLibrary.decks.push(deck);
  appState.activeDeckId = deck.id;
  deckState = sanitizeDeck(deck);
  persistDeckState(`Created ${name}`);
  refreshView();
}

function renameCurrentDeck() {
  const name = tidySpaces(deckNameInput.value);
  if (!name) {
    toast("Enter a deck name first");
    return;
  }
  deckState.name = name;
  persistDeckState(`Renamed to ${name}`);
}

function duplicateCurrentDeck() {
  const copy = sanitizeDeck({
    ...deckState,
    id: cryptoRandomId(),
    name: `${deckState.name || "Deck"} Copy`
  });
  appState.deckLibrary.decks.push(copy);
  appState.activeDeckId = copy.id;
  deckState = copy;
  persistDeckState(`Duplicated ${copy.name}`);
  refreshView();
}

function deleteCurrentDeck() {
  if (appState.deckLibrary.decks.length <= 1) {
    toast("Keep at least one deck saved");
    return;
  }
  const removedName = deckState.name || "Deck";
  appState.deckLibrary.decks = appState.deckLibrary.decks.filter((deck) => deck.id !== appState.activeDeckId);
  appState.activeDeckId = appState.deckLibrary.decks[0].id;
  deckState = sanitizeDeck(appState.deckLibrary.decks[0]);
  persistDeckState(`Deleted ${removedName}`);
  refreshView();
}

function toggleDeckCollapse() {
  if (!deckPanel || !deckCollapseBtn) return;
  const isCollapsed = deckPanel.classList.toggle('collapsed');
  deckCollapseBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
  deckCollapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
}

function applyUiState() {
  const ui = appState.ui || {};
  searchInput.value = ui.search || "";
  manaFilter.value = ui.mana || "";
  pointsFilter.value = ui.points ?? "";
  attributeFilter.value = ui.attribute || "";
  archetypeFilter.value = ui.archetype || "";
  typeFilter.value = ui.type || "";
  fusionFilter.value = ui.fusion || "";
  deckViewFilter.value = ui.deckMode || "";
  hideFullToggle.checked = Boolean(ui.hideFull);
  sortSelect.value = ui.sort || "name-asc";
  readUiFromUrl();

}

function saveUiState() {
  appState.ui = {
    search: searchInput.value,
    mana: manaFilter.value,
    points: pointsFilter.value,
    attribute: attributeFilter.value,
    archetype: archetypeFilter.value,
    type: typeFilter.value,
    fusion: fusionFilter.value,
    deckMode: deckViewFilter.value,
    hideFull: hideFullToggle.checked,
    sort: sortSelect.value
  };
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(appState.ui));
  } catch (error) {
    console.warn("Could not save UI state:", error);
  }
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function syncUrlFromUi() {
  const params = new URLSearchParams();
  if (searchInput.value) params.set("search", searchInput.value);
  if (manaFilter.value) params.set("mana", manaFilter.value);
  if (pointsFilter.value !== "") params.set("points", pointsFilter.value);
  if (attributeFilter.value) params.set("attribute", attributeFilter.value);
  if (archetypeFilter.value) params.set("archetype", archetypeFilter.value);
  if (typeFilter.value) params.set("type", typeFilter.value);
  if (fusionFilter.value) params.set("fusion", fusionFilter.value);
  if (deckViewFilter.value) params.set("deckView", deckViewFilter.value);
  if (hideFullToggle.checked) params.set("hideFull", "1");
  if (sortSelect.value && sortSelect.value !== "name-asc") params.set("sort", sortSelect.value);
  const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  history.replaceState(null, "", next);
}

function readUiFromUrl() {
  const params = new URLSearchParams(window.location.search);
  searchInput.value = params.get("search") || searchInput.value;
  manaFilter.value = params.get("mana") || manaFilter.value;
  if (params.has("points")) pointsFilter.value = params.get("points");
  attributeFilter.value = params.get("attribute") || attributeFilter.value;
  archetypeFilter.value = params.get("archetype") || archetypeFilter.value;
  typeFilter.value = params.get("type") || typeFilter.value;
  fusionFilter.value = params.get("fusion") || fusionFilter.value;
  deckViewFilter.value = params.get("deckView") || deckViewFilter.value;
  hideFullToggle.checked = params.get("hideFull") === "1" || hideFullToggle.checked;
  sortSelect.value = params.get("sort") || sortSelect.value;
}

function attachImageFallback(img, label, onFallback) {
  if (!img) return;
  img.addEventListener("error", () => {
    img.src = createFallbackImage(label);
    if (typeof onFallback === "function") onFallback();
  }, { once: true });
}

function preloadImage(src) {
  if (!src) return;
  const img = new Image();
  img.src = src;
}

function createFallbackImage(label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="560">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="50%" fill="#bbb" font-size="24" font-family="Arial" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "none";
}

function shorten(text, maxLength) {
  const s = String(text || "");
  return s.length > maxLength ? `${s.slice(0, maxLength - 1)}…` : s;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.classList.add("hidden");
  }, 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}


// Compact type shortcuts retain the existing advanced filters and saved UI state.
document.querySelectorAll("[data-card-type]").forEach(button => {
  button.addEventListener("click", () => { typeFilter.value = button.dataset.cardType; refreshView(); });
});
document.getElementById("searchHelpBtn").addEventListener("click", () => {
  const help = document.getElementById("searchHelp");
  help.hidden = !help.hidden;
  document.getElementById("searchHelpBtn").setAttribute("aria-expanded", String(!help.hidden));
});
if (window.matchMedia("(max-width: 640px)").matches) {
  deckPanel.classList.add("collapsed");
  deckCollapseBtn.textContent = "Expand";
  deckCollapseBtn.setAttribute("aria-expanded", "false");
}


function getDeckPoints() {
  return [...deckState.main, ...deckState.fusion].reduce((sum, card) => sum + (card.deckPoints || 0), 0);
}

function renderManaBadge(card) {
  return `<span class="tag tag-mana"><svg class="mana-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5C6.5 4 3.5 6.6 3.5 9.5a4.5 4.5 0 0 0 9 0C12.5 6.6 9.5 4 8 1.5Z"/><path d="M6 9.5a2 2 0 0 0 2 2"/></svg>Mana ${card.manaCost ?? 0}</span>`;
}
