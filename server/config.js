const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Fetches /state/config from ESPresense-companion once. The result includes
 * the MQTT settings and floorplan. Throws if the API is unreachable or the
 * response doesn't look like a companion config.
 */
export async function fetchCompanionConfig(apiBaseUrl) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/state/config`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((error) => {
    throw new Error(`could not reach ${url}: ${error.message}`);
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const config = await response.json();
  if (!config.mqtt || !Array.isArray(config.floors)) {
    throw new Error(`${url} response is missing 'mqtt' or 'floors'`);
  }
  return config;
}

/** Like fetchCompanionConfig, but retries with backoff until it succeeds. */
export async function loadCompanionConfig(apiBaseUrl) {
  let delay = 2000;
  for (;;) {
    try {
      return await fetchCompanionConfig(apiBaseUrl);
    } catch (error) {
      console.error(`Could not load companion config: ${error.message}. Retrying in ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    }
  }
}
