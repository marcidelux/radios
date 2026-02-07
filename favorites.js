// ===============================
// GLOBAL STATE
// ===============================

let catalog = null;

let allStations = [];
let stationsById = new Map();

let countries = {};
let genres = {};

let favorites = []; // full station objects (exported to player.js)

// ===============================
// PREVIEW PLAYBACK STATE (logo click)
// ===============================

let previewStationId = null;

function dispatchPreviewPlay(station) {
  window.dispatchEvent(new CustomEvent("preview-play", { detail: { station } }));
}

function dispatchPreviewStop() {
  window.dispatchEvent(new CustomEvent("preview-stop"));
}

function setPreviewRowHighlight(stationId) {
  const rows = document.querySelectorAll("#favorites-table tbody tr");
  rows.forEach(row => {
    const isActive = row.dataset.stationId === stationId;
    row.classList.toggle("preview-active", isActive);

    const img = row.querySelector("img");
    if (img) {
      img.style.outline = isActive ? "3px solid #00ff00" : "";
      img.style.outlineOffset = isActive ? "2px" : "";
    }
  });
}

function stopPreviewPlayback() {
  if (!previewStationId) return;

  previewStationId = null;
  setPreviewRowHighlight(null);
  dispatchPreviewStop();
}

const STORAGE_KEY = "favoriteStationIds";
const PAGE_SIZE_KEY = "pageSize";

export function getFavorites() {
  return favorites;
}

// Active filter state
let activeCountry = "";
let activeGenres = new Set();

// Pagination state
let pageSize = loadPageSize();
let currentPage = 1;
let filteredStations = []; // result after applying filters

// ===============================
// INITIALIZATION
// ===============================

console.log("[INIT] Favorites component starting...");

fetch("stations.json")
  .then(res => res.json())
  .then(data => {
    console.log("[INIT] stations.json loaded");

    catalog = data;
    allStations = data.stations;
    countries = data.countries;
    genres = data.genres;

    // Build fast lookup
    stationsById.clear();
    allStations.forEach(st => {
      stationsById.set(st.id, st);
    });

    // Build filter UI
    buildCountryFilter();
    buildGenreFilter();
    initGenreDropdown();

    // Initial favorites from storage (source of truth)
    rebuildFavoritesFromStorageAndNotify(true);

    // Initial table = all stations (unfiltered)
    filteredStations = allStations;
    currentPage = 1;
    renderCurrentPage();

    console.log("[INIT] Favorites ready");
  })
  .catch(err => {
    console.error("[INIT] Failed to load stations.json", err);
  });

// ===============================
// STORAGE
// ===============================

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("[STORAGE] Invalid storage format");
    return [];
  }
}

