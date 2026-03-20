let allCards = [];

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
    renderCards(cards);
  })
  .catch((error) => {
    console.error("Failed to load card database:", error);
    resultsCount.textContent = `Failed to load card database: ${error.message}`;
  });

function buildFilters(cards) {
  const manaValues = [...new Set(cards.map((c) => c.manaCost))]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .sort((a, b) => a - b);

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

  return allCards.filter((card) => {
    const matchesSearch =
      !search ||
      (card.name || "").toLowerCase().includes(search) ||
      (card.rulesText || "").toLowerCase().includes(search) ||
      (card.archetype || "").toLowerCase().includes(search) ||
      (card.attribute || "").toLowerCase().includes(search) ||
      (card.cardType || "").toLowerCase().includes(search);

    const matchesMana = !mana || String(card.manaCost) === mana;
    const matchesAttribute = !attribute || card.attribute === attribute;
    const matchesArchetype = !archetype || card.archetype === archetype;
    const matchesType = !type || card.cardType === type;

    return matchesSearch && matchesMana && matchesAttribute && matchesArchetype && matchesType;
  });
}

function isStatsCard(card) {
  return card.cardType === "Creature" || card.cardType === "Fusion";
}

function renderCards(cards) {
  cardGrid.innerHTML = "";
  resultsCount.textContent = `${cards.length} card(s) found`;

  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${card.image}" alt="${escapeHtml(card.name || "")}" loading="lazy">
      <div class="card-body">
        <h3>${escapeHtml(card.name || "")}</h3>
        <div class="tags">
          <span class="tag">Mana ${card.manaCost ?? 0}</span>
          <span class="tag">${escapeHtml(card.attribute || "None")}</span>
          <span class="tag">${escapeHtml(card.archetype || "None")}</span>
          <span class="tag">${escapeHtml(card.cardType || "Unknown")}</span>
          ${isStatsCard(card) ? `<span class="tag">ATK ${card.atk ?? 0} / DEF ${card.def ?? 0}</span>` : ""}
        </div>
      </div>
    `;

    div.addEventListener("click", () => openModal(card));
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
  modalRules.textContent = card.rulesText || "";
  cardModal.classList.remove("hidden");
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
  }
});

[searchInput, manaFilter, attributeFilter, archetypeFilter, typeFilter].forEach((el) => {
  el.addEventListener("input", () => renderCards(getFilteredCards()));
  el.addEventListener("change", () => renderCards(getFilteredCards()));
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
