// ===============================
// GLOBAL STATE
// ===============================
let allStations = [];     // full list from JSON
let favorites = [];      // full objects (GLOBAL EXPORT LATER)

const STORAGE_KEY = "favorites"; // stores only station names

export function getFavorites() {
  return favorites;
}

// ===============================
// INITIALIZATION
// ===============================
console.log("[INIT] Favorites component starting...");

fetch("stations.json")
  .then(res => res.json())
  .then(stations => {
    console.log("[INIT] stations.json loaded:", stations.length);

    allStations = stations;

    const storedNames = loadFromStorage();
    buildTable(allStations, storedNames);
    rebuildFavoritesFromTable();

    logFavorites();
  });


// ===============================
// STORAGE
// ===============================
function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    console.log("[STORAGE] No stored favorites found");
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    console.log("[STORAGE] Loaded favorites from localStorage:", parsed);
    return parsed;
  } catch (e) {
    console.error("[STORAGE] Failed to parse localStorage", e);
    return [];
  }
}

function saveToStorage(names) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  console.log("[STORAGE] Saved favorites:", names);
}


// ===============================
// TABLE BUILDING
// ===============================
function buildTable(stations, storedNames) {
  console.log("[TABLE] Building table...");

  const container = document.getElementById("favorites-container");

  const table = document.createElement("table");
  table.id = "favorites-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Logo</th>
      <th>Favorite</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  stations.forEach(station => {
    const isChecked = storedNames.includes(station.name);

    console.log(
      `[TABLE] Row: ${station.name} | checked: ${isChecked}`
    );

    const row = document.createElement("tr");
    row.dataset.stationName = station.name;

    row.innerHTML = `
      <td>${station.name}</td>
      <td><img src="${station.image}" alt="${station.name}" /></td>
      <td>
        <input type="checkbox" ${isChecked ? "checked" : ""} />
      </td>
    `;

    const checkbox = row.querySelector("input");
    checkbox.addEventListener("change", onCheckboxChange);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  console.log("[TABLE] Table built");
}


// ===============================
// EVENT HANDLING
// ===============================
function onCheckboxChange(event) {
  const row = event.target.closest("tr");
  const stationName = row.dataset.stationName;
  const checked = event.target.checked;

  console.log(
    `[UI] Checkbox changed: ${stationName} → ${checked}`
  );

  rebuildFavoritesFromTable();
  logFavorites();
}


// ===============================
// FAVORITES LOGIC
// ===============================
function rebuildFavoritesFromTable() {
  console.log("[FAVORITES] Rebuilding from table state...");

  const checkedNames = [];
  favorites = [];

  document.querySelectorAll("#favorites-table tbody tr").forEach(row => {
    const checkbox = row.querySelector("input");
    const name = row.dataset.stationName;

    if (checkbox.checked) {
      checkedNames.push(name);

      const station = allStations.find(s => s.name === name);
      if (station) {
        favorites.push(station);
      }
    }
  });

  saveToStorage(checkedNames);

  window.dispatchEvent(
    new CustomEvent("favorites-changed")
  );

  console.log(
    `[FAVORITES] Rebuilt. Count: ${favorites.length}`
  );
}

function logFavorites() {
  console.log("⭐ CURRENT FAVORITES:");
  favorites.forEach(st => {
    console.log(" •", st.name, st.stream);
  });
}
