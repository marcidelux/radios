const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");

let stations = [];
let hls = null;
let isPlaying = false;

function setActiveState(state) {
  document.querySelectorAll(".splide__slide").forEach(slide => {
    slide.classList.remove("playing", "paused");
    slide.classList.add(state);
  });

  const active = document.querySelector(".splide__slide.is-active");

  if (!active) {
    console.warn("No active slide found!");
    return;
  }

  active.classList.add(state);

  console.log("🎨 Active slide state set to:", state);
}

function togglePlayPause() {
  if (isPlaying) {
    console.log("🔴 Pausing playback");

    // Pause audio
    audio.pause();

    // 🚨 IMPORTANT: also stop HLS loading
    if (hls) {
      hls.stopLoad();
    }

    isPlaying = false;
    setActiveState("paused");

  } else {
    console.log("🟢 Resuming playback");

    // Resume HLS if needed
    if (hls) {
      hls.startLoad();
    }

    audio.play().catch(err => {
      console.error("audio.play failed:", err);
    });

    isPlaying = true;
    setActiveState("playing");
  }
}

audio.addEventListener("play", () => {
  isPlaying = true;
  setActiveState("playing");
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  setActiveState("paused");
});

fetch("stations.json")
  .then(response => response.json())
  .then(data => {
    stations = data;

    // Populate carousel slides
    stations.forEach(station => {
      const li = document.createElement("li");
      li.className = "splide__slide";
      li.innerHTML = `<img src="${station.image}" alt="${station.name}" />`;
      stationList.appendChild(li);
    });

    // Initialize Splide
    const splide = new Splide("#radio-splide", {
      perPage: 3,
      focus: "center",
      gap: "2rem",
      pagination: false,
      arrows: false,
      drag: true,
      type: "loop",
    });

    splide.mount();

    stationList.addEventListener("click", (event) => {
      console.log("🖱 CLICK EVENT FIRED");
      console.log("event.target:", event.target);

      // Ignore clicks during animation
      const isMoving = splide.state.is(Splide.STATES.MOVING);
      console.log("splide moving?", isMoving);

      if (isMoving) {
        console.warn("⛔ Ignored click because Splide is moving");
        return;
      }

      const slideEl = event.target.closest(".splide__slide");
      console.log("closest .splide__slide:", slideEl);

      if (!slideEl) {
        console.warn("⛔ Click was NOT on a slide");
        return;
      }

      // Try to resolve Slide object
      const Slide = splide.Components.Slides.get().find(
        s => s.slide === slideEl
      );
      console.log("Resolved Slide object:", Slide);

      if (!Slide) {
        console.error("❌ Could not resolve Slide from element");
        return;
      }

      const targetIndex = Slide.index;
      const currentIndex = splide.index;
      const lastIndex = splide.length - 1;

      console.log("📊 INDEX STATE");
      console.log("currentIndex:", currentIndex);
      console.log("targetIndex :", targetIndex);
      console.log("lastIndex   :", lastIndex);
      console.log("isPlaying   :", isPlaying);

      // CLICK ON ACTIVE SLIDE → TOGGLE PLAY/PAUSE
      if (targetIndex === currentIndex) {
        console.log("🎯 CLICKED ACTIVE (CENTER) SLIDE → toggle");

        if (isPlaying) {
          audio.pause();
          if (hls) hls.stopLoad();
        } else {
          if (hls) hls.startLoad();
          audio.play().catch(() => {});
        }

        return;
      }

      console.log("➡️ CLICKED NON-ACTIVE SLIDE");

      // WRAP CASE: last → first
      if (currentIndex === lastIndex && targetIndex === 0) {
        console.log("🔄 WRAP CASE: last → first → go(+1)");
        splide.go("+1");
        return;
      }

      // WRAP CASE: first → last
      if (currentIndex === 0 && targetIndex === lastIndex) {
        console.log("🔄 WRAP CASE: first → last → go(-1)");
        splide.go("-1");
        return;
      }

      // NORMAL DIRECTION
      if (targetIndex > currentIndex) {
        console.log("➡️ FORWARD MOVE → go(+1)");
        splide.go("+1");
      } else {
        console.log("⬅️ BACKWARD MOVE → go(-1)");
        splide.go("-1");
      }
    });

    // Switch station when center changes
    splide.on("moved", index => {
      playStation(index);
    });

    // Start with first station (will require user gesture)
    playStation(0);
  });

function playStation(index) {
  const streamUrl = stations[index].stream;

  // Stop current audio
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  // Destroy previous HLS instance if exists
  if (hls) {
    hls.destroy();
    hls = null;
  }

  // HLS stream handling (.m3u8)
  if (streamUrl.endsWith(".m3u8")) {
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.play().catch(() => {});
        isPlaying = true;
        setActiveState("playing");
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn("HLS error:", data);
      });

    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      audio.src = streamUrl;
      audio.play().catch(() => {});
      isPlaying = true;
      setActiveState("playing");
    } else {
      console.error("HLS not supported in this browser");
    }
  }
  // Normal MP3 / AAC streams
  else {
    audio.src = streamUrl;
    audio.play().catch(() => {});
    isPlaying = true;
    setActiveState("playing"); 
  }
}