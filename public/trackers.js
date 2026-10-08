import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { CONFIG } from "./config.js";

const sphereGeometry = new THREE.SphereGeometry(CONFIG.trackerRadius, 32, 16);
const sphereMaterials = CONFIG.trackerColors.map((color) => new THREE.MeshBasicMaterial({ color }));

/** Glowing, labelled spheres for each tracked device, kept in sync with server snapshots. */
export class TrackerLayer {
  #parent;
  #trackers = new Map(); // device name -> { group, sphere }
  #created = 0;

  /** @param {THREE.Object3D} parent object whose local space is floorplan coordinates */
  constructor(parent) {
    this.#parent = parent;
  }

  /** @param {Record<string, {x: number, y: number, z: number}>} snapshot every device the server knows about */
  update(snapshot) {
    for (const [name, { x, y, z }] of Object.entries(snapshot)) {
      if (![x, y, z].every(Number.isFinite)) continue;
      const tracker = this.#trackers.get(name) ?? this.#create(name);
      tracker.group.position.set(x, y, z);
    }

    for (const [name, tracker] of this.#trackers) {
      if (!(name in snapshot)) {
        this.#parent.remove(tracker.group); // also removes the label element
        this.#trackers.delete(name);
      }
    }
  }

  /** Pulses the spheres between CONFIG.pulse.min and max. */
  animate(elapsedSeconds) {
    const { min, max, periodSeconds } = CONFIG.pulse;
    const wave = (1 + Math.sin((elapsedSeconds * 2 * Math.PI) / periodSeconds)) / 2;
    const scale = min + (max - min) * wave;
    for (const { sphere } of this.#trackers.values()) sphere.scale.setScalar(scale);
  }

  #create(name) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterials[this.#created++ % sphereMaterials.length]);

    const element = document.createElement("div");
    element.className = "tracker-label";
    element.textContent = name;
    const label = new CSS2DObject(element);
    label.position.z = CONFIG.trackerRadius * 2; // just above the sphere (floorplan is Z-up)

    const group = new THREE.Group();
    group.name = name;
    group.add(sphere, label);
    this.#parent.add(group);

    const tracker = { group, sphere };
    this.#trackers.set(name, tracker);
    return tracker;
  }
}
