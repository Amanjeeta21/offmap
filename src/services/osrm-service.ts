import { UserCoordinates } from "@/services/location-service";

export type TravelMode = "walking" | "driving";

export type RouteResult = {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  travelMode: TravelMode;
};

export type TravelLocation = {
  id: string;
  coordinates: UserCoordinates;
};

export type TravelMatrixEntry = {
  from: string;
  to: string;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  travelMode: TravelMode;
};

type OSRMRouteResponse = {
  code: string;
  message?: string;
  routes: {
    distance: number;
    duration: number;
  }[];
};

type OSRMTableResponse = {
  code: string;
  message?: string;
  durations: (number | null)[][];
  distances: (number | null)[][];
};

const OSRM_FOOT_URL = (
  process.env.EXPO_PUBLIC_OSRM_FOOT_URL ||
  "https://routing.openstreetmap.de/routed-foot"
).replace(/\/+$/, "");

const OSRM_CAR_URL = (
  process.env.EXPO_PUBLIC_OSRM_CAR_URL || "https://router.project-osrm.org"
).replace(/\/+$/, "");

const WALKING_THRESHOLD_KM = 5;

function buildCoordinates(locations: TravelLocation[]): string {
  return locations
    .map(
      ({ coordinates }) => `${coordinates.longitude},${coordinates.latitude}`,
    )
    .join(";");
}

async function routingFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Routing server returned HTTP ${response.status}.`);
  }

  return response;
}

function getTravelMode(
  origin: UserCoordinates,
  destination: UserCoordinates,
): TravelMode {
  const earthRadiusKm = 6371;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(destination.latitude - origin.latitude);

  const longitudeDifference = toRadians(
    destination.longitude - origin.longitude,
  );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const straightLineDistance =
    2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return straightLineDistance <= WALKING_THRESHOLD_KM ? "walking" : "driving";
}

function getRoutingBaseUrl(mode: TravelMode): string {
  return mode === "walking" ? OSRM_FOOT_URL : OSRM_CAR_URL;
}

async function requestRoute(
  origin: UserCoordinates,
  destination: UserCoordinates,
  mode: TravelMode,
): Promise<RouteResult> {
  const locations: TravelLocation[] = [
    { id: "origin", coordinates: origin },
    { id: "destination", coordinates: destination },
  ];

  const coordinates = buildCoordinates(locations);
  const baseUrl = getRoutingBaseUrl(mode);

  const url =
    `${baseUrl}/route/v1/driving/${coordinates}` +
    "?overview=false&steps=false";

  const response = await routingFetch(url);
  const data: OSRMRouteResponse = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message ?? `Unable to calculate the ${mode} route.`);
  }

  const route = data.routes[0];

  return {
    distanceMeters: route.distance,
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationSeconds: route.duration,
    durationMinutes: Math.ceil(route.duration / 60),
    travelMode: mode,
  };
}

export async function getRoute(
  origin: UserCoordinates,
  destination: UserCoordinates,
): Promise<RouteResult> {
  const preferredMode = getTravelMode(origin, destination);

  try {
    return await requestRoute(origin, destination, preferredMode);
  } catch (error) {
    const fallbackMode: TravelMode =
      preferredMode === "walking" ? "driving" : "walking";

    try {
      return await requestRoute(origin, destination, fallbackMode);
    } catch {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unable to calculate the route.",
      );
    }
  }
}

async function requestTravelMatrix(
  locations: TravelLocation[],
  mode: TravelMode,
): Promise<TravelMatrixEntry[]> {
  const coordinates = buildCoordinates(locations);
  const baseUrl = getRoutingBaseUrl(mode);

  const url =
    `${baseUrl}/table/v1/driving/${coordinates}` +
    "?annotations=duration,distance";

  const response = await routingFetch(url);
  const data: OSRMTableResponse = await response.json();

  if (data.code !== "Ok") {
    throw new Error(
      data.message ?? `Unable to calculate ${mode} travel times.`,
    );
  }

  const results: TravelMatrixEntry[] = [];

  locations.forEach((fromLocation, fromIndex) => {
    locations.forEach((toLocation, toIndex) => {
      if (fromIndex === toIndex) return;

      const duration = data.durations?.[fromIndex]?.[toIndex];
      const distance = data.distances?.[fromIndex]?.[toIndex];

      if (duration == null || distance == null ||
          !Number.isFinite(duration) || !Number.isFinite(distance) ||
          duration < 0 || distance < 0) return;

      results.push({
        from: fromLocation.id,
        to: toLocation.id,
        distanceMeters: distance,
        distanceKm: Number((distance / 1000).toFixed(2)),
        durationSeconds: duration,
        durationMinutes: Math.ceil(duration / 60),
        travelMode: mode,
      });
    });
  });

  return results;
}

export async function getTravelTimeMatrix(
  locations: TravelLocation[],
): Promise<TravelMatrixEntry[]> {
  if (locations.length < 2) return [];

  const routeKey = (from: string, to: string) => JSON.stringify([from, to]);
  const preferredModes = new Map<string, TravelMode>();
  for (const from of locations) {
    for (const to of locations) {
      if (from.id === to.id) continue;
      preferredModes.set(routeKey(from.id, to.id), getTravelMode(from.coordinates, to.coordinates));
    }
  }

  const routes = new Map<string, TravelMatrixEntry>();
  const modes = [...new Set(preferredModes.values())];
  if (modes.length === 1) modes.push(modes[0] === "walking" ? "driving" : "walking");

  for (const mode of modes) {
    const complete = routes.size === preferredModes.size;
    const needsPreferredMode = [...preferredModes].some(([key, preferred]) =>
      preferred === mode && routes.get(key)?.travelMode !== mode,
    );
    if (complete && !needsPreferredMode) break;

    try {
      const matrix = await requestTravelMatrix(locations, mode);
      for (const route of matrix) {
        const key = routeKey(route.from, route.to);
        if (!routes.has(key) || preferredModes.get(key) === mode) routes.set(key, route);
      }
    } catch {
      // Use the other routing profile when it can supply the missing leg.
    }
  }

  if (!routes.size) {
    throw new Error(
      "Unable to calculate travel times. Please check your internet connection and try again.",
    );
  }

  return [...routes.values()];
}
