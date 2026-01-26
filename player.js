import { getFavorites } from "./favorites.js";

console.log("[PLAYER] Module loaded");

const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");

let stations = [];
let splide = null;
let hls = null;
let isPlaying = false;
let audioUnlocked = false;

// ===============================
// INIT
// ===============================

window.addEventListener("DOMContentLoaded", () => {
  console.log("[PLAYER] DOM ready, waiting for favorites to load...");
  // Do NOT build here. favorites.js will dispatch "favorites-changed"
  // after it fetches stations.json + rebuilds the favorites list. :contentReference[oaicite:2]{index=2}
});

window.addEventListener("favorites-changed", () => {
  console.log("[PLAYER] Received favorites-changed event");

  const newStations = getFavorites();
  updateStations(newStations);
});

// ===============================
// FULLSCREEN
// ===============================

const playerSection = document.getElementById("player");
const enterFsBtn = document.getElementById("enter-fullscreen");
const exitFsBtn = document.getElementById("exit-fullscreen");

enterFsBtn.addEventListener("click", () => {
  if (playerSection.requestFullscreen) {
    playerSection.requestFullscreen();
  }
});

exitFsBtn.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (splide) {
    splide.refresh();
  }
});


// INIT PART

initAudioEvents();
initMediaSession();



// ===============================
// CAROUSEL BUILD/REBUILD
// ===============================

function buildCarousel() {
  console.log("[PLAYER] Building carousel with stations:", stations.length);

  // Render slides
  stationList.innerHTML = "";
  stations.forEach(station => {
    const li = document.createElement("li");
    li.className = "splide__slide";
    li.innerHTML = `<img src="${station.image}" alt="${station.name}" />`;
    stationList.appendChild(li);
  });

  // Create Splide
  splide = new Splide("#radio-splide", {
    type: "loop",
    focus: "center",
    perPage: 3,
    gap: "2rem",
    pagination: false,
    arrows: false,
    drag: true,
  });

  splide.mount();

  // Moved handler
  splide.on("moved", (index) => {
    console.log("[PLAYER] Slide moved → index:", index);

    if (audioUnlocked) {
      playStation(index);
    } else {
      console.log("[PLAYER] Audio locked (iOS), not autoplaying");
    }
  });

  registerClickHandler();
}

function destroyCarousel() {
  if (!splide) return;

  console.log("[PLAYER] Destroying existing carousel");
  try {
    splide.destroy(true); // true = completely remove added markup/listeners
  } catch (e) {
    console.warn("[PLAYER] splide.destroy error:", e);
  }
  splide = null;

  // Clear slides markup to avoid stale clones
  stationList.innerHTML = "";
}

// ===============================
// CLICK HANDLING
// ===============================

function registerClickHandler() {
  stationList.addEventListener("click", (event) => {
    if (!splide || splide.state.is(Splide.STATES.MOVING)) return;

    const slideEl = event.target.closest(".splide__slide");
    if (!slideEl) return;

    const Slide = splide.Components.Slides.get().find(s => s.slide === slideEl);
    if (!Slide) return;

    const targetIndex = Slide.index;
    const currentIndex = splide.index;
    const lastIndex = splide.length - 1;

    console.log(`[PLAYER] Click | current=${currentIndex}, target=${targetIndex}`);

    // Center click → unlock/toggle
    if (targetIndex === currentIndex) {
      handleCenterClick();
      return;
    }

    // Side click → directional move
    if (currentIndex === lastIndex && targetIndex === 0) {
      splide.go("+1");
    } else if (currentIndex === 0 && targetIndex === lastIndex) {
      splide.go("-1");
    } else if (targetIndex > currentIndex) {
      splide.go("+1");
    } else {
      splide.go("-1");
    }
  });
}


// ===============================
// NEXT / PREV callbacks
// ===============================

function carouselNext() {
  if (!splide) return;
  if (splide.state.is(Splide.STATES.MOVING)) return;
  splide.go("+1");
}

function carouselPrev() {
  if (!splide) return;
  if (splide.state.is(Splide.STATES.MOVING)) return;
  splide.go("-1");
}

// ===============================
// AUDIO CONTROL
// ===============================

