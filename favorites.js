// ===============================
// GLOBAL STATE
// ===============================

let catalog = null;

let allStations = [];
let stationsById = new Map();

let countries = {};
let genres = {};

let favorites = []; // full station objects (exported to player.js)

const STORAGE_KEY = "favoriteStationIds";

export function getFavorites() {
  return favorites;
}

// Active filter state
let activeCountry = "";
let activeGenres = new Set();

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

    // Load favorites from storage
    const storedIds = loadFromStorage();

    // Initial table = all stations
    buildTable(allStations, storedIds);

    // Build favorites list for player
    rebuildFavoritesFromTable();

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
    console.log("[STORAGE] Loaded favorite IDs:", parsed);
    return parsed;
  } catch {
    console.warn("[STORAGE] Invalid storage format");
    return [];
  }
}

function saveToStorage(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  console.log("[STORAGE] Saved favorite IDs:", ids);
}

// ===============================
// FILTER UI
// ===============================

function buildCountryFilter() {
  const select = document.getElementById("filter-country");

  Object.entries(countries).forEach(([code, meta]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = meta.flag
      ? `${meta.flag} ${meta.name}`
      : meta.name;

    select.appendChild(option);
  });
}

function buildGenreFilter() {
  const container = document.getElementById("filter-genres");

  Object.entries(genres).forEach(([key, meta]) => {
    const label = document.createElement("label");
    label.style.display = "block";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = key;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        activeGenres.add(key);
      } else {
        activeGenres.delete(key);
      }
      updateGenreLabel();
    });

    label.appendChild(checkbox);
    label.append(" " + meta.label);

    container.appendChild(label);
  });
}

// ===============================
// GENRE DROPDOWN BEHAVIOR
// ===============================

function initGenreDropdown() {
  const genreSelect = document.getElementById("genre-select");
  const genreLabel = document.getElementById("genre-label");

  genreLabel.addEventListener("click", () => {
    genreSelect.classList.toggle("open");
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!genreSelect.contains(e.target)) {
      genreSelect.classList.remove("open");
    }
  });

  updateGenreLabel();
}

function updateGenreLabel() {
  const genreLabel = document.getElementById("genre-label");

  if (activeGenres.size === 0) {
    genreLabel.textContent = "Select genres";
  } else if (activeGenres.size === 1) {
    genreLabel.textContent = [...activeGenres][0];
  } else {
    genreLabel.textContent = `${activeGenres.size} genres selected`;
  }
}

// ===============================
// FILTER APPLY
// ===============================

document
  .getElementById("filter-apply")
  .addEventListener("click", applyFilters);

function applyFilters() {
  activeCountry =
    document.getElementById("filter-country").value || "";

  const filtered = allStations.filter(station => {
    // Country filter
    if (activeCountry && station.country !== activeCountry) {
      return false;
    }

    // Genre filter (OR logic)
    if (activeGenres.size > 0) {
      const match = station.genres.some(g =>
        activeGenres.has(g)
      );
      if (!match) return false;
    }

    return true;
  });

  console.log(
    `[FILTER] Result count: ${filtered.length}`
  );

  rebuildTable(filtered);
}

// ===============================
// TABLE BUILDING
// ===============================

function rebuildTable(stations) {
  const storedIds = loadFromStorage();
  const container = document.getElementById("favorites-container");

  container.innerHTML = "";
  buildTable(stations, storedIds);
}

function buildTable(stations, storedIds) {
  console.log("[TABLE] Building table...");

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
    const isChecked = storedIds.includes(station.id);

    const row = document.createElement("tr");
    row.dataset.stationId = station.id;

    row.innerHTML = `
      <td>${countries[station.country].flag} ${station.name}</td>
      <td>
        <img src="${station.image}" alt="${station.name}" />
      </td>
      <td>
        <input type="checkbox" ${isChecked ? "checked" : ""} />
      </td>
    `;

    row
      .querySelector("input")
      .addEventListener("change", onCheckboxChange);

    tbody.appendChild(row);
  });

  container.appendChild(table);
}

// ===============================
// FAVORITES LOGIC
// ===============================

function onCheckboxChange() {
  rebuildFavoritesFromTable();
}

function rebuildFavoritesFromTable() {
  console.log("[FAVORITES] Rebuilding from table...");

  const checkedIds = [];
  favorites = [];

  document
    .querySelectorAll("#favorites-table tbody tr")
    .forEach(row => {
      const checkbox = row.querySelector("input");
      if (!checkbox.checked) return;

      const id = row.dataset.stationId;
      checkedIds.push(id);

      const station = stationsById.get(id);
      if (station) favorites.push(station);
    });

  saveToStorage(checkedIds);

  window.dispatchEvent(
    new CustomEvent("favorites-changed")
  );

  console.log(
    `[FAVORITES] Active favorites: ${favorites.length}`
  );
}
