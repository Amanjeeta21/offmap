import { JournalActivity } from "@/context/journal-context";

/**
 * A time window during which a place is available.
 * Times use 24-hour HH:mm format.
 *
 * Example: { opensAt: "09:00", closesAt: "17:00" }
 */
export type OpeningWindow = {
  opensAt: string;
  closesAt: string;
};

/**
 * Activity extended with replanning-specific information.
 */
export type ReplanningActivity = JournalActivity & {
  /**
   * Fixed activities cannot be rescheduled.
   * Examples: booked flights, trains and confirmed reservations.
   */
  isFixed?: boolean;

  /**
   * Opening hours for the activity's location.
   * If unavailable, the optimizer will not assume the place is closed.
   */
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
 * An activity that cannot be accommodated in the revised itinerary.
 */
export type UnscheduledActivity = {
  activityId: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  reason: string;
};

/**
 * Information about a proposed alternative location.
 */
export type AlternativePlace = {
  name: string;
  location: string;
  travelTimeMinutes: number;
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

/**
 * Input required to replan one itinerary day.
 */
export type ReplanningInput = {
  /**
   * Activities belonging to the selected day.
   */
  activities: ReplanningActivity[];

  /**
   * Travel durations between activity locations.
   */
  travelTimes: TravelTimeData[];

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
