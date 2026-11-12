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

      if (duration == null || distance == null) return;

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

  const results: TravelMatrixEntry[] = [];

  // Request walking routes first.
  try {
    const walkingResults = await requestTravelMatrix(locations, "walking");

    results.push(...walkingResults);
  } catch {
    // Walking routing may be temporarily unavailable.
  }

  // Fill missing routes using driving data.
  const existingRoutes = new Set(
    results.map((entry) => `${entry.from}->${entry.to}`),
  );

  const missingRoutes = locations.length * (locations.length - 1);

  if (results.length < missingRoutes) {
    try {
      const drivingResults = await requestTravelMatrix(locations, "driving");

      drivingResults.forEach((entry) => {
        const key = `${entry.from}->${entry.to}`;

        if (!existingRoutes.has(key)) {
          results.push(entry);
          existingRoutes.add(key);
        }
      });
    } catch {
      // Retain all successfully calculated walking routes.
    }
  }

  if (results.length === 0) {
    throw new Error(
      "Unable to calculate travel times. Please check your internet connection and try again.",
    );
  }

  return results;
}
