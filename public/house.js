import * as THREE from "three";
import { CONFIG } from "./config.js";

/**
 * Line-segment vertices for a room's wireframe: the floor outline, the ceiling
 * outline and a vertical edge at each corner. Returns a flat [x, y, z, ...]
 * array where each pair of vertices is one segment.
 *
 * @param {number[][]} points room corners as [x, y]
 * @param {number} base floor height
 * @param {number} ceiling ceiling height
 */
export function roomEdges(points, base, ceiling) {
  const vertices = [];
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    vertices.push(x, y, base, nextX, nextY, base);
    vertices.push(x, y, ceiling, nextX, nextY, ceiling);
    vertices.push(x, y, base, x, y, ceiling);
  });
  return vertices;
}

/**
 * Builds the house wireframe from the companion's floors config.
 *
 * The floorplan is Z-up; three.js is Y-up. `root` handles that rotation and
 * centres the house on the origin. Anything positioned in floorplan
 * coordinates (such as trackers) should be added to `content`.
 */
export function buildHouse(floors) {
  const content = new THREE.Group();
  const bounds = new THREE.Box3();

  floors.forEach((floor, floorIndex) => {
    const [min, max] = floor.bounds;
    bounds.expandByPoint(new THREE.Vector3(...min));
    bounds.expandByPoint(new THREE.Vector3(...max));

    const color = CONFIG.floorColors[floorIndex % CONFIG.floorColors.length];
    const material = new THREE.LineBasicMaterial({ color });

    for (const room of floor.rooms) {
      if (CONFIG.hideUnnamedRooms && !room.name) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(roomEdges(room.points, min[2], max[2]), 3));
      const lines = new THREE.LineSegments(geometry, material);
      lines.name = room.name;
      content.add(lines);
    }
  });

  content.position.copy(bounds.getCenter(new THREE.Vector3()).negate());

  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  root.add(content);

  return { root, content, radius: bounds.getBoundingSphere(new THREE.Sphere()).radius };
}

/** Frees the GPU resources of a house from buildHouse. Move any trackers out of it first. */
export function disposeHouse(house) {
  house.root.traverse((object) => {
    if (object.isLineSegments) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
}
