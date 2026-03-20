let allCards = [];
let filteredCards = [];
let visibleCount = 0;
const PAGE_SIZE = 48;
const DECK_STORAGE_KEY = "dimensions_tcg_deck_v1";

const deckState = loadDeck();

const searchInput = document.getElementById("searchInput");
const manaFilter = document.getElementById("manaFilter");
const attributeFilter = document.getElementById("attributeFilter");
const archetypeFilter = document.getElementById("archetypeFilter");
const typeFilter = document.getElementById("typeFilter");
const cardGrid = document.getElementById("cardGrid");
const resultsCount = document.getElementById("resultsCount");

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

const ui = ensureEnhancementUI();

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

    allCards = cards;
    buildFilters(cards);
    refreshView();
    renderDeck();
  })
  .catch((error) => {
    console.error("Failed to load card database:", error);
    resultsCount.textContent = `Failed to load card database: ${error.message}`;
  });

function cleanRulesText(rulesText) {
  if (!rulesText) return "";

  return String(rulesText)
    .replace(/^Hand;\s*/i, "")
    .replace(/^Play;\s*/i, "")
    .replace(/^Fusion;\s*/i, "")
    .replace(/^SpecialSummon;\s*/i, "")
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

  manaFilter.innerHTML = `<option value="">Any Mana</option>`;
  attributeFilter.innerHTML = `<option value="">Any Attribute</option>`;
  archetypeFilter.innerHTML = `<option value="">Any Archetype</option>`;
  typeFilter.innerHTML = `<option value="">Any Type</option>`;

  for (const mana of manaValues) {
    const option = document.createElement("option");
    option.value = mana;
    option.textContent = mana;
    manaFilter.appendChild(option);
  }

  for (const value of attributes) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    attributeFilter.appendChild(option);
  }

  for (const value of archetypes) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    archetypeFilter.appendChild(option);
  }

  for (const value of types) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    typeFilter.appendChild(option);
  }
}

function getFilteredCards() {
  const search = searchInput.value.trim().toLowerCase();
  const mana = manaFilter.value;
  const attribute = attributeFilter.value;
  const archetype = archetypeFilter.value;
  const type = typeFilter.value;
  const sortMode = ui.sortSelect.value;

  let cards = allCards.filter((card) => {
    const cleanedRules = cleanRulesText(card.rulesText || "").toLowerCase();
    const keywords = extractKeywords(card.rulesText || "").map((k) => k.toLowerCase());

    const matchesSearch = matchesAdvancedSearch(card, {
      raw: search,
      cleanedRules,
      keywords
    });

    const matchesMana = !mana || String(card.manaCost) === mana;
    const matchesAttribute = !attribute || card.attribute === attribute;
    const matchesArchetype = !archetype || card.archetype === archetype;
    const matchesType = !type || card.cardType === type;

    return matchesSearch && matchesMana && matchesAttribute && matchesArchetype && matchesType;
  });

  cards = sortCards(cards, sortMode);

  return cards;
}

function matchesAdvancedSearch(card, context) {
  const raw = context.raw;
  if (!raw) return true;

  const tokens = raw.split(/\s+/).filter(Boolean);
  const textHaystack = [
    card.name || "",
    context.cleanedRules || "",
    card.archetype || "",
    card.attribute || "",
    card.cardType || "",
    ...context.keywords
  ].join(" ").toLowerCase();

  for (const token of tokens) {
    if (isFieldToken(token)) {
      if (!matchesFieldToken(card, token)) return false;
    } else {
      if (!textHaystack.includes(token)) return false;
    }
  }

  return true;
}

function isFieldToken(token) {
  return /^(mana|atk|def|attribute|type|archetype|keyword|name)\s*[:<>=]/i.test(token);
}

