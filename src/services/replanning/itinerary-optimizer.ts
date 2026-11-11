
import {
    calculateCurrentActivityOverrun,
    calculateTotalDelay,
    parseDurationToMinutes,
} from "./delay-detector";

import {
    ActivityScheduleChange,
    OpeningWindow,
    ReplanningActivity,
    ReplanningInput,
    ReplanningResult,
    UnscheduledActivity,
} from "@/types/replanning";

const MINUTES_IN_DAY = 24 * 60;

function parseTime(time: string): number | null {
  const value = time.trim().toUpperCase();

  // Supports 12-hour format: 9:30 AM
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

  // Supports 24-hour format: 14:30
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
  const normalized = totalMinutes % MINUTES_IN_DAY;

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getTravelTime(
  from: string,
  to: string,
  travelTimes: ReplanningInput["travelTimes"],
): number | null {
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
    return 0;
  }

  const route = travelTimes.find(
    (item) => item.from === from && item.to === to,
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
  // Missing opening hours means availability is unknown.
  // Do not assume the place is closed.
  if (!openingHours || openingHours.length === 0) {
    return start;
  }

  for (const window of openingHours) {
    const opensAt = parseTime(window.opensAt);
    let closesAt = parseTime(window.closesAt);

    if (opensAt === null || closesAt === null) {
      continue;
    }

    // Support opening windows that cross midnight.
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

export function optimizeItinerary(input: ReplanningInput): ReplanningResult {
  const changes: ActivityScheduleChange[] = [];
  const unscheduledActivities: UnscheduledActivity[] = [];
  const warnings: string[] = [];

  const currentTime = parseTime(input.currentTime);
  const returnDeadline = parseTime(input.returnDeadline);

  if (currentTime === null || returnDeadline === null) {
    return {
      success: false,
      isFeasible: false,
      changes,
      unscheduledActivities,
      alternativeSuggestions: [],
      totalDelayMinutes: 0,
      warnings: ["Invalid current time or return deadline."],
      explanation:
        "The itinerary could not be replanned because the time values are invalid.",
    };
  }

  let isFeasible = true;

  // Calculate delays from completed activities.
  const totalDelayMinutes = input.activities.reduce((total, activity) => {
    const overrun = calculateCurrentActivityOverrun(activity);

    return total + (overrun?.overrunMinutes ?? 0);
  }, calculateTotalDelay(input.activities));

  // Find the activity currently in progress, if any.
  const activeActivity = input.activities.find(
    (activity) =>
      activity.actualStartAt && !activity.actualEndAt && !activity.completed,
  );

  // Determine the user's current location.
  const latestCompleted = [...input.activities]
    .filter((activity) => activity.actualEndAt)
    .sort(
      (a, b) =>
        new Date(b.actualEndAt!).getTime() - new Date(a.actualEndAt!).getTime(),
    )[0];

  let currentLocation =
    activeActivity?.location ||
    latestCompleted?.location ||
    input.returnLocation;

  // The active activity is still running, so future activities
  // cannot begin before the current time.
  let cursor = currentTime;

  // Completed and currently running activities are not rescheduled.
  const remainingActivities = input.activities
    .filter(
      (activity) => !activity.completed && activity.id !== activeActivity?.id,
    )
    .sort((a, b) => {
      const aTime = parseTime(a.time) ?? MINUTES_IN_DAY;
      const bTime = parseTime(b.time) ?? MINUTES_IN_DAY;

      return aTime - bTime;
    });

  for (let i = 0; i < remainingActivities.length; i++) {
    const activity = remainingActivities[i];

    const plannedStart = parseTime(activity.time);
    const duration = parseDurationToMinutes(activity.duration);

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
      }

      continue;
    }

    // Protected activities keep their original scheduled time.
    if (isProtected(activity)) {
      const arrivalTime = cursor + travelToActivity;

      if (plannedStart < currentTime || arrivalTime > plannedStart) {
        isFeasible = false;

        warnings.push(
          `${activity.title} cannot be reached by its original time. It is protected and will not be moved.`,
        );
      }

      cursor = Math.max(cursor, plannedStart + duration);
      currentLocation = activity.location;

      continue;
    }

    // Flexible activities can be moved, but never earlier
    // than their original scheduled time.
    let proposedStart = Math.max(
      cursor + travelToActivity,
      plannedStart,
      currentTime,
    );

    proposedStart =
      fitsOpeningHours(proposedStart, duration, activity.openingHours) ?? -1;

    if (proposedStart < 0) {
      unscheduledActivities.push(
        addUnscheduled(
          activity,
          "The activity cannot fit within the available opening hours.",
        ),
      );

      continue;
    }

    // Check the next protected activity, if one exists.
    const nextProtected = remainingActivities.slice(i + 1).find(isProtected);

    const nextDestination = nextProtected?.location ?? input.returnLocation;

    const travelAfterActivity = getTravelTime(
      activity.location,
      nextDestination,
      input.travelTimes,
    );

    if (travelAfterActivity === null) {
      unscheduledActivities.push(
        addUnscheduled(
          activity,
          `Travel time from ${activity.location} to ${nextDestination} is unavailable.`,
        ),
      );

      continue;
    }

    const finishTime = proposedStart + duration;
    const arrivalAfterActivity = finishTime + travelAfterActivity;

    const availableUntil = nextProtected
      ? parseTime(nextProtected.time)
      : returnDeadline;

    if (availableUntil === null || arrivalAfterActivity > availableUntil) {
      unscheduledActivities.push(
        addUnscheduled(
          activity,
          nextProtected
            ? "There is not enough time before the next protected activity."
            : "The activity would make it impossible to return before the daily deadline.",
        ),
      );

      continue;
    }

    // Record a proposed change only if the time actually changed.
    if (proposedStart !== plannedStart) {
      changes.push({
        activityId: activity.id,
        originalTime: activity.time,
        proposedTime: formatTime(proposedStart),
        reason: "Adjusted to account for delays and travel time.",
      });
    }

    cursor = finishTime;
    currentLocation = activity.location;
  }

  // Check whether the final location can reach the accommodation
  // before the daily return deadline.
  if (remainingActivities.length > 0) {
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
        "The remaining protected schedule cannot meet the daily return deadline.",
      );
    }
  }

  const explanation = isFeasible
    ? "The revised schedule preserves all protected activities and respects the available time and travel constraints. Review the proposed changes before approving."
    : "The itinerary has one or more conflicts involving protected activities or the return deadline. Review the warnings before approving.";

  return {
    success: true,
    isFeasible,
    changes,
    unscheduledActivities,
    alternativeSuggestions: [],
    totalDelayMinutes,
    warnings,
    explanation,
  };
}
