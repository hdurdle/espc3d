import { buildHouse } from "./house.js";
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

function subscribeToUpdates(trackers) {
  const source = new EventSource("/updates");
  source.onopen = () => showStatus("");
  source.onmessage = (event) => trackers.update(JSON.parse(event.data));
  // EventSource reconnects automatically
  source.onerror = () => showStatus("Lost connection to server, reconnecting…");
}

try {
  const floors = await loadFloors();
  const viewer = new Viewer(document.body);
  const house = buildHouse(floors);
  viewer.scene.add(house.root);
  viewer.frame(house.radius);

  const trackers = new TrackerLayer(house.content);
  subscribeToUpdates(trackers);
  viewer.start((elapsed) => trackers.animate(elapsed));
  showStatus("");
} catch (error) {
  console.error(error);
  showStatus(`Could not load the floorplan: ${error.message}`);
}
