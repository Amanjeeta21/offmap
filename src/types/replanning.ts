import type { JournalActivity } from "@/context/journal-context";

/**
 * A time window during which a place is available.
 * Times use 24-hour HH:mm format.
 */
export type OpeningWindow = {
  opensAt: string;
  closesAt: string;
};

/**
 * Activity extended with replanning-specific information.
 */
export type ReplanningActivity = JournalActivity & {
  isFixed?: boolean;
  openingHours?: OpeningWindow[];
};

/**
 * Travel time between two locations.
 * Travel times are directional.
 */
export type TravelTimeData = {
  from: string;
  to: string;
  durationMinutes: number;
  distanceMeters?: number;
};

/**
 * A proposed change to an activity's scheduled time.
 */
export type ActivityScheduleChange = {
  activityId: string;
  originalTime: string;
  proposedTime: string;
  reason: string;
};

/**
 * An activity that cannot be accommodated.
 */
export type UnscheduledActivity = {
  activityId: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  reason: string;
};

/**
 * Information about a nearby alternative location.
 */
export type AlternativePlace = {
  id?: number;
  name: string;
  location: string;
  category?: string;
  distanceMeters?: number;

  /**
   * Road travel time from the current location.
   */
  travelTimeMinutes: number;

  /**
   * Road travel times from this alternative to other destinations.
   * Keys are destination location IDs.
   */
  travelTimesToDestinations?: Record<string, number>;

  reason: string;
  openingHours?: OpeningWindow[];
};

/**
 * Suggested alternatives for an activity that cannot be completed.
 */
export type AlternativeSuggestion = {
  activityId: string;
  originalTitle: string;
  alternatives: AlternativePlace[];
};

/**
 * Complete result of the replanning operation.
 *
 * This is only a proposal.
 * The saved itinerary must not change until the user approves it.
 */
export type ReplanningResult = {
  success: boolean;
  isFeasible: boolean;
  changes: ActivityScheduleChange[];
  unscheduledActivities: UnscheduledActivity[];
  alternativeSuggestions: AlternativeSuggestion[];
  totalDelayMinutes: number;
  warnings: string[];
  explanation: string;
};

export type TripReplanningDay = {
  id: string;
  date: string;
  title: string;
  activities: ReplanningActivity[];
  returnDeadline?: string;
};

export type TripActivityScheduleChange = {
  activityId: string;
  title: string;
  priority: ReplanningActivity["priority"];
  originalDayId: string;
  originalDate: string;
  originalTime: string;
  proposedDayId: string;
  proposedDate: string;
  proposedTime: string;
  reason: string;
};

export type TripReplanningResult = {
  success: boolean;
  isFeasible: boolean;
  changes: TripActivityScheduleChange[];
  days: TripDayProposal[];
  warnings: string[];
  explanation: string;
};

export type TripActivityProposal = {
  activity: ReplanningActivity;
  proposedTime: string;
  originalDate?: string;
  canMoveToLaterDay?: boolean;
  status: "fixed" | "completed" | "in-progress" | "past" | "scheduled" | "unscheduled";
  reason?: string;
  incomingTravel?: TravelTimeData;
};

export type TripDayProposal = {
  id: string;
  date: string;
  title: string;
  activities: TripActivityProposal[];
  warnings: string[];
  isFeasible: boolean;
  returnTravel?: TravelTimeData;
  alternatives?: AlternativePlace[];
};

/**
 * Input required to replan one itinerary day.
 */
export type ReplanningInput = {
  activities: ReplanningActivity[];
  travelTimes: TravelTimeData[];

  /**
   * Starting location ID in the travel-time matrix.
   */
  startingLocationId?: string;

  /**
   * Nearby places that may replace activities that cannot fit.
   */
  nearbyAlternatives?: AlternativePlace[];

  /**
   * Current local time in HH:mm format.
   */
  currentTime: string;

  /**
   * Daily return deadline in HH:mm format.
   */
  returnDeadline: string;

  /**
   * Hotel or accommodation location.
   */
  returnLocation: string;
};

export type TripReplanningInput = {
  days: TripReplanningDay[];
  travelTimes: TravelTimeData[];
  startingLocationId?: string;
  dayTravelData?: Record<string, {
    travelTimes: TravelTimeData[];
    routeOrigins: Record<string, string>;
    warnings: string[];
  }>;
  currentDate: string;
  currentTime: string;
  returnLocation: string;
};
