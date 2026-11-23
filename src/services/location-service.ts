import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

export type GPSPosition = UserCoordinates & { accuracy: number | null };

export type LocationServiceErrorCode =
  | "PERMISSION_DENIED"
  | "LOCATION_SERVICES_DISABLED"
  | "LOCATION_UNAVAILABLE";

export class LocationServiceError extends Error {
  code: LocationServiceErrorCode;

  constructor(code: LocationServiceErrorCode, message: string) {
    super(message);
    this.name = "LocationServiceError";
    this.code = code;
  }
}

export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return;
    } catch {
      await Linking.openSettings();
      return;
    }
  }

  await Linking.openSettings();
}

export async function getCurrentLocation(precise = false): Promise<GPSPosition> {
  let permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== "granted") {
    throw new LocationServiceError(
      "PERMISSION_DENIED",
      "Allow OFFMAP to access your location in your device settings, then try again.",
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    throw new LocationServiceError(
      "LOCATION_SERVICES_DISABLED",
      "Turn on your device location services, then try again.",
    );
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const options: Location.LocationOptions & { maximumAge?: number } = {
    accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
    // Expo SDK 58 passes web options through to the browser, which otherwise
    // accepts cached fixes indefinitely and can repeat the same inaccurate fix.
    ...(Platform.OS === "web" ? { maximumAge: 0 } : {}),
  };
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync(options),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("GPS timed out")), 15000);
      }),
    ]);

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch {
    throw new LocationServiceError(
      "LOCATION_UNAVAILABLE",
      "OFFMAP couldn't retrieve your current location. Please check your GPS signal and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Finds a location error even if another service wraps it.
 */
export function findLocationServiceError(
  error: unknown,
): LocationServiceError | null {
  let current: unknown = error;

  while (current instanceof Error) {
    if (current instanceof LocationServiceError) {
      return current;
    }

    const possibleCause = (current as Error & { cause?: unknown }).cause;

    if (!possibleCause || possibleCause === current) {
      break;
    }

    current = possibleCause;
  }

  return null;
}
