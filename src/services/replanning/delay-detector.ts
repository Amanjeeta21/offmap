import { JournalActivity } from "@/context/journal-context";

export type ActivityDelay = {
  activityId: string;
  title: string;
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  delayMinutes: number;
  delayed: boolean;
};

export function parseDurationToMinutes(duration: string): number {
  const normalized = duration.toLowerCase().trim();

  const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
  const minutesMatch = normalized.match(/(\d+)\s*(minute|minutes|min|mins)/);

  let totalMinutes = 0;

  if (hoursMatch) {
    totalMinutes += Number(hoursMatch[1]) * 60;
  }

  if (minutesMatch) {
    totalMinutes += Number(minutesMatch[1]);
  }

  return Math.round(totalMinutes);
}

export function calculateActivityDelay(
  activity: JournalActivity,
): ActivityDelay | null {
  if (!activity.actualStartAt || !activity.actualEndAt) {
    return null;
  }

  const plannedDurationMinutes = parseDurationToMinutes(activity.duration);

  const start = new Date(activity.actualStartAt).getTime();
  const end = new Date(activity.actualEndAt).getTime();

  const actualDurationMinutes = Math.round(
    (end - start) / (1000 * 60),
  );

  const delayMinutes =
    actualDurationMinutes - plannedDurationMinutes;

  return {
    activityId: activity.id,
    title: activity.title,
    plannedDurationMinutes,
    actualDurationMinutes,
    delayMinutes,
    delayed: delayMinutes > 0,
  };
}

export function calculateTotalDelay(
  activities: JournalActivity[],
): number {
  return activities.reduce((total, activity) => {
    const result = calculateActivityDelay(activity);

    if (!result) {
      return total;
    }

    return total + Math.max(result.delayMinutes, 0);
  }, 0);
}
export type CurrentActivityOverrun = {
  activityId: string;
  title: string;
  plannedDurationMinutes: number;
  elapsedMinutes: number;
  overrunMinutes: number;
  overdue: boolean;
  expectedFinishAt: string;
};

export function calculateCurrentActivityOverrun(
  activity: JournalActivity,
  now: Date = new Date(),
): CurrentActivityOverrun | null {
  if (
    !activity.actualStartAt ||
    activity.actualEndAt ||
    activity.completed
  ) {
    return null;
  }

  const plannedDurationMinutes = parseDurationToMinutes(
    activity.duration,
  );

  if (plannedDurationMinutes <= 0) {
    return null;
  }

  const startTime = new Date(activity.actualStartAt).getTime();

  if (!Number.isFinite(startTime)) {
    return null;
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - startTime) / 60000),
  );

  const overrunMinutes = Math.max(
    0,
    elapsedMinutes - plannedDurationMinutes,
  );

  const expectedFinishAt = new Date(
    startTime + plannedDurationMinutes * 60000,
  ).toISOString();

  return {
    activityId: activity.id,
    title: activity.title,
    plannedDurationMinutes,
    elapsedMinutes,
    overrunMinutes,
    overdue: overrunMinutes > 0,
    expectedFinishAt,
  };
}