function matchesFieldToken(card, token) {
  const numericMatch = token.match(/^(mana|atk|def)\s*(>=|<=|=|>|<|:)\s*(\d+)$/i);
  if (numericMatch) {
    const field = numericMatch[1].toLowerCase();
    const operator = numericMatch[2] === ":" ? "=" : numericMatch[2];
    const expected = Number(numericMatch[3]);
    const actual =
      field === "mana" ? Number(card.manaCost || 0)
      : field === "atk" ? Number(card.atk || 0)
      : Number(card.def || 0);

    switch (operator) {
      case "=": return actual === expected;
      case ">": return actual > expected;
      case "<": return actual < expected;
      case ">=": return actual >= expected;
      case "<=": return actual <= expected;
      default: return true;
    }
  }

  const textMatch = token.match(/^(attribute|type|archetype|keyword|name)\s*[:=]\s*(.+)$/i);
  if (textMatch) {
    const field = textMatch[1].toLowerCase();
    const value = textMatch[2].toLowerCase();

    if (field === "attribute") return String(card.attribute || "").toLowerCase().includes(value);
    if (field === "type") return String(card.cardType || "").toLowerCase().includes(value);
    if (field === "archetype") return String(card.archetype || "").toLowerCase().includes(value);
    if (field === "name") return String(card.name || "").toLowerCase().includes(value);
    if (field === "keyword") {
      return extractKeywords(card.rulesText || "").some((k) => k.toLowerCase().includes(value));
    }
  }

  return true;
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
    case "type":
      return copy.sort((a, b) => String(a.cardType || "").localeCompare(String(b.cardType || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    case "attribute":
      return copy.sort((a, b) => String(a.attribute || "").localeCompare(String(b.attribute || "")) || String(a.name || "").localeCompare(String(b.name || "")));
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
  filteredCards = getFilteredCards();
  visibleCount = Math.min(PAGE_SIZE, filteredCards.length);
  renderCards(filteredCards.slice(0, visibleCount));
  updateLoadMore();
}

function renderCards(cards) {
  cardGrid.innerHTML = "";
  resultsCount.textContent = `${filteredCards.length} card(s) found`;

  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <h3>No cards found</h3>
      <p>Try changing your filters or search. Example: <code>mana:3 attribute:fire</code></p>
    `;
    cardGrid.appendChild(empty);
    return;
  }

  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "card";

    const keywords = extractKeywords(card.rulesText || "");
    const cleanedRules = cleanRulesText(card.rulesText || "");

    div.innerHTML = `
      <img src="${escapeHtml(card.image || "")}" alt="${escapeHtml(card.name || "")}" loading="lazy">
      <div class="card-body">
        <h3>${escapeHtml(card.name || "")}</h3>
        <div class="tags">
          <span class="tag tag-mana">Mana ${card.manaCost ?? 0}</span>
          <span class="tag attr-${slugify(card.attribute || "none")}">${escapeHtml(card.attribute || "None")}</span>
          <span class="tag archetype-tag">${escapeHtml(card.archetype || "None")}</span>
          <span class="tag type-${slugify(card.cardType || "unknown")}">${escapeHtml(card.cardType || "Unknown")}</span>
          ${isStatsCard(card) ? `<span class="tag stats-tag">ATK ${card.atk ?? 0} / DEF ${card.def ?? 0}</span>` : ""}
        </div>
        ${keywords.length ? `<div class="keyword-row">${keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
        <p class="card-rules-preview">${escapeHtml(shorten(cleanedRules, 90))}</p>
        <div class="card-actions">
          <button class="mini-btn details-btn" type="button">Details</button>
          <button class="mini-btn add-deck-btn" type="button">Add to Deck</button>
        </div>
      </div>
    `;

    const img = div.querySelector("img");
    img.addEventListener("error", () => {
      img.src = createFallbackImage(card.name || "No Image");
    });

    div.querySelector(".details-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(card);
    });

    div.querySelector(".add-deck-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      addCardToDeck(card);
    });

    div.addEventListener("click", () => openModal(card));
    div.addEventListener("mouseenter", (e) => showHoverPreview(card, e));
    div.addEventListener("mousemove", moveHoverPreview);
    div.addEventListener("mouseleave", hideHoverPreview);

    cardGrid.appendChild(div);
  }
}

function openModal(card) {
  modalImage.src = card.image || "";
  modalImage.alt = card.name || "";
  modalName.textContent = card.name || "";
  modalMana.textContent = card.manaCost ?? 0;
  modalAttribute.textContent = card.attribute || "None";
  modalArchetype.textContent = card.archetype || "None";
  modalType.textContent = card.cardType || "Unknown";
  modalStats.textContent = isStatsCard(card) ? `${card.atk ?? 0} / ${card.def ?? 0}` : "-";

  modalImage.onerror = () => {
    modalImage.src = createFallbackImage(card.name || "No Image");
  };

  const keywords = extractKeywords(card.rulesText || "");
  const cleanedRules = cleanRulesText(card.rulesText || "");

  modalRules.innerHTML = `
    <div class="modal-rules-wrap">
      ${keywords.length ? `<div class="modal-keywords">${keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
      <div class="modal-rule-text">${escapeHtml(cleanedRules || "No rules text.")}</div>
      <div class="modal-actions">
        <button type="button" class="mini-btn modal-add-deck-btn">Add to Deck</button>
      </div>
    </div>
  `;

  const addBtn = modalRules.querySelector(".modal-add-deck-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => addCardToDeck(card));
  }

  decorateModalLabels(card);
  cardModal.classList.remove("hidden");
}

function decorateModalLabels(card) {
  modalAttribute.className = `detail-pill attr-${slugify(card.attribute || "none")}`;
  modalType.className = `detail-pill type-${slugify(card.cardType || "unknown")}`;
}

closeModal.addEventListener("click", () => {
  cardModal.classList.add("hidden");
});

cardModal.addEventListener("click", (e) => {
  if (e.target === cardModal) {
    cardModal.classList.add("hidden");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cardModal.classList.add("hidden");
    hideHoverPreview();
  }
});

[searchInput, manaFilter, attributeFilter, archetypeFilter, typeFilter].forEach((el) => {
  el.addEventListener("input", debounce(refreshView, 150));
  el.addEventListener("change", refreshView);
});

ui.sortSelect.addEventListener("change", refreshView);
ui.clearButton.addEventListener("click", clearFilters);
ui.loadMoreButton.addEventListener("click", loadMoreCards);
ui.clearDeckButton.addEventListener("click", clearDeck);
ui.exportDeckButton.addEventListener("click", exportDeck);

function clearFilters() {
  searchInput.value = "";
  manaFilter.value = "";
  attributeFilter.value = "";
  archetypeFilter.value = "";
  typeFilter.value = "";
  ui.sortSelect.value = "name-asc";
  refreshView();
  toast("Filters cleared");
}

function loadMoreCards() {
  visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredCards.length);
  renderCards(filteredCards.slice(0, visibleCount));
  updateLoadMore();
}

function updateLoadMore() {
  const remaining = filteredCards.length - visibleCount;
  ui.loadMoreButton.style.display = remaining > 0 ? "inline-flex" : "none";
  ui.loadMoreButton.textContent = remaining > 0 ? `Load More (${remaining} remaining)` : "Load More";
}

function showHoverPreview(card, event) {
  const keywords = extractKeywords(card.rulesText || "");
  const cleanedRules = cleanRulesText(card.rulesText || "");

  ui.hoverPreview.innerHTML = `
    <img src="${escapeHtml(card.image || "")}" alt="${escapeHtml(card.name || "")}">
    <div class="hover-preview-body">
      <div class="hover-preview-title">${escapeHtml(card.name || "")}</div>
      <div class="hover-preview-tags">
        <span class="tag tag-mana">Mana ${card.manaCost ?? 0}</span>
        <span class="tag attr-${slugify(card.attribute || "none")}">${escapeHtml(card.attribute || "None")}</span>
        <span class="tag type-${slugify(card.cardType || "unknown")}">${escapeHtml(card.cardType || "Unknown")}</span>
      </div>
      ${keywords.length ? `<div class="keyword-row">${keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
      <div class="hover-preview-rules">${escapeHtml(shorten(cleanedRules, 120))}</div>
    </div>
  `;

  const previewImg = ui.hoverPreview.querySelector("img");
  previewImg.addEventListener("error", () => {
    previewImg.src = createFallbackImage(card.name || "No Image");
  });

  ui.hoverPreview.classList.add("show");
  moveHoverPreview(event);
}

function moveHoverPreview(event) {
  const offset = 18;
  ui.hoverPreview.style.left = `${event.clientX + offset}px`;
  ui.hoverPreview.style.top = `${event.clientY + offset}px`;
}

function hideHoverPreview() {
  ui.hoverPreview.classList.remove("show");
}

function addCardToDeck(card) {
  if (isFusionCard(card)) {
    if (deckState.fusion.length >= 10) {
      toast("Fusion deck is full (max 10)");
      return;
    }
    deckState.fusion.push(card);
    saveDeck();
    renderDeck();
    toast(`${card.name} added to Fusion Deck`);
    return;
  }

  if (deckState.main.length >= 80) {
    toast("Main deck is full (max 80)");
    return;
  }

  deckState.main.push(card);
  saveDeck();
  renderDeck();
  toast(`${card.name} added to Main Deck`);
}

function removeCardFromDeck(index, section) {
  if (section === "fusion") {
    deckState.fusion.splice(index, 1);
  } else {
    deckState.main.splice(index, 1);
  }

  saveDeck();
  renderDeck();
}

function clearDeck() {
  deckState.main = [];
  deckState.fusion = [];
  saveDeck();
  renderDeck();
  toast("Deck cleared");
}

function renderDeck() {
  const mainCount = deckState.main.length;
  const fusionCount = deckState.fusion.length;

  ui.mainDeckCount.textContent = `${mainCount}/80`;
  ui.fusionDeckCount.textContent = `${fusionCount}/10`;

  let status = "Main Deck needs at least 60 cards.";
  if (mainCount >= 60 && mainCount <= 80) {
    status = "Main Deck size is valid.";
  }
  if (mainCount > 80) {
    status = "Main Deck exceeds 80 cards.";
  }
  if (fusionCount > 10) {
    status = "Fusion Deck exceeds 10 cards.";
  }

  ui.deckStatus.textContent = status;
  ui.deckStatus.className = `deck-status ${mainCount >= 60 && mainCount <= 80 && fusionCount <= 10 ? "valid" : "warning"}`;

  ui.mainDeckList.innerHTML = deckState.main.length
    ? deckState.main.map((card, index) => `
      <li class="deck-item">
        <span>${escapeHtml(card.name || "")}</span>
        <button type="button" class="mini-btn remove-deck-btn" data-section="main" data-index="${index}">Remove</button>
      </li>
    `).join("")
    : `<li class="deck-empty">No main deck cards yet.</li>`;

  ui.fusionDeckList.innerHTML = deckState.fusion.length
    ? deckState.fusion.map((card, index) => `
      <li class="deck-item">
        <span>${escapeHtml(card.name || "")}</span>
        <button type="button" class="mini-btn remove-deck-btn" data-section="fusion" data-index="${index}">Remove</button>
      </li>
    `).join("")
    : `<li class="deck-empty">No fusion cards yet.</li>`;

  ui.deckPanel.querySelectorAll(".remove-deck-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeCardFromDeck(Number(btn.dataset.index), btn.dataset.section);
    });
  });
}

