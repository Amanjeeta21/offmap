import type {
  ReplanningActivity,
  ReplanningResult,
  TripReplanningDay,
  TripReplanningResult,
} from "@/types/replanning";

import type { geocodeLocation } from "@/services/geocoding-service";
import { getCurrentLocation, type UserCoordinates } from "@/services/location-service";
import { getTravelTimeMatrix } from "@/services/osrm-service";
import { searchNearbyPlaces, type NearbyPlace } from "@/services/overpass-service";
import { getNearbyAlternatives } from "./alternative-place-service";
import { optimizeItinerary } from "./itinerary-optimizer";
import { getActivityRouteLocation, optimizeTripItinerary } from "./trip-optimizer";
import {
  getDayTravelData,
  getReplanningTravelData,
  STARTING_LOCATION_ID,
} from "./travel-data-service";

export type ReplanTripParams = {
  activities: ReplanningActivity[];
  currentTime: string;
  returnDeadline: string;
  returnLocation: string;
};

export async function replanTrip(
  params: ReplanTripParams,
): Promise<ReplanningResult> {
  const { activities, currentTime, returnDeadline, returnLocation } = params;

  if (!returnLocation.trim()) {
    throw new Error(
      "Please provide your accommodation location before replanning.",
    );
  }

  // Step 1: Retrieve GPS coordinates, activity coordinates,
  // and the road travel-time matrix.
  const travelData = await getReplanningTravelData(activities);

  // Step 2: Identify the active activity, if any.
  const activeActivity = activities.find(
    (activity) =>
      !!activity.actualStartAt && !activity.actualEndAt && !activity.completed,
  );

  // When an activity is running, use its location as the
  // starting point for finding nearby alternatives.
  const activeLocation = activeActivity
    ? travelData.resolvedLocations.find(
        (item) => item.activityId === activeActivity.id,
      )
    : undefined;

  const alternativeStartingLocation =
    activeLocation?.coordinates ?? travelData.currentLocation;

  // Step 3: Collect existing itinerary locations.
  const excludedLocations = activities
    .map((activity) => activity.location.trim())
    .filter(Boolean);

  // Include all activity destinations and accommodation
  // so alternatives can be evaluated against onward journeys.
  const destinationLocations = [
    ...new Set([
      ...activities.map((activity) => activity.location.trim()).filter(Boolean),
      returnLocation.trim(),
    ]),
  ];

  // Step 4: Find nearby alternatives for flexible activities.
  let nearbyAlternatives: Awaited<ReturnType<typeof getNearbyAlternatives>> =
    [];

  const hasFlexibleActivities = activities.some(
    (activity) =>
      !activity.completed &&
      activity.priority !== "High" &&
      activity.isFixed !== true,
  );

  let alternativeWarning: string | null = null;

  if (hasFlexibleActivities) {
    try {
      nearbyAlternatives = await getNearbyAlternatives(
        alternativeStartingLocation,
        excludedLocations,
        destinationLocations,
      );
    } catch {
      // Alternative discovery is optional.
      // A failure must not prevent the main optimizer from running.
      alternativeWarning =
        "Nearby alternatives could not be loaded. The itinerary was evaluated using its existing activities.";
    }
  }

  // Step 5: Run the deterministic itinerary optimizer.
  const result = optimizeItinerary({
    activities,
    travelTimes: travelData.travelTimes,
    startingLocationId: travelData.startingLocationId,
    nearbyAlternatives,
    currentTime,
    returnDeadline,
    returnLocation: returnLocation.trim(),
  });

  // Step 6: Include any optional alternative-discovery warning.
  if (alternativeWarning) {
    result.warnings.push(alternativeWarning);
  }

  return result;
}

export type ReplanJournalTripParams = {
  days: TripReplanningDay[];
  currentDate: string;
  currentTime: string;
  returnLocation: string;
  destination: string;
};