function handleCenterClick() {
  console.log("[PLAYER] Center slide clicked");

  // iOS unlock: first user gesture starts audio
  if (!audioUnlocked) {
    console.log("[PLAYER] Unlocking audio (iOS)");
    audioUnlocked = true;
    playStation(splide.index);
    return;
  }

  // Toggle play / pause
  if (isPlaying) {
    pauseAudio();
  } else {
    resumeAudio();
  }
}

function playStation(index) {
  const station = stations[index];
  if (!station) return;

  console.log("[PLAYER] Playing station:", station.name);

  // Stop previous
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  if (hls) {
    hls.destroy();
    hls = null;
  }

  // HLS
  if (station.stream.endsWith(".m3u8")) {
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(station.stream);
      hls.attachMedia(audio);
    } else {
      // Safari native HLS
      audio.src = station.stream;
    }
  } else {
    // MP3 / AAC
    audio.src = station.stream;
  }

  audio.play().catch(err => {
    console.warn("[PLAYER] audio.play failed:", err);
  });
}

function pauseAudio() {
  console.log("[PLAYER] Pausing audio");
  audio.pause();
  if (hls) hls.stopLoad();
}

function resumeAudio() {
  console.log("[PLAYER] Resuming audio");
  if (hls) hls.startLoad();
  audio.play().catch(err => {
    console.warn("[PLAYER] audio.play failed:", err);
  });
}

function stopPlayback() {
  console.log("[PLAYER] Stopping playback");
  audio.pause();
  if (hls) {
    try { hls.stopLoad(); } catch {}
  }
  // Keep audioUnlocked as-is; it’s a “capability” after user gesture.
}

// ===============================
// AUDIO EVENTS (SOURCE OF TRUTH)
// ===============================

function initAudioEvents() {
  audio.addEventListener("play", () => {
    console.log("[AUDIO] play");
    isPlaying = true;
    setActiveState("playing");
  });

  audio.addEventListener("pause", () => {
    console.log("[AUDIO] pause");
    isPlaying = false;
    setActiveState("paused");
  });
}


function initMediaSession() {
  if (!("mediaSession" in navigator)) return;

  // Play/pause should map to your existing audio control
  navigator.mediaSession.setActionHandler("play", () => resumeAudio());
  navigator.mediaSession.setActionHandler("pause", () => pauseAudio());

  // Map OS media buttons (AVRCP next/prev) to carousel movement
  navigator.mediaSession.setActionHandler("nexttrack", () => carouselNext());
  navigator.mediaSession.setActionHandler("previoustrack", () => carouselPrev());
}

// ===============================
// UI STATE
// ===============================

function setActiveState(state) {
  console.log("[PLAYER] Visual state:", state);

  document.querySelectorAll(".splide__slide").forEach(slide => {
    slide.classList.remove("playing", "paused");
    slide.classList.add(state);
  });
}

// ===============================
// UPDATE STATIONS (called on favorites-changed)
// ===============================

function updateStations(newStations) {
  console.log("[PLAYER] Updating stations:", newStations);

  // No favorites → stop + clear UI
  if (!newStations || newStations.length === 0) {
    console.warn("[PLAYER] No favorites left → stopping player + clearing UI");
    stopPlayback();
    stations = [];
    destroyCarousel();
    return;
  }

  // Preserve currently “selected” station by name if possible
  const currentIndex = splide ? splide.index : 0;
  const currentStation = stations[currentIndex];
  const stillExists =
    currentStation && newStations.some(s => s.name === currentStation.name);

  stations = newStations;

  // Rebuild the whole carousel safely
  destroyCarousel();
  buildCarousel();

  // If we had a current station and it still exists, snap to it
  if (stillExists) {
    const newIndex = stations.findIndex(s => s.name === currentStation.name);
    console.log("[PLAYER] Restoring current station to index:", newIndex);

    // In loop mode, go() is safe after mount
    splide.go(newIndex);

    // If we were playing, keep playing (after user unlocked audio)
    if (audioUnlocked && isPlaying) {
      playStation(newIndex);
    }
  } else {
    console.warn("[PLAYER] Current station removed → stopping");
    stopPlayback();
  }
}
