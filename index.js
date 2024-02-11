const axios = require("axios").default;
const mqtt = require("mqtt");
const express = require("express");

const app = express();

const port = process.env.ESPC3D_PORT || 3001;
const espCompanionAPI = process.env.ESPC3D_API || "";

var mqttOutput;

var sendInterval = 5000;

var mqttClient;
var espConfig;
var mqttConfig, floorsConfig;

axios.defaults.baseURL = espCompanionAPI;
axios.defaults.headers.post["Content-Type"] = "application/json";

var trackers = {};

async function main() {
  await initConfig();
  initMQTT();
}

main();

// // // //

app.set("view engine", "ejs");

app.get("/", async function (req, res) {
  log(req);
  res.redirect("/index.html");
});

app.get("/api/floors", (req, res) => {
  log(req);

  res.status(200).json(floorsConfig);
});

function sendServerSendEvent(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  var sseId = new Date().toLocaleTimeString();

  setInterval(function () {
    writeServerSendEvent(res, sseId);
  }, sendInterval);

  writeServerSendEvent(res, sseId);
}

function writeServerSendEvent(res, sseId) {
  const data = `data: ${JSON.stringify(trackers)}\n\n`;
  res.write("id: " + sseId + "\n");
  res.write(data);
}
app.get("/updates", (req, res) => {
  log(req);
  if (req.headers.accept && req.headers.accept == "text/event-stream") {
    sendServerSendEvent(req, res);
  }
});

app.use(express.static("public"));

app.listen(port, () => console.log(`Now Listening on port ${port}`));

// // //

function log(req) {
  var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  var isodate = new Date().toISOString();
  console.log(isodate, ip, req.method, req.url);
}

async function initConfig() {
  try {
    espConfig = await axios({ url: "/state/config" });
    espConfig = espConfig.data;
    mqttConfig = espConfig.mqtt;
    floorsConfig = espConfig.floors;
  } catch (error) {
    console.error(error);
  }
}

function initMQTT() {
  const options = {
    connectTimeout: 3000,
    username: mqttConfig.username,
    password: mqttConfig.password,
  };

  const url = "mqtt://" + mqttConfig.host + ":" + mqttConfig.port;

  mqttClient = mqtt.connect(url, options);

  mqttClient.on("connect", () => {
    console.log("Connected to mqtt");
    mqttClient.subscribe("espresense/companion/#", (err) => {
      if (!err) {
        console.log("Subscribed");
      }
    });
  });

  mqttClient.on("message", (topic, message) => {
    if (topic.includes("attributes")) {
      var fields = topic.split("/");
      var trackName = fields[2];

      mqttOutput = JSON.parse(message.toString());
      mqttOutput.name = trackName;

      trackers[trackName] = mqttOutput;
    }
  });
}
