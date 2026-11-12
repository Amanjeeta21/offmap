import { ReplanningActivity, ReplanningResult } from "@/types/replanning";

import { getNearbyAlternatives } from "./alternative-place-service";
import { optimizeItinerary } from "./itinerary-optimizer";
import { getReplanningTravelData } from "./travel-data-service";

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
