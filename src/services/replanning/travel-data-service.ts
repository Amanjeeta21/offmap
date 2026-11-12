import { JournalActivity } from "@/context/journal-context";
import { geocodeLocation } from "@/services/geocoding-service";
import {
    getCurrentLocation,
    UserCoordinates,
} from "@/services/location-service";
import { getTravelTimeMatrix, TravelLocation } from "@/services/osrm-service";
import { TravelTimeData } from "@/types/replanning";

export const STARTING_LOCATION_ID = "__current_location__";

export type ResolvedActivityLocation = {
  activityId: string;
  title: string;
  location: string;
  coordinates: UserCoordinates;
};

export type TravelDataResult = {
  currentLocation: UserCoordinates;
  startingLocationId: string;
  resolvedLocations: ResolvedActivityLocation[];
  travelTimes: TravelTimeData[];
};

type ParsedLocation = {
  original: string;
  destination: string;
  routeOrigin?: string;
};

function parseActivityLocation(location: string): ParsedLocation {
  const original = location.trim();

  // Recognize common ways of entering a route between two places.
  const separators = [/\s+to\s+/i, /\s+→\s+/, /\s+->\s+/];

  for (const separator of separators) {
    const parts = original.split(separator);

    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return {
        original,
        routeOrigin: parts[0].trim(),
        destination: parts[1].trim(),
      };
    }
  }

  return {
    original,
    destination: original,
  };
}

export async function getReplanningTravelData(
  activities: JournalActivity[],
): Promise<TravelDataResult> {
  const currentLocation = await getCurrentLocation();

  const activeActivity = activities.find(
    (activity) =>
      !!activity.actualStartAt && !activity.actualEndAt && !activity.completed,
  );

  const pendingActivities = activities.filter(
    (activity) => !activity.completed && !!activity.location.trim(),
  );

  const parsedActivities = pendingActivities.map((activity) => ({
    activity,
    parsed: parseActivityLocation(activity.location),
  }));

  // Collect unique destination and route-origin place names.
  const uniqueLocations = new Set<string>();

  parsedActivities.forEach(({ parsed }) => {
    uniqueLocations.add(parsed.destination);

    if (parsed.routeOrigin) {
      uniqueLocations.add(parsed.routeOrigin);
    }
  });

  const geocodedLocations = new Map<string, UserCoordinates>();

  // Geocode each individual place, never the complete route phrase.
  for (const location of uniqueLocations) {
    const result = await geocodeLocation(location);

    geocodedLocations.set(location, result.coordinates);
  }

  const resolvedLocations: ResolvedActivityLocation[] = parsedActivities.map(
    ({ activity, parsed }) => {
      const coordinates = geocodedLocations.get(parsed.destination);

      if (!coordinates) {
        throw new Error(`Coordinates unavailable for ${parsed.destination}.`);
      }

      return {
        activityId: activity.id,
        title: activity.title,
        location: parsed.original,
        coordinates,
      };
    },
  );

  const activeParsedLocation = activeActivity
    ? parseActivityLocation(activeActivity.location)
    : null;

  const startingLocationId =
    activeParsedLocation?.original || STARTING_LOCATION_ID;

  // Keep the original activity location as an ID so the optimizer
  // can continue matching its existing activity.location value.
  const travelLocations: TravelLocation[] = [
    {
      id: STARTING_LOCATION_ID,
      coordinates: currentLocation,
    },
    ...parsedActivities.map(({ parsed }) => ({
      id: parsed.original,
      coordinates: geocodedLocations.get(parsed.destination)!,
    })),
  ];

  // Add route origins as separate locations when an activity
  // contains a route such as "Assi Ghat to Dashashwamedha Ghat".
  parsedActivities.forEach(({ parsed }) => {
    if (!parsed.routeOrigin) return;

    travelLocations.push({
      id: parsed.routeOrigin,
      coordinates: geocodedLocations.get(parsed.routeOrigin)!,
    });
  });

  // Remove duplicate IDs before requesting the matrix.
  const uniqueTravelLocations = Array.from(
    new Map(travelLocations.map((item) => [item.id, item])).values(),
  );

  const matrix = await getTravelTimeMatrix(uniqueTravelLocations);

  const travelTimes: TravelTimeData[] = matrix.map((entry) => ({
    from: entry.from,
    to: entry.to,
    durationMinutes: entry.durationMinutes,
  }));

  return {
    currentLocation,
    startingLocationId,
    resolvedLocations,
    travelTimes,
  };
}
