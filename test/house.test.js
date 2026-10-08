import { test } from "node:test";
import assert from "node:assert/strict";
import { roomEdges, buildHouse } from "../public/house.js";

const square = [
  [0, 0],
  [4, 0],
  [4, 3],
  [0, 3],
];

function segments(vertices) {
  const result = [];
  for (let i = 0; i < vertices.length; i += 6) result.push(vertices.slice(i, i + 6));
  return result;
}

test("roomEdges draws floor, ceiling and vertical edges for each corner", () => {
  const edges = segments(roomEdges(square, 0, 2.5));
  assert.equal(edges.length, 12);
  assert.deepEqual(edges[0], [0, 0, 0, 4, 0, 0]); // floor
  assert.deepEqual(edges[1], [0, 0, 2.5, 4, 0, 2.5]); // ceiling
  assert.deepEqual(edges[2], [0, 0, 0, 0, 0, 2.5]); // vertical
});

test("roomEdges closes the outline back to the first corner", () => {
  const edges = segments(roomEdges(square, 0, 2.5));
  assert.deepEqual(edges[9], [0, 3, 0, 0, 0, 0]);
  assert.deepEqual(edges[10], [0, 3, 2.5, 0, 0, 2.5]);
});

test("buildHouse centres the floorplan on the origin", () => {
  const floors = [
    {
      name: "Ground",
      bounds: [
        [0, 0, 0],
        [10, 8, 2.5],
      ],
      rooms: [{ name: "Kitchen", points: square }],
    },
    {
      name: "First",
      bounds: [
        [0, 0, 2.5],
        [10, 8, 5],
      ],
      rooms: [
        { name: "Bedroom", points: square },
        { name: "", points: square },
      ],
    },
  ];
  const house = buildHouse(floors);
  assert.deepEqual(house.content.position.toArray(), [-5, -4, -2.5]);
  assert.equal(house.content.children.length, 2, "unnamed room is hidden");
  assert.ok(house.radius > 0);
});
