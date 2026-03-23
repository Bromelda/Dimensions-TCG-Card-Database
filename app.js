
let allCards = [];
let filteredCards = [];
let visibleCount = 0;
const DECK_LIBRARY_STORAGE_KEY = "dimensions_tcg_decks_v2";
const LEGACY_DECK_STORAGE_KEY = "dimensions_tcg_deck_v1";
const UI_STORAGE_KEY = "dimensions_tcg_ui_v2";
const DECK_CODE_PREFIX_V2 = "DECKV2|";
const DECK_CODE_PREFIX_V1 = "DECKV1|";
const DECK_CODE_VERSION = 2;

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
const attributeFilter = document.getElementById("attributeFilter");
const archetypeFilter = document.getElementById("archetypeFilter");
const typeFilter = document.getElementById("typeFilter");
const fusionFilter = document.getElementById("fusionFilter");
const deckViewFilter = document.getElementById("deckViewFilter");
const hideFullToggle = document.getElementById("hideFullToggle");
const cardGrid = document.getElementById("cardGrid");
const resultsCount = document.getElementById("resultsCount");
const loadMoreBtn = document.getElementById("loadMoreBtn");
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
const exportDeckBtn = document.getElementById("exportDeckBtn");
const exportDeckTxtBtn = document.getElementById("exportDeckTxtBtn");
const importDeckBtn = document.getElementById("importDeckBtn");
const importDeckInput = document.getElementById("importDeckInput");
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
const copyDeckCodeBtn = document.getElementById("copyDeckCodeBtn");
const importDeckCodeBtn = document.getElementById("importDeckCodeBtn");
const copyDeckLinkBtn = document.getElementById("copyDeckLinkBtn");
const deckCodeInput = document.getElementById("deckCodeInput");

let searchIndex = null;

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