export async function replanJournalTrip(
  params: ReplanJournalTripParams,
): Promise<TripReplanningResult> {
  const returnLocation = params.returnLocation.trim();
  const activeDays = params.days.filter((day) =>
    day.date >= params.currentDate && day.activities.some((activity) => !activity.completed),
  );
  const warnings: string[] = [];
  let currentLocation: UserCoordinates | undefined;
  if (activeDays.some((day) => day.date === params.currentDate)) {
    try {
      const position = await getCurrentLocation();
      if (position.accuracy === null || position.accuracy > 200) {
        warnings.push("GPS accuracy was too low. Today uses the planned starting point.");
      } else {
        currentLocation = position;
      }
    } catch (error) {
      warnings.push(error instanceof Error
        ? `Today uses the planned starting point. ${error.message}`
        : "GPS is unavailable. Today uses the planned starting point.");
    }
  }

  const travelDataByDay: Record<string, Awaited<ReturnType<typeof getDayTravelData>>> = Object.create(null);
  const geocodingRequests = new Map<string, ReturnType<typeof geocodeLocation>>();
  function loadDay(day: TripReplanningDay) {
    return getDayTravelData(day.activities.filter((activity) => !activity.completed), {
      currentLocation: day.date === params.currentDate ? currentLocation : undefined,
      additionalLocations: [returnLocation],
      area: params.destination,
      geocodingRequests,
    });
  }

  for (const day of activeDays) {
    travelDataByDay[day.id] = await loadDay(day);
  }

  const plan = (days: TripReplanningDay[], data = travelDataByDay) =>
    optimizeTripItinerary({
      days,
      travelTimes: [],
      dayTravelData: data,
      startingLocationId: currentLocation ? STARTING_LOCATION_ID : undefined,
      currentDate: params.currentDate,
      currentTime: params.currentTime,
      returnLocation,
    });

  let planningDays = [...params.days].sort((first, second) => first.date.localeCompare(second.date));
  let result = plan(planningDays);
  const movedFrom = new Map<ReplanningActivity, TripReplanningDay>();
  // Move flexible visits only when the source and every destination day remain feasible.
  for (let index = 0; index < planningDays.length; index += 1) {
    const source = planningDays[index];
    const sourcePreview = result.days.find((day) => day.id === source.id);
    const movable = sourcePreview?.activities
      .filter((item) => item.canMoveToLaterDay && getActivityRouteLocation(item.activity))
      .map((item) => item.activity)
      .sort((first, second) => Number(second.priority === "Medium") - Number(first.priority === "Medium"));
    if (!movable?.length) continue;
    const sourceWithoutMoves = {
      ...source,
      activities: source.activities.filter((activity) => !movable.includes(activity)),
    };
    if (!plan([sourceWithoutMoves]).isFeasible) continue;

    const targets = planningDays.filter((target) => target.date > source.date &&
      result.days.find((day) => day.id === target.id)?.isFeasible);
    const destinations = new Map<string, {
      day: TripReplanningDay;
      data: Awaited<ReturnType<typeof getDayTravelData>>;
    }>();
    let placed = 0;
    for (const [moveIndex, activity] of movable.entries()) {
      for (const target of targets) {
        const current = destinations.get(target.id)?.day ?? target;
        const candidate = { ...current, activities: [...current.activities, activity] };
        const data = await loadDay(candidate);
        if (!plan([candidate], { [target.id]: data }).isFeasible) continue;
        destinations.set(target.id, { day: candidate, data });
        placed += 1;
        break;
      }
      if (placed === moveIndex) break;
    }
    if (placed !== movable.length) continue;

    planningDays = planningDays.map((day) => day.id === source.id
      ? sourceWithoutMoves
      : destinations.get(day.id)?.day ?? day);
    for (const [dayId, { data }] of destinations) travelDataByDay[dayId] = data;
    for (const activity of movable) movedFrom.set(activity, source);
    result = plan(planningDays);
  }

  for (const day of result.days) {
    for (const item of day.activities) {
      const source = movedFrom.get(item.activity);
      if (!source) continue;
      item.originalDate = source.date;
      item.reason = `Moved from ${source.title} to fit the daily schedule.`;
      const existing = result.changes.find((change) =>
        change.proposedDayId === day.id && change.activityId === item.activity.id,
      );
      const sourceDetails = { originalDayId: source.id, originalDate: source.date, reason: item.reason };
      if (existing) {
        Object.assign(existing, sourceDetails);
      } else {
        result.changes.push({
          ...sourceDetails,
          activityId: item.activity.id,
          title: item.activity.title,
          priority: item.activity.priority,
          originalTime: item.activity.time,
          proposedDayId: day.id,
          proposedDate: day.date,
          proposedTime: item.proposedTime,
        });
      }
    }
  }

  if (movedFrom.size && result.changes.length) {
    result.explanation = "Review the proposed changes for your trip.";
  }
  result.warnings.push(...warnings);

  const nearbyRequests = new Map<string, Promise<NearbyPlace[]>>();
  for (const day of result.days) {
    if (!day.activities.some((item) => item.status === "unscheduled")) continue;
    const data = travelDataByDay[day.id];
    const plannedDay = planningDays.find((candidate) => candidate.id === day.id);
    if (!data || !plannedDay) continue;
    const origin = data.startingCoordinates.get(STARTING_LOCATION_ID) ??
      data.startingCoordinates.get(returnLocation) ??
      (data.startingLocationId ? data.startingCoordinates.get(data.startingLocationId) : undefined);
    if (!origin) {
      day.warnings.push("Nearby alternatives need a GPS position or a mapped starting point.");
      continue;
    }
    try {
      const excluded = new Set(plannedDay.activities.flatMap(({ location, plannedAlternative }) =>
        [location, plannedAlternative?.name ?? ""].map((name) => name.trim().toLowerCase()),
      ));
      const { places, searchError } = await searchNearbyPlaces(origin.coordinates, {
        radii: [50, 100, 200, 400],
        excludedNames: excluded,
        minimumResults: 8,
        requests: nearbyRequests,
      });
      if (!places.length) {
        day.warnings.push(searchError ?? "No named alternatives were found within 400 m.");
        continue;
      }
      const candidates = places.slice(0, 8);
      const routes = new Map(data.startingCoordinates);
      for (const place of candidates) {
        const id = getActivityRouteLocation({ plannedAlternative: place });
        routes.set(id, { id, coordinates: place });
      }
      const travelTimes = await getTravelTimeMatrix([...routes.values()]);
      day.alternatives = day.activities
        .filter((item) => item.canMoveToLaterDay)
        .flatMap(({ activity }) => candidates.flatMap((place) => {
          const changedDay = {
            ...plannedDay,
            activities: plannedDay.activities.map((item) => item === activity
              ? { ...item, plannedAlternative: place }
              : item),
          };
          const [itinerary] = plan([changedDay], { [day.id]: { ...data, travelTimes } }).days;
          return itinerary.isFeasible ? [{ activityId: activity.id, place, itinerary }] : [];
        }));
      if (!day.alternatives.length) {
        day.warnings.push("The nearby places found could not fit the remaining schedule and travel time.");
      }
    } catch {
      day.warnings.push("Nearby alternatives are temporarily unavailable.");
    }
  }
  return result;
}
