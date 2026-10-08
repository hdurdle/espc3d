# ESPresense-companion 3D

This app pulls data from the excellent [ESPresense-companion](https://github.com/ESPresense/ESPresense-companion) and renders a fully rotatable, zoomable 3D model of your floorplan, with a labelled sphere for each tracked device.

https://github.com/hdurdle/espc3d/assets/4083861/1ccdaf76-23c7-48ed-a2d3-bef51fb2ff82

I'd never looked at Threejs before this, so you'll forgive my exuberant bloom settings!

## How it works

The Node server loads the config from the ESPresense-companion API. That config includes the MQTT server and credentials, plus your floorplan with floor heights. The server:

- serves the floorplan to the browser at `/api/floors`, which builds the 3D model from it
- subscribes to `espresense/companion/+/attributes` on MQTT to receive device positions
- pushes the latest positions to the browser over server-sent events (`/updates`), at most once a second
- drops devices that haven't reported for `ESPC3D_TRACKER_TTL` seconds

### A note on credentials

My first version of this ran entirely in the browser and used websockets to get the MQTT data. That meant the MQTT credentials were available in the clear in the web app, since they can be retrieved from the companion API. This version keeps the API and MQTT connections on the server, so the browser only receives the floorplan and device positions.

## How to run

### Environment variables

| Variable             | Default  | Description                                                                                   |
| -------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `ESPC3D_API`         | required | Full URL of the ESPresense-companion API, e.g. `http://192.168.1.10:8267/api`                 |
| `ESPC3D_PORT`        | `3001`   | Port to listen on                                                                             |
| `ESPC3D_TRACKER_TTL` | `600`    | Seconds without an update before a device is removed from the view. `0` keeps devices forever |

If you run ESPresense-companion in Docker, its API is on port 8267. I don't run it as an HA add-on so can't speak to connecting to that.

### Node

Requires Node 20.11 or later.

```sh
npm install
ESPC3D_API="http://<ip>:8267/api" npm start
```

Then open `http://localhost:3001`.

### Docker

Copy the repo to a directory and add this to your `docker-compose.yaml`. `context` should point to the directory containing the Dockerfile.

```yaml
services:
  espc3d:
    build:
      context: "./espc3d/"
    container_name: espc3d
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      ESPC3D_API: "http://<ip>:8267/api"
```

The container has a health check on `/healthz`, which reports healthy once the config is loaded and MQTT is connected.

## Customising the view

Colours, bloom, tracker size, camera angle and rotation speed are all in [`public/config.js`](public/config.js).

The view is built from the `floors` section of the companion config. Each floor needs `bounds` (`[[minX, minY, floorZ], [maxX, maxY, ceilingZ]]`) and a list of `rooms`, each with a `name` and `points` (`[[x, y], ...]`). Rooms without a name are hidden unless you set `hideUnnamedRooms: false`.

## Development

```sh
npm test        # unit tests
npm run lint    # ESLint
npm run format  # Prettier
```

| Path                 | Contents                                                  |
| -------------------- | --------------------------------------------------------- |
| `index.js`           | Server entry point: HTTP routes, MQTT, server-sent events |
| `server/config.js`   | Loads the companion config, with retry                    |
| `server/trackers.js` | Store of latest device positions                          |
| `public/main.js`     | Browser entry point                                       |
| `public/scene.js`    | Renderer, camera, controls and bloom                      |
| `public/house.js`    | Builds the floorplan wireframe                            |
| `public/trackers.js` | Device spheres and labels                                 |

three.js is served from `node_modules`, so the browser doesn't need internet access.