fetch("./data/cards.json")
  .then((response) => {
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
    buildSearchIndex(allCards);
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
  card.atk = normalizeNumber(card.atk);
  card.def = normalizeNumber(card.def);
  card.rulesText = normalizeRulesText(card.rulesText);
  card.image = normalizeImagePath(card.image);
  card.keywords = extractKeywords(card.rulesText || "");
  card.cleanedRules = cleanRulesText(card.rulesText || "");
  card.searchBlob = [card.name, card.cleanedRules, card.archetype, card.attribute, card.cardType, ...card.keywords].join(" ").toLowerCase();
  card.isLegendary = String(card.archetype || "").toLowerCase() === "legendary";
  card.imageIssue = !card.image;
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

    return matchesSearch && matchesMana && matchesAttribute && matchesArchetype && matchesType && matchesFusion && matchesDeckMode && matchesHideFull;
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
  if (!searchIndex || !search) return allCards;
  const tokens = (search.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
    .map((token) => token.trim())
    .filter((token) => token && !isFieldToken(token))
    .map((token) => stripQuotes(token).toLowerCase())
    .filter(Boolean);

  if (!tokens.length) return allCards;

  let candidateIds = null;
  for (const token of tokens) {
    const tokenSet = searchIndex.tokenMap.get(token);
    if (!tokenSet) return [];
    if (candidateIds === null) {
      candidateIds = new Set(tokenSet);
      continue;
    }
    candidateIds = new Set([...candidateIds].filter((id) => tokenSet.has(id)));
    if (!candidateIds.size) return [];
  }

  return [...candidateIds].map((id) => searchIndex.cardsById.get(id)).filter(Boolean);
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
  return /^(mana|atk|def|attribute|type|archetype|keyword|name|text|deck|legendary|has|copies|section|fusion)\s*[:<>=]/i.test(token);
}

function matchesFieldToken(card, token) {
  const normalizedToken = token.replace(/^section\s*[:=]/i, "deck:");
  const numericMatch = normalizedToken.match(/^(mana|atk|def|copies)\s*(>=|<=|=|>|<|:)\s*(\d+)$/i);
  if (numericMatch) {
    const field = numericMatch[1].toLowerCase();
    const operator = numericMatch[2] === ":" ? "=" : numericMatch[2];
    const expected = Number(numericMatch[3]);
    const actual =
      field === "mana" ? Number(card.manaCost || 0)
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

function refreshView() {
  saveUiState();
  filteredCards = getFilteredCards();
  visibleCount = filteredCards.length;
  renderCards(filteredCards);
  updateLoadMore();
  syncUrlFromUi();
}

function renderCards(cards) {
  cardGrid.innerHTML = "";
  resultsCount.textContent = `${filteredCards.length} card(s) found`;

  if (!cards.length) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  for (const card of cards) {
    const div = document.createElement("article");
    div.className = "card";
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", `Open details for ${card.name || "card"}`);

    const keywords = card.keywords;
    const cleanedRules = card.cleanedRules;
    const section = getDeckSection(card);
    const copies = getCardCopiesInSection(card, section);
    const limit = getCardCopyLimit(card);
    const isFull = copies >= limit;

    div.innerHTML = `
      <img src="${escapeHtml(card.image || createFallbackImage(card.name || "No Image"))}" alt="${escapeHtml(card.name || "")}" loading="lazy" decoding="async">
      <div class="card-body">
        <h3>${escapeHtml(card.name || "")}</h3>
        <div class="tags">
          <span class="tag tag-mana">Mana ${card.manaCost ?? 0}</span>
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
        refreshView();
      });
    }

    div.addEventListener("click", () => openModal(card));
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(card);
      }
    });

    if (appState.previewEnabled) {
      div.addEventListener("mouseenter", (e) => showHoverPreview(card, e));
      div.addEventListener("mousemove", moveHoverPreview);
      div.addEventListener("mouseleave", hideHoverPreview);
    }

    cardGrid.appendChild(div);
  }
}

function openModal(card) {
  const index = filteredCards.findIndex((item) => item.cardId === card.cardId);
  appState.currentModalCard = card;
  appState.currentModalIndex = index;
  appState.modalLastFocus = document.activeElement;

  modalImage.src = card.image || createFallbackImage(card.name || "No Image");
  modalImage.alt = card.name || "";
  modalName.textContent = card.name || "";
  modalMana.textContent = card.manaCost ?? 0;
  modalAttribute.textContent = card.attribute || "None";
  modalArchetype.textContent = card.archetype || "None";
  modalType.textContent = card.cardType || "Unknown";
  modalStats.textContent = isStatsCard(card) ? `${card.atk ?? 0} / ${card.def ?? 0}` : "-";

  attachImageFallback(modalImage, card.name || "No Image", () => {
    modalImageStatus.textContent = "Showing fallback image";
  });
  preloadImage(card.image);

  const keywords = card.keywords;
  const cleanedRules = card.cleanedRules;
  const section = getDeckSection(card);
  const copies = getCardCopiesInSection(card, section);
  const limit = getCardCopyLimit(card);

  modalKeywordBadges.innerHTML = keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("");
  modalRules.textContent = cleanedRules || "No rules text.";
  modalDeckCount.textContent = `${copies}/${limit} in ${section === "fusion" ? "Fusion" : "Main"} Deck`;
  modalImageStatus.textContent = card.imageIssue ? "Image path missing from data" : "";
  modalFusionHint.textContent = getFusionHint(card);
  modalFusionHint.classList.toggle("hidden", !modalFusionHint.textContent);
  modalAddDeckBtn.textContent = `Add to ${section === "fusion" ? "Fusion" : "Main"} Deck`;
  modalAddDeckBtn.disabled = copies >= limit;
  modalPrevBtn.disabled = appState.currentModalIndex <= 0;
  modalNextBtn.disabled = appState.currentModalIndex < 0 || appState.currentModalIndex >= filteredCards.length - 1;

  decorateModalLabels(card);
  cardModal.classList.remove("hidden");
  trapFocusToModal();
}

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
    if (appState.currentModalCard) openModal(appState.currentModalCard);
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

[searchInput, manaFilter, attributeFilter, archetypeFilter, typeFilter, fusionFilter, deckViewFilter].forEach((el) => {
  el.addEventListener("input", debounce(refreshView, 150));
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
exportDeckBtn.addEventListener("click", () => exportDeck("json"));
exportDeckTxtBtn.addEventListener("click", () => exportDeck("txt"));
importDeckBtn.addEventListener("click", () => importDeckInput.click());
importDeckInput.addEventListener("change", handleImportDeck);
if (copyDeckCodeBtn) copyDeckCodeBtn.addEventListener("click", copyCurrentDeckCode);
if (importDeckCodeBtn) importDeckCodeBtn.addEventListener("click", promptImportDeckCode);
if (copyDeckLinkBtn) copyDeckLinkBtn.addEventListener("click", copyCurrentDeckLink);
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
  visibleCount = filteredCards.length;
  renderCards(filteredCards);
  updateLoadMore();
}

function updateLoadMore() {
  loadMoreBtn.classList.add("hidden");
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
        <span class="tag tag-mana">Mana ${card.manaCost ?? 0}</span>
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

    deckStatus.textContent = `Main: ${mainCount}/60-80 · Fusion: ${fusionCount}/10`;

    let warning = "";
    if (mainCount < 60) warning = "Main deck must have at least 60 cards.";
    else if (mainCount > 80) warning = "Main deck cannot exceed 80 cards.";
    else if (fusionCount > 10) warning = "Fusion deck cannot exceed 10 cards.";
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
            <small>${escapeHtml(entry.card.cardType || "Unknown")} · Mana ${entry.card.manaCost ?? 0}</small>
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
            <small>${escapeHtml(entry.card.cardType || "Unknown")} · Mana ${entry.card.manaCost ?? 0}</small>
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

function exportDeck(format) {
  const deck = sanitizeDeck(deckState);
  const safeName = slugify(deck.name || "deck") || "deck";
  if (format === "txt") {
    const lines = [
      `${deck.name}`,
      `Main Deck (${deck.main.length})`,
      ...summarizeDeckSection(deck.main).map((entry) => `${entry.count}x ${entry.card.name}`),
      "",
      `Fusion Deck (${deck.fusion.length})`,
      ...summarizeDeckSection(deck.fusion).map((entry) => `${entry.count}x ${entry.card.name}`)
    ];
    downloadFile(`${safeName}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
    toast("Deck exported as TXT");
    return;
  }

  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    deck
  }, null, 2);
  downloadFile(`${safeName}.json`, payload, "application/json;charset=utf-8");
  toast("Deck exported as JSON");
}

function handleImportDeck(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const imported = parseImportedDeck(text, file.name || "Imported Deck");
      appState.deckLibrary.decks.push(imported);
      appState.activeDeckId = imported.id;
      deckState = imported;
      persistDeckState(`Imported ${imported.name}`);
      refreshView();
    } catch (error) {
      console.error("Import failed:", error);
      toast(`Import failed: ${error.message}`);
    } finally {
      importDeckInput.value = "";
    }
  };
  reader.readAsText(file);
}

