import AsyncStorage from "@react-native-async-storage/async-storage";

import { UserCoordinates } from "@/services/location-service";

export type GeocodingResult = {
  name: string;
  coordinates: UserCoordinates;
};

type NominatimResult = {
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
).replace(/\/+$/, "");

const PHOTON_URL = "https://photon.komoot.io/api/";

const CACHE_KEY = "@offmap/geocoding-cache";
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

function getLocationCandidates(location: string): string[] {
  const cleaned = cleanLocation(location);

  const candidates = [location.trim(), cleaned, `${cleaned}, India`];

  return [...new Set(candidates.filter(Boolean))];
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
    countrycodes: "in",
    q: query,
  });

  const response = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    throw new Error("Nominatim rate limit reached.");
  }

  if (!response.ok) {
    throw new Error(`Nominatim returned HTTP ${response.status}.`);
  }

  const data: NominatimResult[] = await response.json();

  if (!data.length) return null;

  return {
    name: data[0].display_name,
    coordinates: {
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon),
    },
  };
}

async function searchPhoton(query: string): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
    lang: "en",
  });

  const response = await fetch(`${PHOTON_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
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
      latitude >= 6 &&
      latitude <= 38 &&
      longitude >= 68 &&
      longitude <= 98
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

async function performGeocoding(location: string): Promise<GeocodingResult> {
  const candidates = getLocationCandidates(location);

  let nominatimError: string | null = null;

  // First try Nominatim's exact and contextual searches.
  for (const candidate of candidates) {
    try {
      const result = await searchNominatim(candidate);

      if (result) {
        await saveCachedLocation(location, result);
        return result;
      }
    } catch (error) {
      nominatimError =
        error instanceof Error ? error.message : "Nominatim failed.";
    }
  }

  // Fall back to Photon for approximate spelling matches.
  for (const candidate of candidates.slice(0, 2)) {
    try {
      const result = await searchPhoton(candidate);

      if (result) {
        await saveCachedLocation(location, result);
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photon failed.";

      throw new Error(
        `Location search failed. ${nominatimError ?? ""} ${message}`.trim(),
      );
    }
  }

  throw new Error(
    `Could not identify "${location}". Try including its nearby landmark or city.`,
  );
}

export async function geocodeLocation(
  location: string,
): Promise<GeocodingResult> {
  const query = location.trim();

  if (!query) {
    throw new Error("Please provide a location to search.");
  }

  const cached = await getCachedLocation(query);

  if (cached) return cached;

  const cleaned = cleanLocation(query);
  const cleanedCache = await getCachedLocation(cleaned);

  if (cleanedCache) {
    await saveCachedLocation(query, cleanedCache);
    return cleanedCache;
  }

  const task = requestQueue.then(() => performGeocoding(query));

  requestQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}
