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
const loadMoreBtn = document.getElementById("loadMoreBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const toggleDeckBtn = document.getElementById("toggleDeckBtn");
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
const emptyState = document.getElementById("emptyState");
const sortSelect = document.getElementById("sortSelect");

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
  const sortMode = sortSelect.value;

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
    case "attribute":
    case "attribute-asc":
      return copy.sort((a, b) => String(a.attribute || "").localeCompare(String(b.attribute || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    case "type":
    case "type-asc":
      return copy.sort((a, b) => String(a.cardType || "").localeCompare(String(b.cardType || "")) || String(a.name || "").localeCompare(String(b.name || "")));
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
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "card";

    const keywords = extractKeywords(card.rulesText || "");
    const cleanedRules = cleanRulesText(card.rulesText || "");
    const section = getDeckSection(card);
    const copies = getCardCopiesInSection(card, section);
    const limit = getCardCopyLimit(card);

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
          <button class="mini-btn add-deck-btn" type="button">Add to Deck (${copies}/${limit})</button>
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

  if (modalKeywordBadges) {
    modalKeywordBadges.innerHTML = keywords.map((k) => `<span class="keyword-badge">${escapeHtml(k)}</span>`).join("");
  }

  modalRules.textContent = cleanedRules || "No rules text.";

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

sortSelect.addEventListener("change", refreshView);
clearFiltersBtn.addEventListener("click", clearFilters);
loadMoreBtn.addEventListener("click", loadMoreCards);

if (toggleDeckBtn) {
  toggleDeckBtn.addEventListener("click", () => {
    deckPanel.classList.remove("hidden");
    deckPanel.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  });
}

if (closeDeckBtn) {
  closeDeckBtn.addEventListener("click", () => {
    deckPanel.classList.add("hidden");
  });
}

clearDeckBtn.addEventListener("click", clearDeck);

function clearFilters() {
  searchInput.value = "";
  manaFilter.value = "";
  attributeFilter.value = "";
  archetypeFilter.value = "";
  typeFilter.value = "";
  sortSelect.value = "name-asc";
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
  if (remaining > 0) {
    loadMoreBtn.classList.remove("hidden");
    loadMoreBtn.textContent = `Load More (${remaining} remaining)`;
  } else {
    loadMoreBtn.classList.add("hidden");
  }
}

function showHoverPreview(card, event) {
  const keywords = extractKeywords(card.rulesText || "");
  const cleanedRules = cleanRulesText(card.rulesText || "");

  cardPreview.innerHTML = `
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

  const previewImg = cardPreview.querySelector("img");
  if (previewImg) {
    previewImg.addEventListener("error", () => {
      previewImg.src = createFallbackImage(card.name || "No Image");
    });
  }

  cardPreview.classList.remove("hidden");
  cardPreview.classList.add("show");
  moveHoverPreview(event);
}

function moveHoverPreview(event) {
  const offset = 18;
  cardPreview.style.left = `${event.clientX + offset}px`;
  cardPreview.style.top = `${event.clientY + offset}px`;
}

function hideHoverPreview() {
  cardPreview.classList.remove("show");
  cardPreview.classList.add("hidden");
}

function getDeckSection(card) {
  return isFusionCard(card) ? "fusion" : "main";
}

function getCardCopyLimit(card) {
  return String(card?.archetype || "").toLowerCase() === "legendary" ? 1 : 3;
}

function getCardCopiesInSection(card, section) {
  const list = section === "fusion" ? deckState.fusion : deckState.main;
  return list.filter((item) => String(item.name || "") === String(card?.name || "")).length;
}

function summarizeDeckSection(items) {
  const map = new Map();

  items.forEach((card, index) => {
    const key = String(card.name || "");
    if (!map.has(key)) {
      map.set(key, {
        card,
        count: 1,
        firstIndex: index
      });
    } else {
      map.get(key).count += 1;
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.card.name || "").localeCompare(String(b.card.name || ""))
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
      saveDeck();
      renderDeck();
      toast(`${card.name || "Card"} added to Fusion Deck (${currentCopies + 1}/${copyLimit})`);
      return;
    }

    if (deckState.main.length >= 80) {
      toast("Main deck is full (max 80)");
      return;
    }

    deckState.main.push(card);
    saveDeck();
    renderDeck();
    toast(`${card.name || "Card"} added to Main Deck (${currentCopies + 1}/${copyLimit})`);
  } catch (error) {
    console.error("addCardToDeck failed:", error);
    alert(`Add to Deck failed: ${error.message}`);
  }
}

function removeCardFromDeck(index, section) {
  try {
    if (section === "fusion") {
      deckState.fusion.splice(index, 1);
    } else {
      deckState.main.splice(index, 1);
    }

    saveDeck();
    renderDeck();
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
    saveDeck();
    renderDeck();
    refreshView();
    toast("Deck cleared");
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
          <span>${escapeHtml(entry.card.name || "")} <strong>${entry.count}/${getCardCopyLimit(entry.card)}</strong></span>
          <button type="button" class="mini-btn remove-deck-btn" data-section="main" data-index="${entry.firstIndex}">Remove 1</button>
        </div>
      `).join("")
      : `<div class="deck-empty">No main deck cards yet.</div>`;

    fusionDeckList.innerHTML = fusionSummary.length
      ? fusionSummary.map((entry) => `
        <div class="deck-item">
          <span>${escapeHtml(entry.card.name || "")} <strong>${entry.count}/${getCardCopyLimit(entry.card)}</strong></span>
          <button type="button" class="mini-btn remove-deck-btn" data-section="fusion" data-index="${entry.firstIndex}">Remove 1</button>
        </div>
      `).join("")
      : `<div class="deck-empty">No fusion cards yet.</div>`;

    deckPanel.querySelectorAll(".remove-deck-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeCardFromDeck(Number(btn.dataset.index), btn.dataset.section);
      });
    });
  } catch (error) {
    console.error("renderDeck failed:", error);
    alert(`Render deck failed: ${error.message}`);
  }
}

function saveDeck() {
  try {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckState));
  } catch (error) {
    console.warn("Could not save deck to localStorage:", error);
  }
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
  } catch (error) {
    console.warn("Could not load deck from localStorage:", error);
    return { main: [], fusion: [] };
  }
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