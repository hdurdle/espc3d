import { buildHouse, disposeHouse } from "./house.js";
import { Viewer } from "./scene.js";
import { TrackerLayer } from "./trackers.js";

const status = document.getElementById("status");

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

async function loadFloors() {
  const response = await fetch("/api/floors");
  if (!response.ok) throw new Error(`Floorplan request failed: HTTP ${response.status}`);
  return response.json();
}

/** Owns the current house model, and swaps it out when the floorplan changes. */
class App {
  #house = null;
  #floorsJson = null;

  constructor(viewer) {
    this.viewer = viewer;
    this.trackers = null;
  }

  showFloors(floors) {
    const json = JSON.stringify(floors);
    if (json === this.#floorsJson) return;
    this.#floorsJson = json;

    const previous = this.#house;
    this.#house = buildHouse(floors);
    this.viewer.scene.add(this.#house.root);
    this.viewer.frame(this.#house.radius);

    if (this.trackers) this.trackers.moveTo(this.#house.content);
    else this.trackers = new TrackerLayer(this.#house.content);

    if (previous) {
      this.viewer.scene.remove(previous.root);
      disposeHouse(previous);
    }
  }
}

function subscribeToUpdates(app) {
  const source = new EventSource("/updates");
  let disconnected = false;

  source.onopen = async () => {
    showStatus("");
    // The floorplan may have changed while we were disconnected
    if (disconnected) app.showFloors(await loadFloors());
    disconnected = false;
  };
  source.onmessage = (event) => app.trackers.update(JSON.parse(event.data));
  source.addEventListener("floors", (event) => app.showFloors(JSON.parse(event.data)));
  // EventSource reconnects automatically
  source.onerror = () => {
    disconnected = true;
    showStatus("Lost connection to server, reconnecting…");
  };
}

try {
  const floors = await loadFloors();
  const app = new App(new Viewer(document.body));
  app.showFloors(floors);
  subscribeToUpdates(app);
  app.viewer.start((elapsed) => app.trackers.animate(elapsed));
  showStatus("");
} catch (error) {
  console.error(error);
  showStatus(`Could not load the floorplan: ${error.message}`);
}