function saveDeck() {
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckState));
}

function loadDeck() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return { main: [], fusion: [] };
    const parsed = JSON.parse(raw);
    return {
      main: Array.isArray(parsed.main) ? parsed.main : [],
      fusion: Array.isArray(parsed.fusion) ? parsed.fusion : []
    };
  } catch {
    return { main: [], fusion: [] };
  }
}

function exportDeck() {
  const payload = {
    main: deckState.main.map((c) => c.name),
    fusion: deckState.fusion.map((c) => c.name)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deck.json";
  a.click();
  URL.revokeObjectURL(url);
}

function ensureEnhancementUI() {
  injectEnhancementStyles();

  const toolbar = document.createElement("div");
  toolbar.className = "enhancement-toolbar";
  toolbar.innerHTML = `
    <label class="enhancement-label">
      Sort
      <select id="sortSelect">
        <option value="name-asc">Name A-Z</option>
        <option value="name-desc">Name Z-A</option>
        <option value="mana-asc">Mana Low-High</option>
        <option value="mana-desc">Mana High-Low</option>
        <option value="atk-desc">ATK High-Low</option>
        <option value="atk-asc">ATK Low-High</option>
        <option value="def-desc">DEF High-Low</option>
        <option value="def-asc">DEF Low-High</option>
        <option value="attribute">Attribute</option>
        <option value="type">Type</option>
      </select>
    </label>
    <button type="button" id="clearFiltersBtn" class="mini-btn">Clear Filters</button>
    <button type="button" id="loadMoreBtn" class="mini-btn">Load More</button>
  `;

  const filtersParent = (searchInput && searchInput.parentElement) || document.body;
  filtersParent.appendChild(toolbar);

  const hoverPreview = document.createElement("div");
  hoverPreview.className = "hover-preview";
  document.body.appendChild(hoverPreview);

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  document.body.appendChild(toastEl);

  const deckPanel = document.createElement("section");
  deckPanel.className = "deck-panel";
  deckPanel.innerHTML = `
    <h2>Deck Builder</h2>
    <div class="deck-summary">
      <div><strong>Main Deck:</strong> <span id="mainDeckCount">0/80</span></div>
      <div><strong>Fusion Deck:</strong> <span id="fusionDeckCount">0/10</span></div>
    </div>
    <div id="deckStatus" class="deck-status warning">Main Deck needs at least 60 cards.</div>
    <div class="deck-controls">
      <button type="button" id="clearDeckBtn" class="mini-btn">Clear Deck</button>
      <button type="button" id="exportDeckBtn" class="mini-btn">Export Deck</button>
    </div>
    <div class="deck-columns">
      <div>
        <h3>Main Deck</h3>
        <ul id="mainDeckList" class="deck-list"></ul>
      </div>
      <div>
        <h3>Fusion Deck</h3>
        <ul id="fusionDeckList" class="deck-list"></ul>
      </div>
    </div>
  `;
  cardGrid.parentElement.appendChild(deckPanel);

  return {
    sortSelect: toolbar.querySelector("#sortSelect"),
    clearButton: toolbar.querySelector("#clearFiltersBtn"),
    loadMoreButton: toolbar.querySelector("#loadMoreBtn"),
    hoverPreview,
    toastEl,
    deckPanel,
    mainDeckCount: deckPanel.querySelector("#mainDeckCount"),
    fusionDeckCount: deckPanel.querySelector("#fusionDeckCount"),
    deckStatus: deckPanel.querySelector("#deckStatus"),
    mainDeckList: deckPanel.querySelector("#mainDeckList"),
    fusionDeckList: deckPanel.querySelector("#fusionDeckList"),
    clearDeckButton: deckPanel.querySelector("#clearDeckBtn"),
    exportDeckButton: deckPanel.querySelector("#exportDeckBtn")
  };
}

function injectEnhancementStyles() {
  if (document.getElementById("appEnhancementStyles")) return;

  const style = document.createElement("style");
  style.id = "appEnhancementStyles";
  style.textContent = `
    .enhancement-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}
    .enhancement-label{display:flex;gap:8px;align-items:center}
    .enhancement-label select{padding:6px 10px;border-radius:8px;background:#111;color:#fff;border:1px solid #333}
    .mini-btn{padding:6px 10px;border:none;border-radius:8px;background:#2d2d2d;color:#fff;cursor:pointer}
    .mini-btn:hover{filter:brightness(1.15)}
    .empty-state{grid-column:1/-1;padding:24px;border:1px solid #333;border-radius:14px;background:#111;color:#ddd}
    .card-rules-preview{margin-top:8px;color:#bbb;font-size:13px;line-height:1.4}
    .card-actions{display:flex;gap:8px;margin-top:10px}
    .keyword-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .keyword-badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#264653;color:#fff;font-size:11px}
    .hover-preview{position:fixed;z-index:9999;width:280px;pointer-events:none;background:#111;border:1px solid #333;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.45);opacity:0;transform:scale(.98);transition:.12s ease}
    .hover-preview.show{opacity:1;transform:scale(1)}
    .hover-preview img{display:block;width:100%;height:180px;object-fit:cover;background:#000}
    .hover-preview-body{padding:12px}
    .hover-preview-title{font-size:18px;font-weight:700;margin-bottom:8px;color:#fff}
    .hover-preview-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
    .hover-preview-rules{font-size:13px;color:#ddd;line-height:1.4}
    .toast{position:fixed;bottom:20px;right:20px;background:#1d3557;color:#fff;padding:10px 14px;border-radius:10px;opacity:0;transform:translateY(8px);transition:.18s ease;z-index:10000}
    .toast.show{opacity:1;transform:translateY(0)}
    .deck-panel{margin-top:24px;padding:18px;border:1px solid #333;border-radius:16px;background:#101010;color:#fff}
    .deck-summary{display:flex;gap:18px;flex-wrap:wrap;margin:10px 0}
    .deck-status{padding:10px 12px;border-radius:10px;margin-bottom:12px}
    .deck-status.valid{background:#1f5130}
    .deck-status.warning{background:#5a3b10}
    .deck-controls{display:flex;gap:10px;margin-bottom:14px}
    .deck-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .deck-list{list-style:none;padding:0;margin:0;max-height:320px;overflow:auto;border:1px solid #2c2c2c;border-radius:12px;background:#0c0c0c}
    .deck-item,.deck-empty{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #1f1f1f}
    .deck-item:last-child,.deck-empty:last-child{border-bottom:none}
    .modal-rules-wrap{display:flex;flex-direction:column;gap:10px}
    .modal-keywords{display:flex;gap:6px;flex-wrap:wrap}
    .modal-rule-text{background:#0f0f0f;border:1px solid #2f2f2f;border-radius:10px;padding:12px;line-height:1.5;white-space:pre-wrap}
    .modal-actions{display:flex;gap:8px}
    .detail-pill{display:inline-block;padding:3px 10px;border-radius:999px;color:#fff}
    .tag{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;background:#2d2d2d;color:#fff}
    .tag-mana{background:#3a0ca3}
    .stats-tag{background:#6d6875}
    .archetype-tag{background:#344e41}
    .attr-fire{background:#c1121f}.attr-water{background:#0077b6}.attr-earth{background:#6b705c}.attr-wind{background:#2a9d8f}.attr-light{background:#e9c46a;color:#111}.attr-dark{background:#3c096c}.attr-neutral{background:#6c757d}.attr-none{background:#495057}
    .type-creature{background:#7f5539}.type-fusion{background:#5a189a}.type-spell{background:#1d3557}.type-trap{background:#9d4edd}.type-unknown{background:#444}
    @media (max-width: 900px){.deck-columns{grid-template-columns:1fr}.hover-preview{display:none}}
  `;
  document.head.appendChild(style);
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
  ui.toastEl.textContent = message;
  ui.toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toastEl.classList.remove("show"), 1800);
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