import {
    calculateCurrentActivityOverrun,
    calculateTotalDelay,
    parseDurationToMinutes,
} from "./delay-detector";

import {
    ActivityScheduleChange,
    AlternativePlace,
    AlternativeSuggestion,
    OpeningWindow,
    ReplanningActivity,
    ReplanningInput,
    ReplanningResult,
    UnscheduledActivity,
} from "@/types/replanning";

const MINUTES_IN_DAY = 24 * 60;

function parseTime(time: string): number | null {
  const value = time.trim().toUpperCase();

  const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const period = twelveHour[3];

    if (hours < 1 || hours > 12 || minutes > 59) {
      return null;
    }

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    return hours * 60 + minutes;
  }

  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/);

  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);

    if (hours > 23 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
}

function formatTime(totalMinutes: number): string {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function normalizeLocation(location: string): string {
  return location.trim().toLowerCase();
}

function getTravelTime(
  from: string,
  to: string,
  travelTimes: ReplanningInput["travelTimes"],
): number | null {
  if (normalizeLocation(from) === normalizeLocation(to)) {
    return 0;
  }

  const route = travelTimes.find(
    (item) =>
      normalizeLocation(item.from) === normalizeLocation(from) &&
      normalizeLocation(item.to) === normalizeLocation(to),
  );

  return route ? Math.max(0, route.durationMinutes) : null;
}

function isProtected(activity: ReplanningActivity): boolean {
  return (
    activity.completed ||
    activity.priority === "High" ||
    activity.isFixed === true
  );
}

function fitsOpeningHours(
  start: number,
  duration: number,
  openingHours?: OpeningWindow[],
): number | null {
  if (!openingHours || openingHours.length === 0) {
    return start;
  }

  for (const window of openingHours) {
    const opensAt = parseTime(window.opensAt);
    let closesAt = parseTime(window.closesAt);

    if (opensAt === null || closesAt === null) {
      continue;
    }

    if (closesAt <= opensAt) {
      closesAt += MINUTES_IN_DAY;
    }

    const possibleStart = Math.max(start, opensAt);

    if (possibleStart + duration <= closesAt) {
      return possibleStart;
    }
  }

  return null;
}

function addUnscheduled(
  activity: ReplanningActivity,
  reason: string,
): UnscheduledActivity {
  return {
    activityId: activity.id,
    title: activity.title,
    priority: activity.priority,
    reason,
  };
}

function getActiveActivity(
  activities: ReplanningActivity[],
): ReplanningActivity | undefined {
  return activities.find(
    (activity) =>
      !!activity.actualStartAt && !activity.actualEndAt && !activity.completed,
  );
}

function getLatestCompletedActivity(
  activities: ReplanningActivity[],
): ReplanningActivity | undefined {
  return [...activities]
    .filter((activity) => !!activity.actualEndAt)
    .sort(
      (first, second) =>
        new Date(second.actualEndAt!).getTime() -
        new Date(first.actualEndAt!).getTime(),
    )[0];
}

function getPlannedTime(activity: ReplanningActivity): number {
  return parseTime(activity.time) ?? MINUTES_IN_DAY;
}

/**
 * Finds nearby places that can replace an activity
 * without violating the next protected event or return deadline.
 */
function findFittingAlternatives(
  activity: ReplanningActivity,
  duration: number,
  cursor: number,
  currentLocation: string,
  nextDestination: string,
  availableUntil: number,
  alternatives: AlternativePlace[],
): AlternativeSuggestion | null {
  const fittingAlternatives: AlternativePlace[] = [];

  const plannedStart = parseTime(activity.time);

  if (plannedStart === null) {
    return null;
  }

  for (const alternative of alternatives) {
    const travelFromCurrent = alternative.travelTimeMinutes;

    if (!Number.isFinite(travelFromCurrent) || travelFromCurrent < 0) {
      continue;
    }

    // Calculate when the user can reach the alternative.
    const arrivalTime = cursor + travelFromCurrent;

    const possibleStart = Math.max(arrivalTime, plannedStart);

    // Check the alternative's opening hours, if available.
    const alternativeStart = fitsOpeningHours(
      possibleStart,
      duration,
      alternative.openingHours,
    );

    if (alternativeStart === null) {
      continue;
    }

    // Find the onward road travel time.
    const onwardTravelTime =
      alternative.travelTimesToDestinations?.[nextDestination];

    if (
      onwardTravelTime === undefined ||
      !Number.isFinite(onwardTravelTime) ||
      onwardTravelTime < 0
    ) {
      continue;
    }

    // Check whether the alternative and onward journey fit.
    const finishTime = alternativeStart + duration;
    const finalArrival = finishTime + onwardTravelTime;

    if (finalArrival > availableUntil) {
      continue;
    }

    fittingAlternatives.push({
      ...alternative,
      reason:
        `${alternative.travelTimeMinutes} minutes from your current location, ` +
        `${duration} minutes for the activity, and ` +
        `${onwardTravelTime} minutes to ${nextDestination}.`,
    });
  }

  if (fittingAlternatives.length === 0) {
    return null;
  }

  // Prefer alternatives with shorter total journey times.
  fittingAlternatives.sort((first, second) => {
    const firstOnward = first.travelTimesToDestinations?.[nextDestination] ?? 0;

    const secondOnward =
      second.travelTimesToDestinations?.[nextDestination] ?? 0;

    return (
      first.travelTimeMinutes +
      firstOnward -
      (second.travelTimeMinutes + secondOnward)
    );
  });

  return {
    activityId: activity.id,
    originalTitle: activity.title,
    alternatives: fittingAlternatives.slice(0, 5),
  };
}

export function optimizeItinerary(input: ReplanningInput): ReplanningResult {
  const changes: ActivityScheduleChange[] = [];
  const unscheduledActivities: UnscheduledActivity[] = [];
  const alternativeSuggestions: AlternativeSuggestion[] = [];
  const warnings: string[] = [];

  const currentTime = parseTime(input.currentTime);
  const returnDeadline = parseTime(input.returnDeadline);

  if (currentTime === null || returnDeadline === null) {
    return {
      success: false,
      isFeasible: false,
      changes,
      unscheduledActivities,
      alternativeSuggestions,
      totalDelayMinutes: 0,
      warnings: ["Invalid current time or return deadline."],
      explanation:
        "The itinerary could not be replanned because the time values are invalid.",
    };
  }

  let isFeasible = true;

  // Calculate delays from completed and ongoing activities.
  const totalDelayMinutes = input.activities.reduce((total, activity) => {
    const overrun = calculateCurrentActivityOverrun(activity);

    return total + (overrun?.overrunMinutes ?? 0);
  }, calculateTotalDelay(input.activities));

  // Identify the currently running activity.
  const activeActivity = getActiveActivity(input.activities);

  // Identify the most recently completed activity.
  const latestCompleted = getLatestCompletedActivity(input.activities);

  // Start from the actual GPS or active-activity location.
  let currentLocation =
    input.startingLocationId ||
    activeActivity?.location ||
    latestCompleted?.location ||
    input.returnLocation;

  // Future activities cannot begin before the current time.
  let cursor = currentTime;

  // Completed and ongoing activities are never rescheduled.
  const remainingActivities = input.activities
    .filter(
      (activity) => !activity.completed && activity.id !== activeActivity?.id,
    )
    .sort((first, second) => getPlannedTime(first) - getPlannedTime(second));

  for (let i = 0; i < remainingActivities.length; i++) {
    const activity = remainingActivities[i];

    const plannedStart = parseTime(activity.time);
    const duration = parseDurationToMinutes(activity.duration);

    // Validate the activity's scheduled time and duration.
    if (plannedStart === null || duration <= 0) {
      const reason = "The activity has an invalid scheduled time or duration.";

      if (isProtected(activity)) {
        isFeasible = false;
        warnings.push(`${activity.title}: ${reason}`);
      } else {
        unscheduledActivities.push(addUnscheduled(activity, reason));
      }

      continue;
    }

    // Find the next protected activity.
    const nextProtected = remainingActivities.slice(i + 1).find(isProtected);

    const nextDestination = nextProtected?.location ?? input.returnLocation;

    const availableUntil = nextProtected
      ? parseTime(nextProtected.time)
      : returnDeadline;

    // Validate the next destination's scheduled time.
    if (availableUntil === null) {
      if (isProtected(activity)) {
        isFeasible = false;
        warnings.push(
          `${activity.title}: The next protected activity has an invalid scheduled time.`,
        );
      } else {
        unscheduledActivities.push(
          addUnscheduled(
            activity,
            "The next destination has an invalid scheduled time.",
          ),
        );
      }

      continue;
    }

    // Find the road travel time to this activity.
    const travelToActivity = getTravelTime(
      currentLocation,
      activity.location,
      input.travelTimes,
    );

    if (travelToActivity === null) {
      const reason = `Travel time from ${currentLocation} to ${activity.location} is unavailable.`;

      if (isProtected(activity)) {
        isFeasible = false;
        warnings.push(`${activity.title}: ${reason}`);
      } else {
        unscheduledActivities.push(addUnscheduled(activity, reason));

        const suggestion = findFittingAlternatives(
          activity,
          duration,
          cursor,
          currentLocation,
          nextDestination,
          availableUntil,
          input.nearbyAlternatives ?? [],
        );

        if (suggestion) {
          alternativeSuggestions.push(suggestion);
        }
      }

      continue;
    }

    const arrivalTime = cursor + travelToActivity;

    // High-priority and fixed activities retain their original times.
    if (isProtected(activity)) {
      if (arrivalTime > plannedStart || cursor > plannedStart) {
        isFeasible = false;

        warnings.push(
          `${activity.title} cannot be reached by its original time. It is protected and will not be moved.`,
        );
      }

      cursor = Math.max(arrivalTime, plannedStart) + duration;
      currentLocation = activity.location;

      continue;
    }

    // Flexible activities may move later, but never earlier
    // than their originally planned time.
    let proposedStart = Math.max(arrivalTime, plannedStart, currentTime);

    const openingTime = fitsOpeningHours(
      proposedStart,
      duration,
      activity.openingHours,
    );

    if (openingTime === null) {
      const reason =
        "The activity cannot fit within the available opening hours.";

      unscheduledActivities.push(addUnscheduled(activity, reason));

      const suggestion = findFittingAlternatives(
        activity,
        duration,
        cursor,
        currentLocation,
        nextDestination,
        availableUntil,
        input.nearbyAlternatives ?? [],
      );

      if (suggestion) {
        alternativeSuggestions.push(suggestion);
      }

      continue;
    }

    proposedStart = openingTime;

    // Find the travel time to the next protected activity
    // or the accommodation.
    const travelAfterActivity = getTravelTime(
      activity.location,
      nextDestination,
      input.travelTimes,
    );

    if (travelAfterActivity === null) {
      const reason = `Travel time from ${activity.location} to ${nextDestination} is unavailable.`;

      unscheduledActivities.push(addUnscheduled(activity, reason));

      const suggestion = findFittingAlternatives(
        activity,
        duration,
        cursor,
        currentLocation,
        nextDestination,
        availableUntil,
        input.nearbyAlternatives ?? [],
      );

      if (suggestion) {
        alternativeSuggestions.push(suggestion);
      }

      continue;
    }

    const finishTime = proposedStart + duration;
    const arrivalAfterActivity = finishTime + travelAfterActivity;

    if (arrivalAfterActivity > availableUntil) {
      const reason = nextProtected
        ? "There is not enough time before the next protected activity."
        : "The activity would make it impossible to return before the daily deadline.";

      unscheduledActivities.push(addUnscheduled(activity, reason));

      const suggestion = findFittingAlternatives(
        activity,
        duration,
        cursor,
        currentLocation,
        nextDestination,
        availableUntil,
        input.nearbyAlternatives ?? [],
      );

      if (suggestion) {
        alternativeSuggestions.push(suggestion);
      }

      continue;
    }

    // Record a proposed change only when the scheduled time differs.
    if (proposedStart !== plannedStart) {
      changes.push({
        activityId: activity.id,
        originalTime: activity.time,
        proposedTime: formatTime(proposedStart),
        reason: "Adjusted to account for current delays and road travel time.",
      });
    }

    cursor = finishTime;
    currentLocation = activity.location;
  }

  // Verify that the user can return to their accommodation
  // before the daily deadline.
  const travelToReturn = getTravelTime(
    currentLocation,
    input.returnLocation,
    input.travelTimes,
  );

  if (travelToReturn === null) {
    isFeasible = false;

    warnings.push("Travel time back to the accommodation is unavailable.");
  } else if (cursor + travelToReturn > returnDeadline) {
    isFeasible = false;

    warnings.push(
      "The remaining itinerary cannot meet the daily return deadline.",
    );
  }

  const explanation = isFeasible
    ? "The revised schedule preserves completed, ongoing, High-priority and fixed activities while respecting available time and travel constraints. Review the proposed changes and alternatives before approving."
    : "The itinerary has one or more conflicts involving protected activities, unavailable routes or the return deadline. Review the warnings before approving.";

  return {
    success: true,
    isFeasible,
    changes,
    unscheduledActivities,
    alternativeSuggestions,
    totalDelayMinutes,
    warnings,
    explanation,
  };
}
