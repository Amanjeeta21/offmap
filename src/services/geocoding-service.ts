import AsyncStorage from "@react-native-async-storage/async-storage";

import type { UserCoordinates } from "@/services/location-service";

export type GeocodingResult = {
  name: string;
  coordinates: UserCoordinates;
};

type NominatimResult = {
  error?: string;
  lat: string;
  lon: string;
  display_name: string;
};

type PhotonFeature = {
  type: "Feature";
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    name?: string;
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
};

type PhotonResponse = {
  features: PhotonFeature[];
};

const NOMINATIM_URL = (
  process.env.EXPO_PUBLIC_NOMINATIM_API_URL ||
  "https://nominatim.openstreetmap.org"
).replace(/\/(?:search|reverse)\/?$|\/+$/, "");

const PHOTON_URL = (
  process.env.EXPO_PUBLIC_PHOTON_API_URL ||
  "https://photon.komoot.io/api/"
).replace(/(?:\/api)?\/*$/, "/api/");

const GEOCODING_HEADERS = {
  Accept: "application/json",
  "User-Agent": "OFFMAP mobile app",
};

const CACHE_KEY = "@offmap/geocoding-cache-v2";
const REQUEST_INTERVAL = 1100;

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestTime = 0;

function cleanLocation(location: string): string {
  return location
    .trim()
    .replace(/^(around|near|nearby|close to|at|in|opposite)\s+/i, "")
    .replace(/\s+(area|locality|neighborhood|neighbourhood)$/i, "")
    .replace(/[.,]+$/, "")
    .trim();
}

function getLocationCandidates(location: string, area: string): string[] {
  const cleaned = cleanLocation(location);

  const candidates = [area && `${cleaned}, ${area}`, location.trim(), cleaned];

  return [...new Set(candidates.filter(Boolean))];
}

function isProviderUnavailable(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError" ||
        /HTTP (401|403|429|5\d\d)\b/.test(error.message)));
}

async function getCachedLocation(
  query: string,
): Promise<GeocodingResult | null> {
  try {
    const storedCache = await AsyncStorage.getItem(CACHE_KEY);

    if (!storedCache) return null;

    const cache: Record<string, GeocodingResult> = JSON.parse(storedCache);

    return cache[query.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

async function saveCachedLocation(
  query: string,
  result: GeocodingResult,
): Promise<void> {
  try {
    const storedCache = await AsyncStorage.getItem(CACHE_KEY);

    const cache: Record<string, GeocodingResult> = storedCache
      ? JSON.parse(storedCache)
      : {};

    cache[query.toLowerCase()] = result;

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Caching failure should not prevent geocoding.
  }
}

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;

  if (elapsed < REQUEST_INTERVAL) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, REQUEST_INTERVAL - elapsed),
    );
  }

  lastRequestTime = Date.now();
}

async function searchNominatim(query: string): Promise<GeocodingResult | null> {
  await waitForRateLimit();

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: query,
  });

  const response = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
    headers: GEOCODING_HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned HTTP ${response.status}.`);
  }

  const data: NominatimResult[] = await response.json();

  const match = Array.isArray(data) ? data[0] : undefined;
  if (!match?.lat || !match.lon) return null;
  const latitude = Number(match.lat);
  const longitude = Number(match.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    name: match.display_name,
    coordinates: { latitude, longitude },
  };
}

async function searchPhoton(query: string): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
  });

  const response = await fetch(`${PHOTON_URL}?${params.toString()}`, {
    headers: GEOCODING_HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Photon returned HTTP ${response.status}.`);
  }

  const data: PhotonResponse = await response.json();

  const feature = data.features?.find((item) => {
    const coordinates = item.geometry?.coordinates;

    if (!coordinates || coordinates.length !== 2) return false;

    const [longitude, latitude] = coordinates;

    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    );
  });

  if (!feature) return null;

  const properties = feature.properties;
  const [longitude, latitude] = feature.geometry.coordinates;

  return {
    name: [
      properties.name,
      properties.street,
      properties.city,
      properties.district,
      properties.state,
      properties.country,
    ]
      .filter(Boolean)
      .join(", "),
    coordinates: {
      latitude,
      longitude,
    },
  };
}

async function performGeocoding(location: string, area: string, cacheKey: string): Promise<GeocodingResult> {
  const candidates = getLocationCandidates(location, area);

  let nominatimError: string | null = null;

  // First try Nominatim's exact and contextual searches.
  for (const candidate of candidates) {
    try {
      const result = await searchNominatim(candidate);

      if (result) {
        await saveCachedLocation(cacheKey, result);
        return result;
      }
    } catch (error) {
      nominatimError =
        error instanceof Error ? error.message : "Nominatim failed.";

      if (isProviderUnavailable(error)) break;
    }
  }

  // Fall back to Photon for approximate spelling matches.
  for (const candidate of candidates.slice(0, 2)) {
    try {
      const result = await searchPhoton(candidate);

      if (result) {
        await saveCachedLocation(cacheKey, result);
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photon failed.";

      throw new Error(
        `Location search failed. ${nominatimError ?? ""} ${message}`.trim(),
      );
    }
  }

  if (nominatimError) {
    throw new Error(`Location search failed. ${nominatimError}`);
  }

  throw new Error(
    `Could not identify "${location}". It may be missing from the map data.`,
  );
}

export async function geocodeLocation(
  location: string,
  area = "",
): Promise<GeocodingResult> {
  const query = location.trim();

  if (!query) {
    throw new Error("Please provide a location to search.");
  }

  const cacheKey = JSON.stringify([query, area]);
  const cached = await getCachedLocation(cacheKey);

  if (cached) return cached;

  const task = requestQueue.then(async () =>
    (await getCachedLocation(cacheKey)) ?? performGeocoding(query, area, cacheKey),
  );

  requestQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export function reverseGeocodeLocation(coordinates: UserCoordinates): Promise<string | null> {
  const lat = coordinates.latitude.toFixed(4);
  const lon = coordinates.longitude.toFixed(4);
  const key = `reverse:${lat},${lon}`;
  const task = requestQueue.then(async () => {
    const cached = await getCachedLocation(key);
    if (cached) return cached.name;
    await waitForRateLimit();
    const params = new URLSearchParams({ lat, lon, format: "jsonv2", zoom: "17" });
    const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: GEOCODING_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Area lookup returned HTTP ${response.status}.`);
    const result: NominatimResult = await response.json();
    if (!result.display_name || result.error) return null;
    await saveCachedLocation(key, { name: result.display_name, coordinates });
    return result.display_name;
  });
  requestQueue = task.then(() => undefined, () => undefined);
  return task;
}
