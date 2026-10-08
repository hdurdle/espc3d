// Latest known position of each device, keyed by device id.
export class TrackerStore {
  #trackers = new Map();

  /** @param {number} ttlMs devices not heard from within this time are dropped; 0 keeps them forever */
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
  }

  update(name, attributes, now = Date.now()) {
    this.#trackers.set(name, { ...attributes, name, lastSeen: now });
  }

  /** Removes stale devices. Returns true if anything was removed. */
  prune(now = Date.now()) {
    if (!this.ttlMs) return false;
    let removed = false;
    for (const [name, tracker] of this.#trackers) {
      if (now - tracker.lastSeen > this.ttlMs) {
        this.#trackers.delete(name);
        removed = true;
      }
    }
    return removed;
  }

  /** Plain object of name -> tracker, as sent to the browser. */
  snapshot() {
    return Object.fromEntries(this.#trackers);
  }
}