function saveToStorage(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function loadPageSize() {
  const raw = localStorage.getItem(PAGE_SIZE_KEY);
  const value = parseInt(raw, 10);
  return [10, 20, 50, 100].includes(value) ? value : 10;
}

function savePageSize(size) {
  localStorage.setItem(PAGE_SIZE_KEY, String(size));
}

// ===============================
// FILTER UI
// ===============================

function buildCountryFilter() {
  const select = document.getElementById("filter-country");

  Object.entries(countries).forEach(([code, meta]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = meta.flag ? `${meta.flag} ${meta.name}` : meta.name;
    select.appendChild(option);
  });
}

function buildGenreFilter() {
  const container = document.getElementById("filter-genres");

  Object.entries(genres).forEach(([key, meta]) => {
    const label = document.createElement("label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = key;

    label.appendChild(checkbox);
    label.append(" " + meta.label);

    container.appendChild(label);
  });
}

// ===============================
// GENRE DROPDOWN BEHAVIOR
// ===============================

function initGenreDropdown() {
  const genreLabel = document.getElementById("genre-label");

  createGenreModal();
  genreLabel.addEventListener("click", openGenreModal);
  updateGenreLabel();
}

function updateGenreLabel() {
  const genreLabel = document.getElementById("genre-label");

  if (activeGenres.size === 0) {
    genreLabel.textContent = "Genres";
  } else if (activeGenres.size === 1) {
    genreLabel.textContent = [...activeGenres][0];
  } else {
    genreLabel.textContent = `${activeGenres.size} genres`;
  }
}

// ===============================
// GENRE MODAL
// ===============================

let genreModal = null;

function createGenreModal() {
  if (genreModal) return genreModal;

  const overlay = document.createElement("div");
  overlay.className = "genre-modal-overlay";
  overlay.innerHTML = `
    <div class="genre-modal" role="dialog" aria-modal="true" aria-labelledby="genre-modal-title">
      <div class="genre-modal-header">
        <div id="genre-modal-title" class="genre-modal-title">Select genres</div>
        <button class="genre-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="genre-modal-body"></div>
      <div class="genre-modal-actions">
        <button class="genre-modal-btn ghost" type="button">Cancel</button>
        <button class="genre-modal-btn primary" type="button">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const body = overlay.querySelector(".genre-modal-body");
  const closeBtn = overlay.querySelector(".genre-modal-close");
  const cancelBtn = overlay.querySelector(".genre-modal-btn.ghost");
  const okBtn = overlay.querySelector(".genre-modal-btn.primary");

  const list = document.getElementById("filter-genres");
  body.appendChild(list);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeGenreModal("cancel");
  });
  closeBtn.addEventListener("click", () => closeGenreModal("cancel"));
  cancelBtn.addEventListener("click", () => closeGenreModal("cancel"));
  okBtn.addEventListener("click", () => closeGenreModal("ok"));

  document.addEventListener("keydown", (e) => {
    if (overlay.classList.contains("open") && e.key === "Escape") {
      closeGenreModal("cancel");
    }
  });

  genreModal = { overlay, list, prevSelection: new Set() };
  return genreModal;
}

function openGenreModal() {
  const modal = createGenreModal();
  modal.prevSelection = new Set(activeGenres);
  syncGenreCheckboxes(activeGenres);
  modal.overlay.classList.add("open");
}

function closeGenreModal(action) {
  const modal = genreModal;
  if (!modal) return;

  if (action === "ok") {
    activeGenres = getCheckedGenres();
    updateGenreLabel();
  } else {
    syncGenreCheckboxes(modal.prevSelection);
  }

  modal.overlay.classList.remove("open");
}

function getCheckedGenres() {
  const selected = new Set();
  if (!genreModal) return selected;

  genreModal.list
    .querySelectorAll("input[type=\"checkbox\"]")
    .forEach(cb => {
      if (cb.checked) selected.add(cb.value);
    });

  return selected;
}

function syncGenreCheckboxes(selectedSet) {
  if (!genreModal) return;

  genreModal.list
    .querySelectorAll("input[type=\"checkbox\"]")
    .forEach(cb => {
      cb.checked = selectedSet.has(cb.value);
    });
}

// ===============================
// FILTER APPLY
// ===============================

document.getElementById("filter-apply").addEventListener("click", applyFilters);

function applyFilters() {
  // Requirement: refilter stops preview playback
  stopPreviewPlayback();
  activeCountry = document.getElementById("filter-country").value || "";

  filteredStations = allStations.filter(station => {
    // Country filter
    if (activeCountry && station.country !== activeCountry) return false;

    // Genre filter (OR logic)
    if (activeGenres.size > 0) {
      const match = (station.genres || []).some(g => activeGenres.has(g));
      if (!match) return false;
    }

    return true;
  });

  currentPage = 1;
  renderCurrentPage();
}

// ===============================
// PAGINATION (render + smart page list)
// ===============================

function renderCurrentPage() {
  const totalPages = Math.max(1, Math.ceil(filteredStations.length / pageSize));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  const start = (currentPage - 1) * pageSize;
  const pageStations = filteredStations.slice(start, start + pageSize);

  rebuildTable(pageStations);
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById("pagination");
  if (!container) return;

  container.innerHTML = "";

  // Page size selector
  const sizeSelect = document.createElement("select");
  sizeSelect.className = "page-size-select";

  [3, 10, 20, 50, 100].forEach(size => {
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = `${size} / page`;
    if (size === pageSize) opt.selected = true;
    sizeSelect.appendChild(opt);
  });

  sizeSelect.addEventListener("change", () => {
    // Requirement: changing page-size stops preview playback
    stopPreviewPlayback();
    pageSize = parseInt(sizeSelect.value, 10);
    savePageSize(pageSize);
    currentPage = 1;
    renderCurrentPage();
  });

  container.appendChild(sizeSelect);

  // If only one page, you can hide pagination completely:
  if (totalPages <= 1) {
    return;
  }

  // Prev button
  container.appendChild(
    makePageButton("<", currentPage > 1, () => {
      // Requirement: pagination stops preview playback
      stopPreviewPlayback();
      currentPage -= 1;
      renderCurrentPage();
    })
  );

  // Page numbers (smart)
  const items = getSmartPages(currentPage, totalPages);
  items.forEach(item => {
    if (item === "...") {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "…";
      container.appendChild(span);
      return;
    }

    const pageNum = item;
    const btn = makePageButton(
      String(pageNum),
      true,
      () => {
        // Requirement: pagination stops preview playback
        stopPreviewPlayback();
        currentPage = pageNum;
        renderCurrentPage();
      }
    );

    if (pageNum === currentPage) {
      btn.classList.add("active");
      btn.disabled = true;
    }

    container.appendChild(btn);
  });

  // Next button
  container.appendChild(
    makePageButton(">", currentPage < totalPages, () => {
      // Requirement: pagination stops preview playback
      stopPreviewPlayback();
      currentPage += 1;
      renderCurrentPage();
    })
  );
}

// Produces: 1 … 5 6 7 … 20
function getSmartPages(current, total) {
  // Tune window size here
  const windowSize = 3; // pages around current (current-1..current+1)
  const pages = [];

  if (total <= 10) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  pages.push(1);

  if (left > 2) pages.push("...");

  for (let i = left; i <= right; i++) pages.push(i);

  if (right < total - 1) pages.push("...");

  pages.push(total);

  return pages;
}

function makePageButton(text, enabled, onClick) {
  const btn = document.createElement("button");
  btn.className = "page-btn";
  btn.textContent = text;
  btn.disabled = !enabled;
  if (enabled) btn.addEventListener("click", onClick);
  return btn;
}

// ===============================
// TABLE BUILDING
// ===============================

function rebuildTable(stations) {
  const container = document.getElementById("favorites-container");
  container.innerHTML = "";
  buildTable(stations);
}

function buildTable(stations) {
  const storedIds = new Set(loadFromStorage());

  const container = document.getElementById("favorites-container");

  const table = document.createElement("table");
  table.id = "favorites-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Logo</th>
        <th>Favorite</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  stations.forEach(station => {
    const isChecked = storedIds.has(station.id);

    const row = document.createElement("tr");
    row.dataset.stationId = station.id;

    row.innerHTML = `
      <td>${countries[station.country].flag} ${station.name}</td>
      <td><img src="${station.image}" alt="${station.name}" /></td>
      <td><input type="checkbox" ${isChecked ? "checked" : ""} /></td>
    `;

    // Logo click => preview/toggle preview
    const logoImg = row.querySelector("img");
    if (logoImg) {
      logoImg.style.cursor = "pointer";
      logoImg.tabIndex = 0;
      logoImg.addEventListener("blur", () => {
        if (previewStationId === station.id) stopPreviewPlayback();
      });
      logoImg.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle off
        if (previewStationId === station.id) {
          stopPreviewPlayback();
          return;
        }

        // Switch to new preview
        previewStationId = station.id;
        setPreviewRowHighlight(station.id);
        dispatchPreviewPlay(station);
        logoImg.focus({ preventScroll: true });
      });
      logoImg.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          logoImg.click();
        }
      });
    }

    // IMPORTANT: update storage incrementally (pagination-safe)
    row.querySelector("input").addEventListener("change", (e) => {
      onFavoriteToggle(station.id, e.target.checked);
    });

    tbody.appendChild(row);
  });

  container.appendChild(table);
}

// ===============================
// FAVORITES LOGIC (pagination-safe)
// ===============================

function onFavoriteToggle(stationId, checked) {
  const ids = new Set(loadFromStorage());

  if (checked) ids.add(stationId);
  else ids.delete(stationId);

  saveToStorage([...ids]);

  rebuildFavoritesFromStorageAndNotify(true);
}

function rebuildFavoritesFromStorageAndNotify(shouldNotify) {
  const ids = loadFromStorage();
  favorites = ids
    .map(id => stationsById.get(id))
    .filter(Boolean);

  if (shouldNotify) {
    window.dispatchEvent(new CustomEvent("favorites-changed"));
  }
}
