const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Fetches /state/config from ESPresense-companion, retrying with backoff
 * until it succeeds. The result includes the MQTT settings and floorplan.
 */
export async function loadCompanionConfig(apiBaseUrl) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/state/config`;
  let delay = 2000;

  for (;;) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json();
      if (!config.mqtt || !Array.isArray(config.floors)) {
        throw new Error("response is missing 'mqtt' or 'floors'");
      }
      return config;
    } catch (error) {
      console.error(`Could not load config from ${url}: ${error.message}. Retrying in ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    }
  }
}
