import type { JournalActivity } from "@/context/journal-context";
import type {
  ReplanningActivity,
  TravelTimeData,
  TripActivityProposal,
  TripDayProposal,
  TripReplanningInput,
  TripReplanningResult,
} from "@/types/replanning";

import { parseDurationToMinutes } from "./delay-detector";

const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_DAY_START = 8 * 60;

export function getActivityRouteLocation(activity: { location?: string; plannedAlternative?: JournalActivity["plannedAlternative"] }) {
  const place = activity.plannedAlternative;
  return place ? `alternative:${place.osmType ?? "place"}/${place.id}` : activity.location?.trim() ?? "";
}

type Visit = {
  proposal: TripActivityProposal;
  start: number;
  end: number;
  origin: string;
  destination: string;
};

export function getTimeInMinutes(time: string): number | null {
  const match = time.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3];
  if (minutes > 59 || (period ? hours < 1 || hours > 12 : hours > 23)) return null;
  return (period ? hours % 12 + (period === "PM" ? 12 : 0) : hours) * 60 + minutes;
}

function formatTime(time: number): string {
  const hours = Math.floor(time / 60);
  return `${hours % 12 || 12}:${String(time % 60).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function fitsOpeningHours(activity: ReplanningActivity, start: number, end: number) {
  if (activity.plannedAlternative || !activity.openingHours?.length) return true;
  return activity.openingHours.some(({ opensAt, closesAt }) => {
    const opens = getTimeInMinutes(opensAt);
    const closes = getTimeInMinutes(closesAt);
    return opens !== null && closes !== null && start >= opens &&
      end <= (closes <= opens ? closes + MINUTES_IN_DAY : closes);
  });
}

function optimizeDay(
  day: TripReplanningInput["days"][number],
  input: TripReplanningInput,
): TripDayProposal {
  const data = input.dayTravelData?.[day.id];
  const proposals: TripActivityProposal[] = day.activities.map((activity) => ({
    activity,
    proposedTime: activity.time,
    status: activity.completed ? "completed"
      : activity.actualStartAt && !activity.actualEndAt ? "in-progress"
      : activity.priority === "High" || activity.isFixed ? "fixed"
      : day.date < input.currentDate ? "past" : "scheduled",
  }));
  const compareTimes = (first: TripActivityProposal, second: TripActivityProposal) =>
    (getTimeInMinutes(first.proposedTime) ?? MINUTES_IN_DAY) -
    (getTimeInMinutes(second.proposedTime) ?? MINUTES_IN_DAY);
  const result: TripDayProposal = {
    id: day.id,
    date: day.date,
    title: day.title,
    activities: proposals.sort(compareTimes),
    warnings: [...(data?.warnings ?? [])],
    isFeasible: true,
  };
  if (day.date < input.currentDate || !proposals.length) return result;

  const routes = new Map<string, TravelTimeData>();
  const routeKey = (from: string, to: string) =>
    JSON.stringify([from.trim().toLowerCase(), to.trim().toLowerCase()]);
  for (const route of data?.travelTimes ?? input.travelTimes) {
    routes.set(routeKey(route.from, route.to), route);
  }
  function travel(from: string, to: string): TravelTimeData | undefined {
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
      return { from, to, durationMinutes: 0 };
    }
    return routes.get(routeKey(from, to));
  }

  const today = day.date === input.currentDate;
  const currentTime = getTimeInMinutes(input.currentTime) ?? 0;
  const earliest = proposals.find((item) => getActivityRouteLocation(item.activity));
  const firstDestination = earliest ? getActivityRouteLocation(earliest.activity) : "";
  const firstLocation = data?.startingLocationId ?? data?.routeOrigins[firstDestination] ?? firstDestination;
  const futureStart = Math.min(DEFAULT_DAY_START, Math.max(0,
    (getTimeInMinutes(earliest?.proposedTime ?? "") ?? DEFAULT_DAY_START) - 60,
  ));
  const returnLocation = input.returnLocation.trim();
  let startAt = today ? currentTime : futureStart;
  let startLocation = (today ? input.startingLocationId : undefined) ?? (returnLocation || firstLocation);
  const deadline = day.returnDeadline ? getTimeInMinutes(day.returnDeadline) : MINUTES_IN_DAY;
  if (deadline === null) {
    result.warnings.push("The saved return deadline is invalid. Edit it before applying changes to this day.");
  }

  const fixed: Visit[] = [];
  const flexible: Visit[] = [];
  let runningConflict = false;
  for (const proposal of proposals) {
    const { activity, status } = proposal;
    const plannedTime = getTimeInMinutes(activity.time);
    const duration = parseDurationToMinutes(activity.duration);
    const destination = getActivityRouteLocation(activity);
    const origin = data?.routeOrigins[destination] ?? destination;

    if (status === "completed") continue;

    if (status === "in-progress" && today) {
      const actualStart = new Date(activity.actualStartAt ?? "");
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const localTime = new Date(`${day.date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
      const elapsed = Math.floor((localTime.getTime() - actualStart.getTime()) / 60000);
      if (!Number.isFinite(elapsed) || duration <= 0 || elapsed >= duration) {
        runningConflict = true;
        proposal.reason = "Finish this activity before replanning the rest of the day.";
      } else {
        startAt = Math.max(startAt, currentTime + duration - Math.max(elapsed, 0));
        // A running point-to-point activity ends at its planned destination.
        if (origin !== destination || !input.startingLocationId) startLocation = destination || startLocation;
        proposal.reason = `Time reserved until about ${formatTime(startAt)}.`;
      }
      continue;
    }

    if (status === "fixed" && today && plannedTime !== null && plannedTime < currentTime) {
      proposal.reason = "The fixed start time has already passed.";
      if (plannedTime + duration > startAt) {
        startAt = plannedTime + duration;
        if (!input.startingLocationId) startLocation = destination || startLocation;
      }
      continue;
    }

    let reason: string | undefined;
    if (plannedTime === null) reason = "The scheduled time is invalid.";
    else if (!Number.isFinite(duration) || duration <= 0) reason = "A valid duration is required.";
    else if (!destination) reason = "An intended location is required to check travel.";
    if (reason) {
      proposal.reason = reason;
      if (status === "scheduled") proposal.status = "unscheduled";
      result.isFeasible = false;
      continue;
    }

    const start = plannedTime!;
    const visit = { proposal, start, end: start + duration, origin, destination };
    (status === "scheduled" ? flexible : fixed).push(visit);
  }

  function block(visit: Visit, reason: string) {
    visit.proposal.reason = reason;
    if (visit.proposal.status === "scheduled") visit.proposal.status = "unscheduled";
    result.isFeasible = false;
  }

  const latest = deadline ?? MINUTES_IN_DAY;
  let previous: Visit | undefined;
  for (const visit of fixed) {
    const leg = travel(previous?.destination ?? startLocation, visit.origin);
    if (!leg) block(visit, "Travel time to this fixed activity is unavailable.");
    else if (runningConflict || (previous?.end ?? startAt) + leg.durationMinutes > visit.start) {
      block(visit, previous
        ? `Conflicts with ${previous.proposal.activity.title} or the travel time between them.`
        : "There is insufficient time to reach this activity at its fixed start.");
    } else if (visit.end > latest ||
      !fitsOpeningHours(visit.proposal.activity, visit.start, visit.end)) {
      block(visit, "The fixed time conflicts with opening hours or the return deadline.");
    } else {
      visit.proposal.incomingTravel = leg;
    }
    previous = visit;
  }

  const schedule = [...fixed];
  const fixedValid = result.isFeasible;
  // Give medium-priority visits first choice of the gaps around fixed visits.
  flexible.sort((first, second) =>
    Number(second.proposal.activity.priority === "Medium") -
    Number(first.proposal.activity.priority === "Medium") || first.start - second.start,
  );

  function tryPlacement(visit: Visit, visits: Visit[], preferOriginal: boolean) {
    const duration = visit.end - visit.start;
    for (let index = 0; index <= visits.length; index += 1) {
      const before = visits[index - 1];
      const after = visits[index];
      const inbound = travel(before?.destination ?? startLocation, visit.origin);
      const outbound = travel(visit.destination, after?.origin ?? returnLocation);
      if (!inbound || !outbound) continue;
      const earliestStart = (before?.end ?? startAt) + inbound.durationMinutes;
      const latestStart = (after?.start ?? latest) - outbound.durationMinutes - duration;
      const activity = visit.proposal.activity;
      const openings = (activity.plannedAlternative ? [] : activity.openingHours ?? []).map((window) =>
        getTimeInMinutes(window.opensAt) ?? MINUTES_IN_DAY,
      );
      const candidates = preferOriginal ? [visit.start] : [earliestStart, ...openings].sort((a, b) => a - b);
      const start = candidates.find((candidate) => candidate >= earliestStart &&
        candidate <= latestStart && fitsOpeningHours(activity, candidate, candidate + duration));
      if (start === undefined) continue;
      visits.splice(index, 0, { ...visit, start, end: start + duration });
      return true;
    }
    return false;
  }

  const unplaced: Visit[] = [];
  for (const visit of flexible) {
    if (runningConflict || (!tryPlacement(visit, schedule, true) && !tryPlacement(visit, schedule, false))) {
      unplaced.push(visit);
    }
  }
  // Retry with earlier packing if keeping original times consumed usable gaps.
  if (unplaced.length && !runningConflict) {
    const packed = [...fixed];
    const remaining = flexible.filter((visit) => !tryPlacement(visit, packed, false));
    if (remaining.length < unplaced.length) {
      schedule.splice(0, schedule.length, ...packed);
      unplaced.splice(0, unplaced.length, ...remaining);
    }
  }

  for (const visit of unplaced) {
    visit.proposal.canMoveToLaterDay = fixedValid && !runningConflict && deadline !== null;
    block(visit, runningConflict
      ? "The running activity needs to finish before a start time can be confirmed."
      : "No available slot fits its duration, travel, and the day's fixed activities or return deadline.");
  }

  const last = schedule[schedule.length - 1];
  if (last && returnLocation) {
    const leg = travel(last.destination, returnLocation);
    if (!leg || last.end + leg.durationMinutes > latest) {
      result.isFeasible = false;
      result.warnings.push(leg
        ? `The trip back after ${last.proposal.activity.title} exceeds the return deadline.`
        : `The route back from ${last.proposal.activity.title} to your accommodation is unavailable.`);
    } else {
      result.returnTravel = leg;
    }
  }

  if (deadline === null || runningConflict) result.isFeasible = false;
  if (fixedValid && !runningConflict) {
    schedule.forEach((visit, index) => {
      const before = schedule[index - 1];
      if (result.isFeasible && visit.proposal.status === "scheduled" &&
          visit.start !== getTimeInMinutes(visit.proposal.activity.time)) {
        visit.proposal.proposedTime = formatTime(visit.start);
      }
      if (result.isFeasible) {
        visit.proposal.incomingTravel = travel(before?.destination ?? startLocation, visit.origin);
      }
    });
  }

  if (!result.isFeasible) {
    result.returnTravel = undefined;
    proposals.forEach((proposal) => { proposal.incomingTravel = undefined; });
    result.warnings.push("This day retains its saved times until the scheduling issues are resolved.");
  }
  return { ...result, activities: proposals.sort(compareTimes) };
}

export function optimizeTripItinerary(input: TripReplanningInput): TripReplanningResult {
  const days = [...input.days].sort((first, second) => first.date.localeCompare(second.date))
    .map((day) => optimizeDay(day, input));
  const changes = days.filter((day) => day.isFeasible).flatMap((day) =>
    day.activities.flatMap(({ activity, proposedTime }) => proposedTime === activity.time
      ? []
      : [{
          activityId: activity.id,
          title: activity.title,
          priority: activity.priority,
          originalDayId: day.id,
          originalDate: day.date,
          originalTime: activity.time,
          proposedDayId: day.id,
          proposedDate: day.date,
          proposedTime,
          reason: "Adjusted around travel time and fixed activities.",
        }],
    ),
  );

  const isFeasible = days.every((day) => day.isFeasible);
  return {
    success: true,
    isFeasible,
    days,
    changes,
    warnings: [],
    explanation: changes.length
      ? "Review the proposed changes for your trip."
      : isFeasible
        ? "There are no itinerary changes to apply."
        : "No schedule changes can be applied. Review the issues shown for each day.",
  };
}
