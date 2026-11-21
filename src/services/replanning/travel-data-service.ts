import type { JournalActivity } from "@/context/journal-context";
import { geocodeLocation } from "@/services/geocoding-service";
import { getCurrentLocation, type UserCoordinates } from "@/services/location-service";
import { getTravelTimeMatrix, type TravelLocation } from "@/services/osrm-service";
import type { TravelTimeData } from "@/types/replanning";

export const STARTING_LOCATION_ID = "__current_location__";

type ResolvedActivityLocation = {
  activityId: string;
  title: string;
  location: string;
  coordinates: UserCoordinates;
};

type TravelOptions = {
  currentLocation?: UserCoordinates;
  additionalLocations?: string[];
  area?: string;
  strict?: boolean;
  geocodingRequests?: Map<string, ReturnType<typeof geocodeLocation>>;
};

function parseActivityLocation(location: string) {
  const original = location.trim();
  const parts = original.split(/\s+(?:to|\u2192|->)\s+/i).map((part) => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { original, destination: parts[1], routeOrigin: parts[0] };
  }
  return { original, destination: original };
}

export async function getDayTravelData(
  activities: JournalActivity[],
  options: TravelOptions,
) {
  const warnings: string[] = [];
  const resolvedLocations: ResolvedActivityLocation[] = [];
  const routeOrigins: Record<string, string> = Object.create(null);
  const travelLocations = new Map<string, TravelLocation>();
  const requests = options.geocodingRequests ?? new Map<string, ReturnType<typeof geocodeLocation>>();
  const resolve = async (name: string) => {
    const key = name.toLowerCase();
    let request = requests.get(key);
    if (!request) {
      request = geocodeLocation(name, options.area);
      requests.set(key, request);
    }
    try {
      return (await request).coordinates;
    } catch (error) {
      if (options.strict) throw error;
      const reason = error instanceof Error ? error.message : "Location lookup failed.";
      const warning = `Couldn't locate "${name}". ${reason}`;
      if (!warnings.includes(warning)) warnings.push(warning);
      return undefined;
    }
  };

  if (options.currentLocation) {
    travelLocations.set(STARTING_LOCATION_ID, {
      id: STARTING_LOCATION_ID,
      coordinates: options.currentLocation,
    });
  }

  for (const activity of activities) {
    const { original, destination, routeOrigin } = parseActivityLocation(activity.location);
    if (!destination) continue;
    const coordinates = await resolve(destination);
    if (coordinates) {
      travelLocations.set(original, { id: original, coordinates });
      resolvedLocations.push({
        activityId: activity.id,
        title: activity.title,
        location: original,
        coordinates,
      });
    }
    if (routeOrigin) {
      routeOrigins[original] = routeOrigin;
      const originCoordinates = await resolve(routeOrigin);
      if (originCoordinates) {
        travelLocations.set(routeOrigin, { id: routeOrigin, coordinates: originCoordinates });
      }
    }
  }

  for (const id of options.additionalLocations ?? []) {
    if (!id || travelLocations.has(id)) continue;
    const coordinates = await resolve(id);
    if (coordinates) travelLocations.set(id, { id, coordinates });
  }

  let travelTimes: TravelTimeData[] = [];
  try {
    travelTimes = await getTravelTimeMatrix([...travelLocations.values()]);
  } catch (error) {
    if (options.strict) throw error;
    warnings.push("The routing service could not calculate travel times for this day. Try again shortly.");
  }

  return {
    resolvedLocations,
    travelTimes,
    routeOrigins,
    warnings,
    startingCoordinates: travelLocations,
  };
}

export async function getReplanningTravelData(
  activities: JournalActivity[],
  additionalLocations: string[] = [],
) {
  const currentLocation = await getCurrentLocation();
  const active = activities.find((activity) =>
    activity.actualStartAt && !activity.actualEndAt && !activity.completed,
  );
  const data = await getDayTravelData(activities.filter((activity) => !activity.completed), {
    currentLocation,
    additionalLocations,
    strict: true,
  });

  return {
    ...data,
    currentLocation,
    startingLocationId: active?.location.trim() || STARTING_LOCATION_ID,
  };
}
