import type { UserCoordinates } from "@/services/location-service";
import { reverseGeocodeLocation } from "@/services/geocoding-service";

export type NearbyPlace = UserCoordinates & {
  id: number;
  osmType?: string;
  name: string;
  category: string;
  distance: number;
  address?: string;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_URL =
  process.env.EXPO_PUBLIC_OVERPASS_API_URL ||
  "https://overpass-api.de/api/interpreter";

function calculateDistance(origin: UserCoordinates, destination: UserCoordinates): number {
  const radians = Math.PI / 180;
  const deltaLat = (destination.latitude - origin.latitude) * radians;
  const deltaLon = (destination.longitude - origin.longitude) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(origin.latitude * radians) * Math.cos(destination.latitude * radians) *
    Math.sin(deltaLon / 2) ** 2;

  return Math.round(12742000 * Math.asin(Math.sqrt(Math.min(1, a))));
}

const landmarkFilters = [
  '["amenity"~"^(place_of_worship|marketplace|restaurant|cafe|fast_food|bar|pub|theatre|library|townhall|community_centre)$"]',
  '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|artwork|hotel|information)$"]',
  '["historic"]',
  '["leisure"~"^(park|garden|nature_reserve)$"]',
  '["man_made"~"^(ghat|pier|tower|lighthouse|water_well)$"]',
  '["waterway"="ghat"]',
  '["highway"="steps"]["name"~"ghat",i]',
  '["building"~"^(temple|church|mosque|cathedral|synagogue|shrine|palace|train_station|civic)$"]',
  '["shop"~"^(mall|department_store|supermarket)$"]',
];

export async function getNearbyPlaces(
  coordinates: UserCoordinates,
  radius = 5000,
): Promise<NearbyPlace[]> {
  const { latitude, longitude } = coordinates;
  const query = `[out:json][timeout:10];(
    ${landmarkFilters.map((filter) =>
      `nwr(around:${radius},${latitude},${longitude})["name"]${filter};`,
    ).join("\n")}
  );out center;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  let data: { elements?: OverpassElement[]; remark?: string };
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    }).catch(() => {
      throw new Error("Couldn't reach the nearby places service. Check your connection and try again.");
    });
    if (!response.ok) {
      throw new Error(`The nearby places service returned HTTP ${response.status}. Try again shortly.`);
    }
    data = await response.json().catch(() => {
      throw new Error("The nearby places service returned an unreadable response. Try again shortly.");
    });
  } finally {
    clearTimeout(timer);
  }

  if (!Array.isArray(data.elements) || data.remark) {
    throw new Error("The nearby places service could not finish the search. Try again shortly.");
  }

  const places = data.elements.flatMap((element): NearbyPlace[] => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags;
    const name = tags?.name?.trim();
    if (!tags || !name || lat == null || lon == null ||
        !Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];

    const category =
      tags.waterway === "ghat" || tags.man_made === "ghat" || /\bghat\b/i.test(name)
        ? "ghat"
        : tags.amenity === "place_of_worship" && tags.building && tags.building !== "yes"
          ? tags.building
          : tags.amenity ?? tags.tourism ?? tags.historic ?? tags.leisure ??
            tags.man_made ?? tags.building ?? tags.shop ?? "landmark";
    const position = { latitude: lat, longitude: lon };

    return [{
      id: element.id,
      osmType: element.type,
      name,
      category: category.replace(/_/g, " "),
      ...position,
      distance: calculateDistance(coordinates, position),
      address: [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || undefined,
    }];
  }).sort((first, second) => first.distance - second.distance);

  return deduplicatePlaces(places);
}

function deduplicatePlaces(places: NearbyPlace[]) {
  const unique: NearbyPlace[] = [];
  for (const place of places) {
    const duplicate = unique.some((other) =>
      (other.osmType === place.osmType && other.id === place.id) ||
      (other.name.normalize("NFKC").toLowerCase() === place.name.normalize("NFKC").toLowerCase() &&
        calculateDistance(other, place) <= 35),
    );
    if (!duplicate) unique.push(place);
  }
  return unique;
}

export async function searchNearbyPlaces(
  coordinates: UserCoordinates,
  {
    radii = [50, 100, 200],
    excludedNames,
    minimumResults = 3,
    requests,
  }: {
    radii?: number[];
    excludedNames?: ReadonlySet<string>;
    minimumResults?: number;
    requests?: Map<string, Promise<NearbyPlace[]>>;
  } = {},
) {
  const found = new Map<string, NearbyPlace>();
  let searchError: string | undefined;

  for (const radius of radii) {
    try {
      const key = `${coordinates.latitude},${coordinates.longitude},${radius}`;
      const request = requests?.get(key) ?? getNearbyPlaces(coordinates, radius);
      requests?.set(key, request);
      const places = await request;
      for (const place of places) {
        if (place.distance > radius || excludedNames?.has(place.name.trim().toLowerCase())) continue;
        found.set(`${place.osmType}/${place.id}`, place);
      }
      if (deduplicatePlaces([...found.values()]).length >= minimumResults) break;
    } catch (error) {
      searchError = error instanceof Error ? error.message : "Nearby places are temporarily unavailable.";
      break;
    }
  }

  const places = deduplicatePlaces(
    [...found.values()].sort((first, second) => first.distance - second.distance),
  );
  return { places, searchError };
}

export async function findNearbyLandmarks(coordinates: UserCoordinates) {
  const { places, searchError } = await searchNearbyPlaces(coordinates);
  if (places.length) return { places, message: searchError, hasMapData: true };

  const area = await reverseGeocodeLocation(coordinates).catch(() => null);
  const message = searchError ?? "No named landmarks were found within 200 m.";
  return {
    places,
    hasMapData: Boolean(area),
    message: area
      ? `${message} Your approximate area is ${area}. You can save the activity without a landmark or retry.`
      : `${message} You can save the activity without a landmark or retry.`,
  };
}