function parseImportedDeck(text, fallbackName) {
  const parsed = JSON.parse(text);
  const rawDeck = parsed.deck || parsed;
  return sanitizeDeck({
    id: cryptoRandomId(),
    name: tidySpaces(rawDeck.name || rawDeck.deckName) || tidySpaces(fallbackName.replace(/\.[^.]+$/, "")) || "Imported Deck",
    main: rawDeck.main || rawDeck.cards || [],
    fusion: rawDeck.fusion || rawDeck.fusionCards || []
  });
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function generateDeckCode(deck) {
  return buildDeckCodeV2(deck);
}

function decodeDeckCode(code) {
  const extracted = tryExtractDeckCodeFromInput(code);

  if (extracted.startsWith(DECK_CODE_PREFIX_V2)) {
    return sanitizeDeck(decodeDeckCodeV2(extracted));
  }

  if (extracted.startsWith(DECK_CODE_PREFIX_V1)) {
    return sanitizeDeck(decodeDeckCodeV1(extracted));
  }

  return sanitizeDeck(decodeLegacyDeckCode(extracted));
}

function loadDeckFromCode(code) {
  const imported = decodeDeckCode(code);
  appState.deckLibrary.decks.push(imported);
  appState.activeDeckId = imported.id;
  deckState = imported;
  persistDeckState(`Imported ${imported.name}`);
  refreshView();
}

function buildDeckCodeV2(deck) {
  const portable = createPortableDeckPayload(deck);
  const json = JSON.stringify(portable);
  return `${DECK_CODE_PREFIX_V2}${base64UrlEncodeUnicode(json)}`;
}

function createPortableDeckPayload(deck) {
  const safeDeck = sanitizeDeck(deck);
  return {
    v: DECK_CODE_VERSION,
    n: tidySpaces(safeDeck.name) || "Shared Deck",
    m: summarizePortableSection(safeDeck.main),
    f: summarizePortableSection(safeDeck.fusion)
  };
}

function summarizePortableSection(items) {
  const counts = new Map();
  for (const rawCard of items || []) {
    const card = normalizeCardData(rawCard);
    const id = tidySpaces(card.cardId);
    const key = id || `name:${tidySpaces(card.name).toLowerCase()}`;
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, { id, name: tidySpaces(card.name), count: 0 });
    counts.get(key).count += 1;
  }
  const packed = [];
  for (const entry of counts.values()) {
    packed.push({ t: entry.id || `~${entry.name}`, c: entry.count });
  }
  return packed;
}

