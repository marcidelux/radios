const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");

let stations = [];
let hls = null;

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

    // Switch station when center changes
    splide.on("moved", index => {
      playStation(index);
    });

    // Start with first station (will require user gesture)
    playStation(0);

    // Click anywhere on carousel to resume if paused
    document
      .getElementById("radio-splide")
      .addEventListener("click", () => {
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      });
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
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn("HLS error:", data);
      });

    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      audio.src = streamUrl;
      audio.play().catch(() => {});
    } else {
      console.error("HLS not supported in this browser");
    }
  }
  // Normal MP3 / AAC streams
  else {
    audio.src = streamUrl;
    audio.play().catch(() => {});
  }
}
