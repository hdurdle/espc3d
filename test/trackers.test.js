import { test } from "node:test";
import assert from "node:assert/strict";
import { TrackerStore } from "../server/trackers.js";

test("snapshot includes name and lastSeen", () => {
  const store = new TrackerStore(1000);
  store.update("phone", { x: 1, y: 2, z: 3 }, 500);
  assert.deepEqual(store.snapshot(), { phone: { x: 1, y: 2, z: 3, name: "phone", lastSeen: 500 } });
});

test("prune drops devices older than the TTL", () => {
  const store = new TrackerStore(1000);
  store.update("old", { x: 0, y: 0, z: 0 }, 0);
  store.update("new", { x: 0, y: 0, z: 0 }, 900);
  assert.equal(store.prune(1500), true);
  assert.deepEqual(Object.keys(store.snapshot()), ["new"]);
  assert.equal(store.prune(1500), false);
});

test("a TTL of 0 keeps devices forever", () => {
  const store = new TrackerStore(0);
  store.update("phone", { x: 0, y: 0, z: 0 }, 0);
  assert.equal(store.prune(Number.MAX_SAFE_INTEGER), false);
  assert.equal(Object.keys(store.snapshot()).length, 1);
});
