import { UserCoordinates } from "@/services/location-service";

export type NearbyPlace = {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distance: number;
  address?: string;
};

const OVERPASS_URL = process.env.EXPO_PUBLIC_OVERPASS_API_URL;

function calculateDistance(
  origin: UserCoordinates,
  destination: UserCoordinates,
): number {
  const earthRadius = 6371000;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return Math.round(
    earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
}

export async function getNearbyPlaces(
  coordinates: UserCoordinates,
  radius = 5000,
): Promise<NearbyPlace[]> {
  if (!OVERPASS_URL) {
    throw new Error("Overpass API URL is missing from the environment.");
  }

  const { latitude, longitude } = coordinates;

  const query = `
    [out:json][timeout:25];

    (
      nwr(around:${radius},${latitude},${longitude})["amenity"~"restaurant|cafe|fast_food|bar|pub|place_of_worship"];
      nwr(around:${radius},${latitude},${longitude})["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park"];
      nwr(around:${radius},${latitude},${longitude})["historic"~"monument|memorial|castle|archaeological_site"];
      nwr(around:${radius},${latitude},${longitude})["leisure"~"park|garden|nature_reserve"];
    );

    out center tags;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(
      `Nearby places request failed with status ${response.status}.`,
    );
  }

  const data = await response.json();

  const places: NearbyPlace[] = data.elements
    .map((element: any) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      if (lat == null || lon == null || !element.tags?.name) {
        return null;
      }

      const tags = element.tags;

      return {
        id: element.id,
        name: tags.name,
        category:
          tags.amenity ??
          tags.tourism ??
          tags.historic ??
          tags.leisure ??
          "place",
        latitude: lat,
        longitude: lon,
        distance: calculateDistance(coordinates, {
          latitude: lat,
          longitude: lon,
        }),
        address:
          [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") ||
          undefined,
      };
    })
    .filter((place: NearbyPlace | null): place is NearbyPlace => place !== null)
    .sort(
      (first: NearbyPlace, second: NearbyPlace) =>
        first.distance - second.distance,
    );

  return places;
}