function decodeDeckCodeV2(code) {
  const encoded = code.slice(DECK_CODE_PREFIX_V2.length).trim();
  if (!encoded) throw new Error("Missing DECKV2 payload");
  const decoded = JSON.parse(base64UrlDecodeUnicode(encoded));
  return expandPortableDeck(decoded, "Imported Deck");
}

function expandPortableDeck(payload, fallbackName) {
  return {
    id: cryptoRandomId(),
    name: tidySpaces(payload?.n || payload?.deckName || payload?.name) || fallbackName || "Imported Deck",
    main: expandPortableSection(payload?.m || payload?.cards || payload?.main, false),
    fusion: expandPortableSection(payload?.f || payload?.fusionCards || payload?.fusion, true)
  };
}

function expandPortableSection(source, forceFusion) {
  if (!Array.isArray(source)) return [];
  const result = [];
  const poolById = new Map(allCards.map((card) => [tidySpaces(card.cardId).toLowerCase(), card]));
  const poolByName = new Map(allCards.map((card) => [tidySpaces(card.name).toLowerCase(), card]));

  for (const item of source) {
    const token = tidySpaces(item?.t || item?.id || item?.cardId || item?.name || item);
    const count = Math.max(0, Number(item?.c ?? item?.count ?? 1) || 0);
    if (!token || !count) continue;

    let resolved = null;
    if (token.startsWith('~')) resolved = poolByName.get(tidySpaces(token.slice(1)).toLowerCase()) || normalizeCardData({ name: token.slice(1), cardType: forceFusion ? 'Fusion' : undefined });
    else resolved = poolById.get(token.toLowerCase()) || poolByName.get(token.toLowerCase()) || normalizeCardData({ cardId: token, name: token, cardType: forceFusion ? 'Fusion' : undefined });

    for (let i = 0; i < count; i += 1) result.push(resolved);
  }

  return result;
}

function decodeDeckCodeV1(code) {
  const parts = String(code || '').trim().split('|');
  if (parts.length < 3) throw new Error('Malformed DECKV1 code');
  const payload = JSON.parse(decodeBase64Unicode(parts.slice(2).join('|')));
  const deck = {
    id: cryptoRandomId(),
    name: tidySpaces(payload?.deckName || parts[1] || 'Imported Deck'),
    main: expandEntryArray(payload?.cards || [], false),
    fusion: expandEntryArray(payload?.fusionCards || [], true)
  };
  return deck;
}

function expandEntryArray(entries, forceFusion) {
  const result = [];
  const poolById = new Map(allCards.map((card) => [tidySpaces(card.cardId).toLowerCase(), card]));
  const poolByName = new Map(allCards.map((card) => [tidySpaces(card.name).toLowerCase(), card]));
  for (const entry of entries || []) {
    const id = tidySpaces(entry?.cardId || entry?.card || '');
    const name = tidySpaces(entry?.cardName || '');
    const count = Math.max(0, Number(entry?.count || 0));
    if (!count) continue;
    const resolved = (id && poolById.get(id.toLowerCase())) || (name && poolByName.get(name.toLowerCase())) || normalizeCardData({ cardId: id, name: name || id, cardType: forceFusion ? 'Fusion' : undefined });
    for (let i = 0; i < count; i += 1) result.push(resolved);
  }
  return result;
}

