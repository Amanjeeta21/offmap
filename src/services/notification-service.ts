import * as Notifications from "expo-notifications";

import type {
    JournalActivity,
    JournalDay,
    TravelJournal,
} from "@/context/journal-context";

const REMINDER_MINUTES = 5;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Kept as an exported function so existing imports continue to work.
// Custom Android channel creation is intentionally avoided in Expo Go.
export async function initializeNotifications(): Promise<void> {
  return;
}

export async function requestNotificationPermission(): Promise<boolean> {
  await initializeNotifications();

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.granted) {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();

  return requestedPermission.granted;
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

  const timeMatch = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());

  if (!timeMatch) return null;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();

  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;

    if (meridiem === "AM" && hours === 12) {
      hours = 0;
    } else if (meridiem === "PM" && hours !== 12) {
      hours += 12;
    }
  } else if (hours > 23) {
    return null;
  }

  const scheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    scheduledDate.getFullYear() !== year ||
    scheduledDate.getMonth() !== month - 1 ||
    scheduledDate.getDate() !== day
  ) {
    return null;
  }

  return scheduledDate;
}

type ActivityReminder = {
  journal: TravelJournal;
  day: JournalDay;
  activity: JournalActivity;
};

async function cancelExistingActivityReminders(): Promise<void> {
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  const offmapReminders = scheduledNotifications.filter(
    (notification) =>
      notification.content.data?.offmapActivityReminder === true,
  );

  await Promise.all(
    offmapReminders.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );
}

async function rebuildActivityReminders(
  journals: TravelJournal[],
): Promise<void> {
  const reminders: ActivityReminder[] = [];

  journals.forEach((journal) => {
    // Sample journals are demonstrations, not real user itineraries.
    if (journal.isSample) return;

    journal.days.forEach((day) => {
      day.activities.forEach((activity) => {
        if (activity.completed || activity.actualEndAt) return;

        const scheduledDate = getScheduledActivityDate(day.date, activity.time);

        if (!scheduledDate) return;

        const reminderDate = new Date(
          scheduledDate.getTime() - REMINDER_MINUTES * 60 * 1000,
        );

        // Do not schedule reminders whose five-minute warning
        // time has already passed.
        if (reminderDate.getTime() <= Date.now()) return;

        reminders.push({ journal, day, activity });
      });
    });
  });

  // Remove previous OFFMAP reminders before rebuilding them.
  await cancelExistingActivityReminders();

  if (reminders.length === 0) return;

  const permissionGranted = await requestNotificationPermission();

  if (!permissionGranted) return;

  for (const reminder of reminders) {
    const scheduledDate = getScheduledActivityDate(
      reminder.day.date,
      reminder.activity.time,
    );

    if (!scheduledDate) continue;

    const reminderDate = new Date(
      scheduledDate.getTime() - REMINDER_MINUTES * 60 * 1000,
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your activity starts in 5 minutes!",
        body: `${reminder.activity.title} starts at ${reminder.activity.time}. Get ready!`,
        data: {
          offmapActivityReminder: true,
          journalId: reminder.journal.id,
          dayId: reminder.day.id,
          activityId: reminder.activity.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  }
}

let reminderSyncQueue: Promise<void> = Promise.resolve();

export function syncActivityReminders(
  journals: TravelJournal[],
): Promise<void> {
  reminderSyncQueue = reminderSyncQueue
    .catch((error) => {
      console.error("Previous reminder synchronization failed:", error);
    })
    .then(() => rebuildActivityReminders(journals))
    .catch((error) => {
      console.error("Could not synchronize activity reminders:", error);
    });

  return reminderSyncQueue;
}
