import { geocodeLocation } from "@/services/geocoding-service";
import { UserCoordinates } from "@/services/location-service";
import { getTravelTimeMatrix, TravelLocation } from "@/services/osrm-service";
import { getNearbyPlaces, NearbyPlace } from "@/services/overpass-service";
import { AlternativePlace } from "@/types/replanning";

export type NearbyAlternative = AlternativePlace & {
  id: number;
  category: string;
  distanceMeters: number;

  // Road travel times from this alternative to other destinations.
  travelTimesToDestinations: Record<string, number>;
};

const CURRENT_LOCATION_ID = "__current_location__";
const MAX_ROUTE_CANDIDATES = 20;
const MAX_ALTERNATIVES = 10;

export async function getNearbyAlternatives(
  currentLocation: UserCoordinates,
  excludedLocations: string[] = [],
  destinationLocations: string[] = [],
  radius = 5000,
): Promise<NearbyAlternative[]> {
  // Find nearby places.
  const nearbyPlaces: NearbyPlace[] = await getNearbyPlaces(
    currentLocation,
    radius,
  );

  if (nearbyPlaces.length === 0) {
    return [];
  }

  // Exclude places already included in the itinerary.
  const excluded = new Set(
    excludedLocations.map((location) => location.trim().toLowerCase()),
  );

  const candidates = nearbyPlaces
    .filter((place) => !excluded.has(place.name.trim().toLowerCase()))
    .sort((first, second) => first.distance - second.distance)
    .slice(0, MAX_ROUTE_CANDIDATES);

  if (candidates.length === 0) {
    return [];
  }

  // Resolve coordinates for destinations such as the next
  // protected activity or the accommodation.
  const uniqueDestinations = [
    ...new Set(
      destinationLocations.map((location) => location.trim()).filter(Boolean),
    ),
  ];

  const destinationCoordinates = new Map<string, UserCoordinates>();

  for (const destination of uniqueDestinations) {
    const result = await geocodeLocation(destination);

    destinationCoordinates.set(destination, result.coordinates);
  }

  // Prepare the GPS location, candidate alternatives,
  // and onward destinations for one OSRM matrix request.
  const travelLocations: TravelLocation[] = [
    {
      id: CURRENT_LOCATION_ID,
      coordinates: currentLocation,
    },
    ...candidates.map((place) => ({
      id: String(place.id),
      coordinates: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
    })),
    ...Array.from(destinationCoordinates.entries()).map(
      ([location, coordinates]) => ({
        id: location,
        coordinates,
      }),
    ),
  ];

  // Calculate driving times between all supplied locations.
  const matrix = await getTravelTimeMatrix(travelLocations);

  const travelTimeMap = new Map(
    matrix.map((entry) => [
      `${entry.from}->${entry.to}`,
      entry.durationMinutes,
    ]),
  );

  // Build alternatives with both incoming and onward travel times.
  const alternatives: NearbyAlternative[] = candidates
    .map((place) => {
      const placeId = String(place.id);

      const travelTimeFromCurrent = travelTimeMap.get(
        `${CURRENT_LOCATION_ID}->${placeId}`,
      );

      if (travelTimeFromCurrent == null) {
        return null;
      }

      const travelTimesToDestinations: Record<string, number> = {};

      for (const destination of uniqueDestinations) {
        const onwardTravelTime = travelTimeMap.get(
          `${placeId}->${destination}`,
        );

        if (onwardTravelTime != null) {
          travelTimesToDestinations[destination] = onwardTravelTime;
        }
      }

      return {
        id: place.id,
        name: place.name,
        location: place.address ?? place.name,
        category: place.category,
        distanceMeters: place.distance,
        travelTimeMinutes: travelTimeFromCurrent,
        travelTimesToDestinations,
        reason: `Approximately ${travelTimeFromCurrent} minutes away by road.`,
      };
    })
    .filter((place): place is NearbyAlternative => place !== null)
    .sort(
      (first, second) => first.travelTimeMinutes - second.travelTimeMinutes,
    );

  return alternatives.slice(0, MAX_ALTERNATIVES);
}
