import type { NearbyPlace } from "@/services/overpass-service";
import type { TripReplanningDay, TripReplanningInput } from "@/types/replanning";
import { getActivityRouteLocation, optimizeTripItinerary } from "./trip-optimizer";
import { parseActivityLocation } from "./travel-data-service";

// Illustrative locations and distances from a sample position in the old city.
const places: NearbyPlace[] = [
  { id: 1, osmType: "demo", name: "Nepali Temple", category: "temple", latitude: 25.3123, longitude: 83.0134, distance: 90 },
  { id: 2, osmType: "demo", name: "Lalita Ghat", category: "riverfront ghat", latitude: 25.3126, longitude: 83.0136, distance: 120 },
  { id: 3, osmType: "demo", name: "Vishalakshi Temple", category: "temple", latitude: 25.3101, longitude: 83.0125, distance: 260 },
];

const preferredActivityIds = new Set(["v1-4", "v2-5", "v3-3"]);

export function replanVaranasiDemo(days: TripReplanningDay[], currentDate: string, accommodation: string) {
  const returnLocation = accommodation.trim();
  const dayTravelData: NonNullable<TripReplanningInput["dayTravelData"]> = {};
  for (const day of days) {
    const locations = new Set([returnLocation, ...places.map((place) => getActivityRouteLocation({ plannedAlternative: place }))]);
    const routeOrigins: Record<string, string> = Object.create(null);
    for (const activity of day.activities) {
      const { original, routeOrigin } = parseActivityLocation(getActivityRouteLocation(activity));
      locations.add(original);
      if (routeOrigin) {
        routeOrigins[original] = routeOrigin;
        locations.add(routeOrigin);
      }
    }
    dayTravelData[day.id] = {
      routeOrigins,
      warnings: [],
      travelTimes: [...locations].flatMap((from) => [...locations].filter((to) => from !== to).map((to) => ({
        from, to, durationMinutes: 10,
      }))),
    };
  }

  const plan = (planDays: TripReplanningDay[]) => optimizeTripItinerary({
    days: planDays,
    currentDate,
    currentTime: "00:00",
    returnLocation,
    travelTimes: [],
    dayTravelData,
  });
  const result = plan(days);
  result.warnings.unshift("Varanasi demo uses sample places, distances, and travel times from a simulated location.");

  for (const day of result.days) {
    const savedDay = days.find((item) => item.id === day.id);
    if (!savedDay) continue;
    const eligible = day.activities.filter((item) => item.status === "scheduled" || item.canMoveToLaterDay);
    const target = eligible.find(({ activity }) => preferredActivityIds.has(activity.id)) ?? eligible[0];
    if (!target) continue;

    day.alternatives = places.flatMap((place) => {
      if (savedDay.activities.some((activity) => activity.plannedAlternative?.name === place.name ||
          activity.location.trim().toLowerCase() === place.name.toLowerCase())) return [];
      const activities = savedDay.activities.map((activity) =>
        activity === target.activity ? { ...activity, plannedAlternative: place } : activity,
      );
      const [itinerary] = plan([{ ...savedDay, activities }]).days;
      return itinerary.isFeasible ? [{ activityId: target.activity.id, place, itinerary }] : [];
    });
  }

  if (result.days.some((day) => day.alternatives?.length)) {
    result.explanation = "Choose a sample nearby place to preview a different itinerary.";
  }
  return result;
}
