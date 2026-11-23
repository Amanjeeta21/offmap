import * as Notifications from "expo-notifications";
import { AndroidImportance, IosAuthorizationStatus } from "expo-notifications";
import { Platform } from "react-native";

import type { TravelJournal } from "@/context/journal-context";
import { getTimeInMinutes } from "@/services/replanning/trip-optimizer";

const REMINDER_MINUTES = 5;
const CHANNEL_ID = "activity-reminders";
const REMINDER_TITLE = "Upcoming activity";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Activity reminders",
      importance: AndroidImportance.HIGH,
      sound: "default",
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  await initializeNotifications();

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.granted ||
      currentPermission.ios?.status === IosAuthorizationStatus.PROVISIONAL) return true;
  if (!currentPermission.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export function getScheduledActivityDate(
  date: string,
  time: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());

  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const timeMinutes = getTimeInMinutes(time);
  if (timeMinutes === null) return null;
  const scheduledDate = new Date(year, month - 1, day, Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);

  if (
    scheduledDate.getFullYear() !== year ||
    scheduledDate.getMonth() !== month - 1 ||
    scheduledDate.getDate() !== day ||
    scheduledDate.getHours() * 60 + scheduledDate.getMinutes() !== timeMinutes
  ) {
    return null;
  }

  return scheduledDate;
}

async function reconcileActivityReminders(journals: TravelJournal[]): Promise<void> {
  const now = Date.now();
  const desired = new Map<string, {
    body: string;
    reminderAt: number;
    journalId: string;
    dayId: string;
    activityId: string;
  }>();
  for (const journal of journals) {
    if (journal.isSample) continue;
    for (const day of journal.days) {
      for (const activity of day.activities) {
        if (activity.completed || activity.actualStartAt || activity.actualEndAt) continue;
        const scheduled = getScheduledActivityDate(day.date, activity.time);
        if (!scheduled) continue;
        const reminderAt = scheduled.getTime() - REMINDER_MINUTES * 60_000;
        if (scheduled.getTime() <= now) continue;
        const { id: journalId } = journal;
        const { id: dayId } = day;
        const { id: activityId } = activity;
        const key = `offmap:activity:${JSON.stringify([journalId, dayId, activityId])}`;
        const body = `${activity.title} starts at ${activity.time}.`;
        desired.set(key, { body, reminderAt, journalId, dayId, activityId });
      }
    }
  }

  const notificationRequests = await Notifications.getAllScheduledNotificationsAsync();
  const hasFutureReminders = [...desired.values()].some((item) => item.reminderAt > now);
  const exact = Platform.OS === "android" && hasFutureReminders &&
    await Notifications.getExactAlarmPermissionsAsync().then(({ granted }) => granted).catch(() => false);
  for (const pending of notificationRequests) {
    const { content, identifier } = pending;
    if (content.data?.offmapActivityReminder !== true) continue;
    const reminder = desired.get(identifier);
    if (reminder && reminder.reminderAt === Number(content.data.reminderAt) &&
        content.title === REMINDER_TITLE && content.body === reminder.body &&
        (reminder.reminderAt <= now || content.data.exact === exact)) {
      desired.delete(identifier);
    } else {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch (error) {
        desired.delete(identifier);
        console.error("Could not cancel an activity reminder:", error);
      }
    }
  }

  if (![...desired.values()].some((item) => item.reminderAt > Date.now()) ||
      !await requestNotificationPermission()) return;

  const writes = await Promise.allSettled([...desired].map(async ([identifier, { body, ...reminder }]) => {
    // An activity saved within the five-minute window stays startable without a late reminder.
    if (reminder.reminderAt <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: REMINDER_TITLE,
        body,
        sound: "default",
        data: { ...reminder, offmapActivityReminder: true, exact },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.reminderAt),
        channelId: CHANNEL_ID,
        ...(exact ? { delivery: "alarmClock" as const } : {}),
      },
    });
  }));
  for (const write of writes) {
    if (write.status === "rejected") console.error("Could not schedule an activity reminder:", write.reason);
  }
}

let reminderSyncQueue: Promise<void> = Promise.resolve();

export function syncActivityReminders(
  journals: TravelJournal[],
): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  reminderSyncQueue = reminderSyncQueue
    .catch((error) => {
      console.error("Previous reminder synchronization failed:", error);
    })
    .then(() => reconcileActivityReminders(journals));

  return reminderSyncQueue;
}
