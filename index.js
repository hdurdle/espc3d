import path from "node:path";
import express from "express";
import mqtt from "mqtt";
import { fetchCompanionConfig, loadCompanionConfig } from "./server/config.js";
import { TrackerStore } from "./server/trackers.js";

const PORT = Number(process.env.ESPC3D_PORT) || 3001;
const COMPANION_API = process.env.ESPC3D_API;
const TRACKER_TTL_SECONDS = Number(process.env.ESPC3D_TRACKER_TTL ?? 600);
const CONFIG_REFRESH_SECONDS = Number(process.env.ESPC3D_CONFIG_REFRESH ?? 300);

const BROADCAST_THROTTLE_MS = 1000; // at most one push to browsers per second
const HEARTBEAT_MS = 25_000; // keeps idle streams open through proxies
const PRUNE_INTERVAL_MS = 30_000;
const TRACKER_TOPIC = "espresense/companion/+/attributes";

if (!COMPANION_API) {
  console.error('ESPC3D_API is not set. Example: ESPC3D_API="http://192.168.1.10:8267/api"');
  process.exit(1);
}

const trackers = new TrackerStore(TRACKER_TTL_SECONDS * 1000);
const sseClients = new Set();
let floors = null;
let mqttClient = null;
let mqttSettings = null;

// --- HTTP ---

const app = express();

app.get("/healthz", (req, res) => {
  const healthy = floors !== null && mqttClient?.connected === true;
  res.status(healthy ? 200 : 503).json({ config: floors !== null, mqtt: mqttClient?.connected ?? false });
});

// three.js is served from node_modules so the app works without internet access
app.use("/vendor/three", express.static(path.join(import.meta.dirname, "node_modules", "three")));
app.use(express.static(path.join(import.meta.dirname, "public")));

// Logged after the routes above so health checks and static files don't flood the log
app.use((req, res, next) => {
  console.log(
    new Date().toISOString(),
    req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    req.method,
    req.url,
  );
  next();
});

app.get("/api/floors", (req, res) => {
  if (!floors) return res.status(503).json({ error: "Floorplan not loaded yet" });
  res.json(floors);
});

app.get("/updates", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  sseClients.add(res);
  sendSnapshot(res);
  req.on("close", () => sseClients.delete(res));
});

const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// --- Server-sent events ---

let eventId = 0;
let broadcastTimer = null;

function sendSnapshot(res) {
  res.write(`id: ${++eventId}\ndata: ${JSON.stringify(trackers.snapshot())}\n\n`);
}

function broadcastFloors() {
  const event = `id: ${++eventId}
event: floors
data: ${JSON.stringify(floors)}

`;
  for (const res of sseClients) res.write(event);
}

function scheduleBroadcast() {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    for (const res of sseClients) sendSnapshot(res);
  }, BROADCAST_THROTTLE_MS);
}

const heartbeat = setInterval(() => {
  for (const res of sseClients) res.write(": heartbeat\n\n");
}, HEARTBEAT_MS);

const pruner = setInterval(() => {
  if (trackers.prune()) scheduleBroadcast();
}, PRUNE_INTERVAL_MS);

// --- MQTT ---

function connectMqtt({ host, port, ssl, username, password }) {
  const protocol = ssl ? "mqtts" : "mqtt";
  const url = `${protocol}://${host}:${port || (ssl ? 8883 : 1883)}`;
  const client = mqtt.connect(url, { connectTimeout: 3000, username, password });

  client.on("connect", () => {
    console.log(`Connected to MQTT at ${protocol}://${host}`);
    client.subscribe(TRACKER_TOPIC, (err) => {
      if (err) console.error("MQTT subscribe failed:", err.message);
    });
  });
  client.on("error", (err) => console.error("MQTT error:", err.message || err.code || String(err)));

  // Topic is espresense/companion/<device id>/attributes
  client.on("message", (topic, message) => {
    const name = topic.split("/")[2];
    try {
      trackers.update(name, JSON.parse(message.toString()));
      scheduleBroadcast();
    } catch (error) {
      console.error(`Ignoring malformed message on ${topic}: ${error.message}`);
    }
  });

  return client;
}

// --- Companion config ---

/**
 * Applies a freshly loaded companion config: browsers are sent the new
 * floorplan if it changed, and MQTT reconnects if its settings changed.
 */
function applyConfig(config) {
  if (JSON.stringify(config.floors) !== JSON.stringify(floors)) {
    if (floors) console.log("Floorplan changed, updating browsers");
    floors = config.floors;
    broadcastFloors();
  }
  if (JSON.stringify(config.mqtt) !== JSON.stringify(mqttSettings)) {
    if (mqttSettings) console.log("MQTT settings changed, reconnecting");
    mqttClient?.end();
    mqttSettings = config.mqtt;
    mqttClient = connectMqtt(mqttSettings);
  }
}

let configRefresher = null;
if (CONFIG_REFRESH_SECONDS > 0) {
  configRefresher = setInterval(async () => {
    if (!floors) return; // still waiting for the first load
    try {
      applyConfig(await fetchCompanionConfig(COMPANION_API));
    } catch (error) {
      console.error(`Config refresh failed, keeping current config: ${error.message}`);
    }
  }, CONFIG_REFRESH_SECONDS * 1000);
}

// --- Startup and shutdown ---

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  clearInterval(heartbeat);
  clearInterval(pruner);
  clearInterval(configRefresher);
  clearTimeout(broadcastTimer);
  for (const res of sseClients) res.end();
  mqttClient?.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

applyConfig(await loadCompanionConfig(COMPANION_API));