function decodeLegacyDeckCode(code) {
  const decoded = JSON.parse(decodeBase64Unicode(String(code || '').trim()));
  const nameMap = new Map(allCards.map((card) => [String(card.name || '').toLowerCase(), card]));
  return {
    id: cryptoRandomId(),
    name: tidySpaces(decoded.name) || 'Imported Deck',
    main: Array.isArray(decoded.main) ? decoded.main.map((name) => nameMap.get(String(name || '').toLowerCase()) || normalizeCardData({ name })) : [],
    fusion: Array.isArray(decoded.fusion) ? decoded.fusion.map((name) => nameMap.get(String(name || '').toLowerCase()) || normalizeCardData({ name, cardType: 'Fusion' })) : []
  };
}

function tryExtractDeckCodeFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Missing deck code');
  if (raw.startsWith(DECK_CODE_PREFIX_V2) || raw.startsWith(DECK_CODE_PREFIX_V1)) return raw;
  try {
    const url = new URL(raw);
    const param = url.searchParams.get('deck');
    if (param) return param;
  } catch (_) {}
  const match = raw.match(/[?&]deck=([^&#]+)/i);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return raw;
}

function base64UrlEncodeUnicode(value) {
  return encodeBase64Unicode(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeUnicode(value) {
  let normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  return decodeBase64Unicode(normalized);
}

function encodeBase64Unicode(value) {
  return btoa(unescape(encodeURIComponent(String(value || ''))));
}

function decodeBase64Unicode(value) {
  return decodeURIComponent(escape(atob(String(value || '').trim())));
}

function copyTextToClipboard(value, message) {
  const text = String(value || '');
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast(message))
      .catch(() => fallbackCopyText(text, message));
    return;
  }
  fallbackCopyText(text, message);
}

function fallbackCopyText(value, message) {
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  toast(message);
}

function copyCurrentDeckCode() {
  const code = generateDeckCode(sanitizeDeck(deckState));
  if (deckCodeInput) deckCodeInput.value = code;
  copyTextToClipboard(code, 'Deck code copied');
}

function promptImportDeckCode() {
  const code = deckCodeInput ? deckCodeInput.value : window.prompt('Paste deck code or share link:');
  if (!code) return;
  try {
    loadDeckFromCode(code);
    if (deckCodeInput) deckCodeInput.value = '';
  } catch (error) {
    console.error('Deck code import failed:', error);
    toast('Invalid deck code');
  }
}

function copyCurrentDeckLink() {
  const url = new URL(window.location.href);
  const code = generateDeckCode(sanitizeDeck(deckState));
  url.searchParams.set('deck', code);
  if (deckCodeInput) deckCodeInput.value = url.toString();
  copyTextToClipboard(url.toString(), 'Share link copied');
}

function maybeLoadDeckFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const deckCode = params.get('deck');
  if (!deckCode) return;
  try {
    const imported = decodeDeckCode(deckCode);
    const existing = appState.deckLibrary.decks.find((deck) => generateDeckCode(deck) === deckCode);
    if (!existing) {
      appState.deckLibrary.decks.push(imported);
      appState.activeDeckId = imported.id;
      deckState = imported;
      saveDeckLibrary();
      toast(`Loaded shared deck: ${imported.name}`);
    }
  } catch (error) {
    console.warn('Could not load deck from URL:', error);
  }
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
  attributeFilter.value = ui.attribute || "";
  archetypeFilter.value = ui.archetype || "";
  typeFilter.value = ui.type || "";
  fusionFilter.value = ui.fusion || "";
  deckViewFilter.value = ui.deckMode || "";
  hideFullToggle.checked = Boolean(ui.hideFull);
  sortSelect.value = ui.sort || "name-asc";
  readUiFromUrl();
  maybeLoadDeckFromUrl();
}

function saveUiState() {
  appState.ui = {
    search: searchInput.value,
    mana: manaFilter.value,
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
