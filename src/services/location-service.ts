import * as Location from "expo-location";

export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

export async function getCurrentLocation(): Promise<UserCoordinates> {
  // Request foreground location permission.
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission is required to find nearby places.");
  }

  // Check whether device location services are enabled.
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    throw new Error("Please enable location services on your device.");
  }

  // Retrieve the current location.
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
