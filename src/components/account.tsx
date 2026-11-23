import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { getExactAlarmPermissionsAsync, requestExactAlarmPermissionsAsync } from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { type ActivityMemory, type MemoryPhoto, type TravelJournal, useJournals } from "@/context/journal-context";
import { getTimeInMinutes } from "@/services/replanning/trip-optimizer";

const PROFILE_KEY = "@offmap/user-profile";

// ------------------------------------------
// Profile Types
// ------------------------------------------

type UserProfile = {
  name: string;
  dateOfBirth: string;
  photo?: MemoryPhoto;
};

const EMPTY_PROFILE: UserProfile = {
  name: "",
  dateOfBirth: "",
};

// ------------------------------------------
// Travel quotes
// ------------------------------------------

type TravelQuote = {
  quote: string;
  author: string;
};

let quoteRequest: Promise<TravelQuote[]> | undefined;

const FALLBACK_QUOTES: TravelQuote[] = [
  {
    quote: "Life is meant for great adventures and unforgettable journeys.",
    author: "OFFMAP",
  },
  {
    quote: "Collect moments, explore places, and make memories.",
    author: "OFFMAP",
  },
  {
    quote: "There is always another destination waiting to be discovered.",
    author: "OFFMAP",
  },
  {
    quote: "The best journeys take us beyond the familiar.",
    author: "OFFMAP",
  },
  {
    quote: "Let your curiosity lead you to places you've never imagined.",
    author: "OFFMAP",
  },
];

const TRAVEL_KEYWORDS = [
  "travel",
  "journey",
  "adventure",
  "explore",
  "wander",
  "destination",
  "world",
  "trip",
  "travelling",
  "traveling",
  "discover",
  "young",
  "life",
  "road",
  "places",
  "journeys",
  "adventures",
  "experience",
  "freedom",
  "nature",
];

function getTravelQuotes(): Promise<TravelQuote[]> {
  quoteRequest ??= (async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_QUOTES_API_URL;
      if (!apiUrl) return FALLBACK_QUOTES;

      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        throw new Error("Unable to fetch quotes.");
      }

      const data = await response.json();

      const quotes: Partial<TravelQuote>[] = Array.isArray(data?.quotes) ? data.quotes : [];

      const travelQuotes = quotes.filter((item): item is TravelQuote => {
        if (typeof item?.quote !== "string" || !item.quote.trim() ||
            typeof item.author !== "string" || !item.author.trim()) return false;
        const quoteText = item.quote.toLowerCase();

        return TRAVEL_KEYWORDS.some((keyword) => quoteText.includes(keyword));
      });

      return travelQuotes.length ? travelQuotes : FALLBACK_QUOTES;
    } catch (error) {
      console.log("Quote fetching failed:", error);

      return FALLBACK_QUOTES;
    }
  })();

  return quoteRequest;
}

// ------------------------------------------
// Date Formatting
// ------------------------------------------

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

type VisitCount = { name: string; count: number };

function cleanLabel(value?: string) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

function addVisits(places: Map<string, VisitCount>, label: string, count = 1) {
  const name = cleanLabel(label);
  if (!name) return;
  const key = name.normalize("NFKC").replace(/\s*,\s*/gu, ", ").replace(/[.,]+$/u, "").toLowerCase();
  const entry = places.get(key);
  if (entry) entry.count += count;
  else places.set(key, { name, count });
}

function rankVisits(places: Map<string, VisitCount>) {
  return [...places.values()].sort(
    (first, second) => second.count - first.count || first.name.localeCompare(second.name),
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

type DailyActivity = { completed: number; trackedMinutes: number };

const EMPTY_ACTIVITY: DailyActivity = { completed: 0, trackedMinutes: 0 };
const WEEK_LENGTH = 7;

function getDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatTrackedTime(minutes: number) {
  const total = Math.ceil(minutes);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getTravelStatistics(journals: TravelJournal[]) {
  const destinations = new Set<string>();
  const destinationVisits = new Map<string, VisitCount>();
  const placeVisits = new Map<string, VisitCount>();
  const priorities = new Map<string, VisitCount>();
  const upcomingTimes: number[] = [];
  const dailyActivity = new Map<string, DailyActivity>();
  let trips = 0;
  let travelDays = 0;
  let totalActivities = 0;
  let completed = 0;
  let longestTrip: { title: string; days: number } | undefined;
  let mostActiveDay: { title: string; date: string; trip: string; completed: number } | undefined;

  for (const journal of journals) {
    trips += 1;
    travelDays += journal.days.length;
    const title = cleanLabel(journal.title) || "Untitled trip";
    const destination = cleanLabel(journal.destination);
    if (destination) destinations.add(destination.toLowerCase());
    if (journal.days.length > (longestTrip?.days ?? 0)) {
      longestTrip = { title, days: journal.days.length };
    }

    let tripCompleted = 0;
    for (const day of journal.days) {
      totalActivities += day.activities.length;
      let dayCompleted = 0;
      for (const activity of day.activities) {
        if (activity.priority) addVisits(priorities, activity.priority);
        if (activity.completed) {
          dayCompleted += 1;
          addVisits(placeVisits, activity.plannedAlternative?.name ?? activity.location);

          const finished = new Date(activity.actualEndAt ?? "");
          const started = new Date(activity.actualStartAt ?? "");
          const elapsed = (finished.getTime() - started.getTime()) / 60_000;
          const key = Number.isFinite(finished.getTime()) ? getDayKey(finished) : day.date;
          if (key) {
            const entry = dailyActivity.get(key) ?? { ...EMPTY_ACTIVITY };
            entry.completed += 1;
            if (Number.isFinite(elapsed) && elapsed > 0) entry.trackedMinutes += elapsed;
            dailyActivity.set(key, entry);
          }
        } else if (!activity.actualStartAt && !activity.actualEndAt && typeof activity.time === "string") {
          const minutes = getTimeInMinutes(activity.time);
          if (minutes === null) continue;
          const scheduled = new Date(`${day.date}T00:00:00`);
          if (!Number.isFinite(scheduled.getTime())) continue;
          upcomingTimes.push(scheduled.setMinutes(minutes));
        }
      }

      tripCompleted += dayCompleted;
      if (dayCompleted > (mostActiveDay?.completed ?? 0)) {
        mostActiveDay = {
          title: cleanLabel(day.title) || "Travel day",
          date: cleanLabel(day.date),
          trip: title,
          completed: dayCompleted,
        };
      }
    }

    completed += tripCompleted;
    if (tripCompleted) {
      addVisits(destinationVisits, destination, tripCompleted);
    }
  }

  return {
    trips,
    travelDays,
    totalActivities,
    completed,
    upcomingTimes,
    dailyActivity,
    completionRate: totalActivities ? Math.round(completed / totalActivities * 100) : null,
    destinations: destinations.size,
    placesVisited: placeVisits.size,
    mostVisitedPlaces: rankVisits(placeVisits).slice(0, 5),
    mostVisitedDestination: rankVisits(destinationVisits)[0],
    mostCommonPriority: rankVisits(priorities)[0],
    longestTrip,
    mostActiveDay,
  };
}

function ActivityChart({ activity, currentTime, sample }: {
  activity: ReadonlyMap<string, DailyActivity>;
  currentTime: number;
  sample: boolean;
}) {
  const [metric, setMetric] = useState<keyof DailyActivity>("completed");
  const [weeksBack, setWeeksBack] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string>();

  const days = useMemo(() => {
    const latestSampleDay = sample ? [...activity.keys()].sort().at(-1) : undefined;
    const start = latestSampleDay ? new Date(`${latestSampleDay}T12:00:00`) : new Date(currentTime);
    start.setDate(start.getDate() - ((start.getDay() + 6) % WEEK_LENGTH) - WEEK_LENGTH * weeksBack);
    return Array.from({ length: WEEK_LENGTH }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      const key = getDayKey(date);
      return { key, date, data: activity.get(key) ?? EMPTY_ACTIVITY };
    });
  }, [activity, currentTime, sample, weeksBack]);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const dateRange = `${firstDay.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastDay.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const hasEarlier = [...activity.keys()].some((key) => key < firstDay.key);
  const focus = days.find((day) => day.key === selectedDay);
  const isTime = metric === "trackedMinutes";
  const total = days.reduce((sum, day) => sum + day.data[metric], 0);
  const value = focus?.data[metric] ?? total;
  const highest = Math.max(...days.map((day) => day.data[metric]));
  const axisStep = Math.max(1, Math.ceil(highest / 2));
  const axisLabel = (value: number) => isTime ? formatTrackedTime(value) : String(value);
  const weekdayName = (date: Date) => date.toLocaleDateString(undefined, { weekday: "short" });
  const accessibleDate = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const describeValue = (value: number) =>
    isTime ? `${formatTrackedTime(value)} tracked` : countLabel(value, "completed activity", "completed activities");

  function changeWeek(offset: number) {
    setWeeksBack((n) => Math.max(0, n + offset));
    setSelectedDay(undefined);
  }

  return (
    <View style={[styles.featureCard, styles.chartCard]}>
      <View style={styles.chartHeader}>
        <View style={styles.featureContent}>
          <Text accessibilityRole="header" style={styles.chartTitle}>Activity by day</Text>
          {sample ? <Text style={styles.featureDescription}>Sample trip data</Text> : null}
        </View>
        <View style={styles.weekControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            disabled={!hasEarlier}
            onPress={() => changeWeek(1)}
            style={styles.weekControl}
          >
            <Ionicons name="chevron-back" size={18} color={hasEarlier ? Colors.primary : Colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            disabled={weeksBack === 0}
            onPress={() => changeWeek(-1)}
            style={styles.weekControl}
          >
            <Ionicons name="chevron-forward" size={18} color={weeksBack ? Colors.primary : Colors.muted} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.featureDescription}>{dateRange}</Text>

      <View style={styles.chartTabs}>
        {([{ key: "completed", label: "Completed" }, { key: "trackedMinutes", label: "Tracked time" }] as const)
          .map(({ key, label }) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              aria-selected={metric === key}
              onPress={() => setMetric(key)}
              style={[styles.chartTab, metric === key && styles.selectedChartTab]}
            >
              <Text style={[styles.chartTabText, metric === key && styles.selectedChartTabText]}>{label}</Text>
            </Pressable>
          ))}
      </View>

      <View aria-live="polite" style={styles.chartReadout}>
        <Text style={styles.chartReadoutValue}>{describeValue(value)}</Text>
        <Text style={styles.featureDescription}>{focus ? accessibleDate(focus.date) : "Selected week"}</Text>
      </View>

      <View style={styles.chartBody}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.chartScale}>
          {[axisStep * 2, axisStep, 0].map((tick) => (
            <Text key={tick} style={styles.axisLabel}>{axisLabel(tick)}</Text>
          ))}
        </View>
        <View style={styles.chartColumns}>
          <View pointerEvents="none" style={styles.chartGrid}>
            {[0, 1, 2].map((line) => <View key={line} style={styles.chartGridLine} />)}
          </View>
          {days.map(({ key, date, data }) => {
            const amount = data[metric];
            const selected = focus?.key === key;
            const height = `${amount / (axisStep * 2) * 100}%` as const;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${accessibleDate(date)}, ${describeValue(amount)}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedDay(selected ? undefined : key)}
                style={styles.chartColumn}
              >
                <View style={[styles.barTrack, selected && styles.selectedBarTrack]}>
                  {amount > 0 && (
                    <View style={[styles.chartBar, isTime && styles.timeChartBar, selected && styles.selectedChartBar, { height }]} />
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.axisLabel, selected && styles.selectedAxisLabel]}>
                  {weekdayName(date)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {highest === 0 ? (
        <Text style={styles.featureDescription}>
          {isTime ? "No activity time was recorded this week." : "No activities were completed this week."}
        </Text>
      ) : null}
    </View>
  );
}

type MemoryVisit = {
  key: string;
  journalId: string;
  dayId: string;
  activityId: string;
  title: string;
  location: string;
  journalTitle: string;
  isSample: boolean;
  visitedAt: number;
  memory?: ActivityMemory;
};

function getMemoryVisits(journals: TravelJournal[]): MemoryVisit[] {
  return journals.flatMap((journal) =>
    journal.days.flatMap((day) =>
      day.activities.flatMap((activity): MemoryVisit[] => {
        const location = cleanLabel(activity.plannedAlternative?.name ?? activity.location);
        if (!activity.memory && (!activity.completed || !location)) return [];
        const finished = Date.parse(activity.actualEndAt ?? "");
        const scheduled = Date.parse(`${day.date}T00:00:00`);

        return [{
          key: JSON.stringify([journal.id, day.id, activity.id]),
          journalId: journal.id,
          dayId: day.id,
          activityId: activity.id,
          title: activity.title,
          location: location || cleanLabel(activity.title) || "Saved memory",
          journalTitle: cleanLabel(journal.title) || "Untitled trip",
          isSample: journal.isSample,
          visitedAt: Number.isFinite(finished) ? finished : Number.isFinite(scheduled) ? scheduled : 0,
          memory: activity.memory,
        }];
      }),
    ),
  ).sort((first, second) => second.visitedAt - first.visitedAt);
}

function memoryDetails(visit: MemoryVisit) {
  const trip = visit.isSample ? `${visit.journalTitle} (sample trip)` : visit.journalTitle;
  if (!visit.visitedAt) return trip;
  const date = new Date(visit.visitedAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  return `${trip} · ${date}`;
}

type PhotoFolder = "memories" | "profile";

function photoDirectory(folder: PhotoFolder) {
  return new Directory(Paths.document, folder);
}

function photoUri(photo: MemoryPhoto, folder: PhotoFolder = "memories") {
  return "dataUri" in photo ? photo.dataUri : new File(photoDirectory(folder), photo.fileName).uri;
}

async function storePhoto(
  asset: ImagePicker.ImagePickerAsset,
  folder: PhotoFolder = "memories",
): Promise<MemoryPhoto> {
  if (Platform.OS === "web") {
    // Resize before saving to keep images small enough for browser storage.
    const image = new globalThis.Image();
    image.src = asset.uri;
    await image.decode();
    const maxSize = folder === "profile" ? 480 : 1200;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const drawing = canvas.getContext("2d");
    if (!drawing) throw new Error("This browser couldn't prepare your photo.");
    drawing.fillStyle = "#FFFFFF";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUri: canvas.toDataURL("image/jpeg", 0.76) };
  }

  const directory = photoDirectory(folder);
  directory.create({ idempotent: true, intermediates: true });
  const extension = (asset.fileName ?? asset.uri).match(/\.(?:jpe?g|png|webp|heic|heif|gif|avif|bmp)(?=[?#]|$)/i)?.[0] ?? ".jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const destination = new File(directory, fileName);
  try {
    await new File(asset.uri).copy(destination);
    return { fileName };
  } catch {
    removePhoto({ fileName }, folder);
    throw new Error("Couldn't copy your photo into OFFMAP storage. Choose the photo again.");
  }
}

function removePhoto(photo?: MemoryPhoto, folder: PhotoFolder = "memories") {
  if (!photo || !("fileName" in photo) || Platform.OS === "web") return;
  try {
    const file = new File(photoDirectory(folder), photo.fileName);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn("Could not remove the old photo:", error);
  }
}

function MemoriesSection() {
  const router = useRouter();
  const { journals, isLoading, saveActivityMemory } = useJournals();
  const visits = useMemo(() => getMemoryVisits(journals), [journals]);
  const hasRealVisits = visits.some((visit) => !visit.isSample);
  const available = visits.filter((visit) => !visit.memory && (!hasRealVisits || !visit.isSample));
  const memories = visits.filter((visit) => !!visit.memory);
  const [editor, setEditor] = useState<{ selectedKey?: string; editing: boolean }>();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState("");
  const selected = visits.find((visit) => visit.key === editor?.selectedKey);
  const busy = saving || picking;

  const pickedUri = photo?.uri;
  useEffect(() => {
    if (Platform.OS !== "web" || !pickedUri?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(pickedUri);
  }, [pickedUri]);

  function openEditor(visit?: MemoryVisit) {
    setEditor({ selectedKey: visit?.key, editing: Boolean(visit?.memory) });
    setPhoto(undefined);
    setNote(visit?.memory?.note ?? "");
    setConfirmDelete(false);
    setMessage("");
  }

  function closeEditor() {
    if (busy) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    setEditor(undefined);
    setPhoto(undefined);
  }

  async function pickPhoto(camera = false) {
    if (busy) return;
    setMessage("");
    setPicking(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setMessage("Allow camera access in your device settings to take a photo.");
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.75 };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch {
      setMessage("Couldn't open the photo picker. Try again.");
    } finally {
      setPicking(false);
    }
  }

  async function saveMemory(deleting = false) {
    if (!selected || busy || (!deleting && !photo && !selected.memory)) return;
    let newPhoto: MemoryPhoto | undefined;
    setSaving(true);
    setMessage("");
    try {
      if (!deleting && photo) newPhoto = await storePhoto(photo);
      const savedPhoto = newPhoto ?? selected.memory?.photo;
      const memory = !deleting && savedPhoto ? { photo: savedPhoto, note: note.trim() || undefined } : undefined;
      const replacedPhoto = await saveActivityMemory(selected.journalId, selected.dayId, selected.activityId, memory);
      if (deleting || newPhoto) removePhoto(replacedPhoto);
      setEditor(undefined);
      setPhoto(undefined);
      setMessage(deleting ? "Memory deleted." : "Memory saved.");
    } catch (error) {
      removePhoto(newPhoto);
      setMessage(error instanceof Error && error.message ? error.message : "Couldn't save this memory. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const editorImage = photo?.uri ?? (selected?.memory ? photoUri(selected.memory.photo) : undefined);

  return (
    <View style={styles.section}>
      <View style={styles.chartHeader}>
        <Text accessibilityRole="header" style={styles.sectionLabel}>MEMORIES</Text>
        <Pressable accessibilityRole="button" onPress={() => openEditor()} style={styles.memoryAction}>
          <Text style={styles.editButtonText}>+ ADD MEMORY</Text>
        </Pressable>
      </View>
      {!editor && message ? <Text aria-live="polite" style={styles.featureDescription}>{message}</Text> : null}

      {isLoading || !memories.length ? (
        <View style={styles.featureCard}>
          <Text style={styles.emptyFeature}>
            {isLoading ? "Opening your journals..." : available.length
              ? `Choose a completed ${hasRealVisits ? "activity" : "sample activity"} and add a photo.`
              : "Complete an activity at a place and add a photo to start your travel memories."}
          </Text>
        </View>
      ) : (
        memories.map((visit) => visit.memory && (
          <View key={visit.key} style={[styles.featureCard, styles.memoryCard]}>
            <Image
              accessibilityLabel={`Travel photo of ${visit.location}`}
              source={{ uri: photoUri(visit.memory.photo) }}
              resizeMode="cover"
              style={styles.memoryCover}
            />
            <View style={styles.memoryCardContent}>
              <Text style={styles.chartTitle}>{visit.location}</Text>
              <Text style={styles.featureDescription}>{memoryDetails(visit)}</Text>
              {visit.memory.note ? <Text style={styles.memoryNote}>{visit.memory.note}</Text> : null}
              <View style={styles.chartHeader}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.memoryAction}
                  onPress={() => router.push({ pathname: "/journal/[id]", params: { id: visit.journalId } })}
                >
                  <Text style={styles.cancelText}>Open trip</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit memory of ${visit.location}`}
                  style={styles.memoryAction}
                  onPress={() => openEditor(visit)}
                >
                  <Text style={styles.editButtonText}>EDIT MEMORY</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}

      <Modal visible={Boolean(editor)} onRequestClose={closeEditor} animationType="fade">
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.memoryEditor} keyboardShouldPersistTaps="handled">
              <View style={styles.chartHeader}>
                <Text accessibilityRole="header" style={styles.chartTitle}>
                  {confirmDelete ? "Delete memory?" : editor?.editing ? "Edit memory" : "Add memory"}
                </Text>
                {!confirmDelete ? (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={closeEditor} style={styles.memoryAction}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
              {confirmDelete ? (
                <>
                  <Text style={styles.memoryNote}>
                    Delete the photo and caption for {selected?.location}?
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={closeEditor} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>Keep memory</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => saveMemory(true)} style={styles.saveButton}>
                      <Text style={styles.saveText}>{saving ? "Deleting..." : "Delete memory"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : editor && !editor.editing && !selected ? (
                available.length ? (
                  <>
                    <Text style={styles.memoryNote}>Choose a completed activity.</Text>
                    <View style={styles.featureCard}>
                      {available.map((visit, index) => (
                        <Pressable
                          key={visit.key}
                          accessibilityRole="button"
                          onPress={() => setEditor({ selectedKey: visit.key, editing: false })}
                          style={[styles.featureRow, index > 0 && styles.featureDivider]}
                        >
                          <View style={styles.featureContent}>
                            <Text style={styles.featureTitle}>{visit.location}</Text>
                            <Text style={styles.featureDescription}>{visit.title} / {memoryDetails(visit)}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.memoryNote}>
                    {isLoading ? "Opening your journals..." : memories.length
                      ? "Your completed places already have memories. Complete another activity with a location to add more."
                      : "Complete an activity with a saved location to add your first memory."}
                  </Text>
                )
              ) : selected ? (
                <>
                  <View>
                    <Text style={styles.chartTitle}>{selected.location}</Text>
                    <Text style={styles.featureDescription}>{memoryDetails(selected)}</Text>
                  </View>
                  {editorImage ? (
                    <Image accessibilityLabel="Selected memory photo" source={{ uri: editorImage }} resizeMode="cover" style={styles.memoryEditorImage} />
                  ) : null}
                  <View style={styles.memoryPhotoActions}>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => pickPhoto()} style={styles.memoryAction}>
                      <Text style={styles.editButtonText}>{editorImage ? "CHANGE PHOTO" : "CHOOSE PHOTO"}</Text>
                    </Pressable>
                    {Platform.OS !== "web" ? (
                      <Pressable accessibilityRole="button" disabled={busy} onPress={() => pickPhoto(true)} style={styles.memoryAction}>
                        <Text style={styles.editButtonText}>TAKE PHOTO</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CAPTION (OPTIONAL)</Text>
                    <TextInput
                      accessibilityLabel="Memory caption"
                      editable={!busy}
                      value={note}
                      onChangeText={setNote}
                      maxLength={240}
                      placeholder="What do you remember about this place?"
                      placeholderTextColor={Colors.muted}
                      style={[styles.input, styles.memoryCaption]}
                      multiline
                    />
                  </View>
                  <View style={styles.chartHeader}>
                    {editor?.editing ? (
                      <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)} style={styles.memoryAction}>
                        <Text style={styles.editButtonText}>DELETE MEMORY</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => {
                          setEditor({ editing: false });
                          setPhoto(undefined);
                          setNote("");
                          setMessage("");
                        }}
                        style={styles.memoryAction}
                      >
                        <Text style={styles.cancelText}>Change activity</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || !editorImage}
                      onPress={() => saveMemory()}
                      style={[styles.saveButton, (busy || !editorImage) && styles.disabledMemoryAction]}
                    >
                      <Text style={styles.saveText}>{saving ? "Saving..." : "Save memory"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.memoryNote}>This activity is no longer available.</Text>
              )}
              {message ? <Text aria-live="polite" style={styles.memoryNote}>{message}</Text> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ------------------------------------------
// Account Screen
// ------------------------------------------

export default function AccountScreen() {
  const { journals, isLoading: isLoadingJournals } = useJournals();
  const realStatistics = useMemo(() => getTravelStatistics(journals.filter((trip) => !trip.isSample)), [journals]);
  const sampleStatistics = useMemo(() => getTravelStatistics(journals.filter((trip) => trip.isSample)), [journals]);
  const showingSampleTotals = !realStatistics.trips && sampleStatistics.trips > 0;
  const showingSampleVisits = !realStatistics.completed && sampleStatistics.completed > 0;
  const statistics = showingSampleTotals ? sampleStatistics : realStatistics;
  const visitStatistics = showingSampleVisits ? sampleStatistics : realStatistics;
  const [currentTime, setCurrentTime] = useState(Date.now);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<UserProfile>(EMPTY_PROFILE);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);
  const quoteDay = Math.floor(Date.parse(getDayKey(new Date(currentTime))) / 86_400_000);
  const dailyQuote = quotes[quoteDay % quotes.length];
  const [exactReminders, setExactReminders] = useState<boolean>();
  const [reminderMessage, setReminderMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      setCurrentTime(Date.now());
      if (Platform.OS === "android") {
        getExactAlarmPermissionsAsync()
          .then(({ granted }) => setExactReminders(granted))
          .catch(() => setExactReminders(false));
      }
      const timer = setInterval(() => setCurrentTime(Date.now()), 60_000);
      return () => clearInterval(timer);
    }, []),
  );

  const upcoming = useMemo(
    () => statistics.upcomingTimes.filter((time) => time >= currentTime).length,
    [statistics.upcomingTimes, currentTime],
  );
  const completion = statistics.completionRate === null ? null : `${statistics.completionRate}%`;
  const metrics = [
    { label: "Total Trips", value: statistics.trips },
    { label: "Total Travel Days", value: statistics.travelDays },
    { label: "Completed Activities", value: statistics.completed },
    { label: "Activities", value: statistics.totalActivities },
    { label: "Upcoming Activities", value: upcoming },
    { label: "Destinations", value: statistics.destinations },
    { label: "Places Visited", value: statistics.placesVisited },
  ];
  const { mostVisitedDestination, longestTrip, mostActiveDay, mostCommonPriority } = visitStatistics;
  const highestVisitCount = visitStatistics.mostVisitedPlaces[0]?.count ?? 1;
  const insights = [
    {
      label: "Most visited destination",
      value: mostVisitedDestination &&
        `${mostVisitedDestination.name} / ${countLabel(mostVisitedDestination.count, "completed activity", "completed activities")}`,
    },
    {
      label: "Longest trip",
      value: longestTrip && `${longestTrip.title} / ${countLabel(longestTrip.days, "day")}`,
    },
    {
      label: "Most active travel day",
      value: mostActiveDay &&
        `${mostActiveDay.title}, ${mostActiveDay.trip}${mostActiveDay.date ? ` (${mostActiveDay.date})` : ""} / ${countLabel(mostActiveDay.completed, "completed activity", "completed activities")}`,
    },
    { label: "Most common priority", value: mostCommonPriority?.name },
    {
      label: "Activity completion",
      value: visitStatistics.completionRate !== null &&
        `${visitStatistics.completed} of ${visitStatistics.totalActivities} activities (${visitStatistics.completionRate}%)`,
    },
    { label: "Total travel days", value: visitStatistics.trips ? countLabel(visitStatistics.travelDays, "day") : undefined },
  ].filter((insight) => insight.value);

  // Load saved profile.
  useEffect(() => {
    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(PROFILE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);

          const loadedProfile = {
            name: parsed.name ?? "",
            dateOfBirth: parsed.dateOfBirth ?? "",
            photo: parsed.photo,
          };

          setProfile(loadedProfile);
          setSavedProfile(loadedProfile);
        }
      } catch {
        setProfileMessage("Unable to load your profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    let isMounted = true;

    getTravelQuotes().then((quotes) => {
      if (isMounted) {
        setQuotes(quotes);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save profile.
  async function saveProfile() {
    if (isSavingProfile) return;
    if (!profile.name.trim()) {
      setProfileMessage("Please enter your name.");
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage("");
    try {
      const updatedProfile = {
        ...profile,
        name: profile.name.trim(),
      };

      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);
      setIsEditing(false);

      setProfileMessage("Your profile has been saved.");
    } catch {
      setProfileMessage("Unable to save your profile. Try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function updateProfilePhoto(removing = false) {
    if (isUpdatingPhoto || isSavingProfile || isEditing) return;
    setIsUpdatingPhoto(true);
    setProfileMessage("");
    let photo: MemoryPhoto | undefined;
    try {
      if (!removing) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.75,
        });
        if (result.canceled) return;
        photo = await storePhoto(result.assets[0], "profile");
      }
      const next = { ...savedProfile, photo };
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      removePhoto(savedProfile.photo, "profile");
      setProfile(next);
      setSavedProfile(next);
      setProfileMessage(removing ? "Profile photo removed." : "Profile photo saved.");
    } catch {
      removePhoto(photo, "profile");
      setProfileMessage("Unable to update your profile photo. Try again.");
    } finally {
      setIsUpdatingPhoto(false);
    }
  }

  function cancelEditing() {
    setProfileMessage("");
    setProfile(savedProfile);
    setIsEditing(false);
  }

  async function enablePreciseReminders() {
    setReminderMessage("");
    try {
      const { granted } = await requestExactAlarmPermissionsAsync();
      setExactReminders(granted);
      if (!granted) setReminderMessage("Reminders use approximate timing until exact alarms are allowed.");
    } catch {
      setReminderMessage("Exact alarms are unavailable in this app build.");
    }
  }

  // Profile initials.
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Opening your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}

          <View style={styles.header}>
            <Text style={styles.brand}>OFFMAP</Text>
            <Text style={styles.tagline}>YOUR PERSONAL TRAVEL SPACE</Text>
          </View>

          {/* Page Heading */}

          <View style={styles.pageHeading}>
            <Text style={styles.eyebrow}>BEHIND EVERY JOURNEY</Text>

            <Text style={styles.title}>
              The Traveller&apos;s{"\n"}
              <Text style={styles.titleAccent}>Corner.</Text>
            </Text>

            <Text style={styles.subtitle}>
              A little space dedicated to the person behind all your adventures.
            </Text>
          </View>

          {/* Profile */}

          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                {profile.photo ? (
                  <Image accessibilityLabel="Profile photo" source={{ uri: photoUri(profile.photo, "profile") }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials || "?"}</Text>
                )}
              </View>

              <View style={styles.profileIdentity}>
                <Text style={styles.profileLabel}>THE TRAVELLER</Text>

                <Text style={styles.profileName}>
                  {profile.name || "Your Name"}
                </Text>

                <Text style={styles.profileCaption}>Your OFFMAP identity</Text>
              </View>

              {!isEditing && (
                <Pressable
                  accessibilityRole="button"
                  disabled={isUpdatingPhoto}
                  onPress={() => {
                    setProfileMessage("");
                    setIsEditing(true);
                  }}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>EDIT</Text>
                </Pressable>
              )}
            </View>

            {!isEditing ? (
              <View style={styles.profilePhotoActions}>
                <Pressable accessibilityRole="button" disabled={isUpdatingPhoto} onPress={() => updateProfilePhoto()} style={[styles.memoryAction, styles.profilePhotoButton]}>
                  <Ionicons name="camera-outline" size={16} color={Colors.primary} />
                  <Text style={styles.editButtonText}>
                    {isUpdatingPhoto ? "Updating photo..." : profile.photo ? "Change profile photo" : "Add profile photo"}
                  </Text>
                </Pressable>
                {profile.photo ? (
                  <Pressable accessibilityRole="button" disabled={isUpdatingPhoto} onPress={() => updateProfilePhoto(true)} style={styles.memoryAction}>
                    <Text style={styles.cancelText}>Remove photo</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.divider} />

            {isEditing ? (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>

                  <TextInput
                    accessibilityLabel="Full name"
                    editable={!isSavingProfile}
                    value={profile.name}
                    onChangeText={(value) =>
                      setProfile((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                    placeholder="Enter your name"
                    placeholderTextColor={Colors.muted}
                    style={styles.input}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DATE OF BIRTH</Text>

                  <TextInput
                    accessibilityLabel="Date of birth"
                    editable={!isSavingProfile}
                    value={profile.dateOfBirth}
                    onChangeText={(value) =>
                      setProfile((current) => ({
                        ...current,
                        dateOfBirth: formatDateInput(value),
                      }))
                    }
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Colors.muted}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={10}
                  />

                  <Text style={styles.helperText}>
                    Enter 8 digits. Slashes are added automatically.
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.cancelButton}
                    disabled={isSavingProfile}
                    onPress={cancelEditing}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    style={styles.saveButton}
                    disabled={isSavingProfile}
                    onPress={saveProfile}
                  >
                    <Text style={styles.saveText}>{isSavingProfile ? "Saving..." : "Save Profile"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.details}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>FULL NAME</Text>

                  <Text style={styles.detailValue}>
                    {profile.name || "Not added yet"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DATE OF BIRTH</Text>

                  <Text style={styles.detailValue}>
                    {profile.dateOfBirth || "Not added yet"}
                  </Text>
                </View>
              </View>
            )}
            {profileMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.featureDescription}>
                {profileMessage}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionLabel}>TRAVEL STATISTICS</Text>
            <View style={styles.featureCard}>
              {isLoadingJournals ? (
                <Text style={styles.emptyFeature}>Opening your journals...</Text>
              ) : statistics.trips === 0 ? (
                <Text style={styles.emptyFeature}>
                  Start planning your first trip to see your travel statistics here.
                </Text>
              ) : (
                <>
                  <View style={styles.completion}>
                    {showingSampleTotals ? <Text style={styles.featureDescription}>Sample trip data</Text> : null}
                    <View style={styles.chartHeader}>
                      <Text style={styles.featureTitle}>Completion rate</Text>
                      {completion && <Text style={styles.visitCount}>{completion}</Text>}
                    </View>
                    <View
                      accessible={statistics.completionRate !== null}
                      accessibilityRole={completion ? "progressbar" : undefined}
                      accessibilityLabel={completion ? "Activity completion" : undefined}
                      aria-valuemin={completion ? 0 : undefined}
                      aria-valuemax={completion ? 100 : undefined}
                      aria-valuenow={statistics.completionRate ?? undefined}
                      style={styles.horizontalTrack}
                    >
                      <View style={[styles.horizontalFill, styles.completionFill, {
                        width: `${statistics.totalActivities ? statistics.completed / statistics.totalActivities * 100 : 0}%`,
                      }]} />
                    </View>
                    <Text style={styles.featureDescription}>
                      {statistics.totalActivities
                        ? `${statistics.completed} of ${statistics.totalActivities} activities completed`
                        : "No activities planned yet."}
                    </Text>
                  </View>
                  <View style={[styles.metrics, styles.featureDivider]}>
                    {metrics.map(({ label, value }) => (
                      <View key={label} style={styles.metric}>
                        <Text style={styles.metricValue}>{value}</Text>
                        <Text style={styles.featureDescription}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
            {!isLoadingJournals ? (
              <ActivityChart key={String(showingSampleVisits)} activity={visitStatistics.dailyActivity} currentTime={currentTime} sample={showingSampleVisits} />
            ) : null}
          </View>

          {!isLoadingJournals && (
            <>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionLabel}>MOST VISITED PLACES</Text>
                <View style={styles.featureCard}>
                  {showingSampleVisits ? <Text style={styles.emptyFeature}>Sample trip data</Text> : null}
                  {visitStatistics.mostVisitedPlaces.length ? (
                    visitStatistics.mostVisitedPlaces.map(({ name, count }, index) => (
                      <View key={name} style={[styles.insightRow, index > 0 && styles.featureDivider]}>
                        <View style={styles.chartHeader}>
                          <Text style={[styles.featureTitle, styles.featureContent]}>{name}</Text>
                          <Text style={styles.visitCount}>{countLabel(count, "visit")}</Text>
                        </View>
                        <View style={styles.horizontalTrack}>
                          <View style={[styles.horizontalFill, { width: `${count / highestVisitCount * 100}%` }]} />
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyFeature}>
                      {statistics.completed
                        ? "Add locations to your completed activities to see the places you visited."
                        : "Complete activities to start tracking the places you've visited."}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionLabel}>TRAVEL INSIGHTS</Text>
                <View style={styles.featureCard}>
                  {showingSampleVisits ? <Text style={styles.emptyFeature}>Sample trip data</Text> : null}
                  {insights.length ? (
                    insights.map(({ label, value }, index) => (
                      <View key={label} style={[styles.insightRow, index > 0 && styles.featureDivider]}>
                        <Text style={styles.featureDescription}>{label}</Text>
                        <Text style={styles.featureTitle}>{value}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyFeature}>Your insights will appear as you plan and complete trips.</Text>
                  )}
                </View>
              </View>
            </>
          )}

          <MemoriesSection />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>QUOTE OF THE DAY</Text>

            <View style={styles.quoteCard}>
              <Text style={styles.quoteMark}>“</Text>
              <Text style={styles.quoteText}>{dailyQuote.quote}</Text>
              <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR DEVICE</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="hardware-chip-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Platform</Text>
                <Text style={styles.infoDescription}>
                  {Platform.select({ android: "Android", ios: "iOS", web: "Web", default: Platform.OS })}
                </Text>
              </View>
            </View>
          </View>

          {Platform.OS === "android" && exactReminders === false ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACTIVITY REMINDERS</Text>
              <View style={styles.featureCard}>
                <Pressable accessibilityRole="button" onPress={enablePreciseReminders} style={styles.featureRow}>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Enable precise reminders</Text>
                    <Text style={styles.featureDescription}>Allow exact alarms for five-minute reminders.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </Pressable>
                {reminderMessage ? <Text style={styles.emptyFeature}>{reminderMessage}</Text> : null}
              </View>
            </View>
          ) : null}

          {/* App Version */}

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>OFFMAP · APP VERSION 1.0.0</Text>

            <Text style={styles.footer}>MADE FOR THE JOURNEY.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ------------------------------------------
// Styles
// ------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: Colors.secondary,
    fontSize: 13,
  },

  // Branding

  header: {
    alignItems: "center",
    gap: 5,
  },

  brand: {
    color: Colors.primary,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 6,
  },

  tagline: {
    color: Colors.secondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 2,
  },

  // Heading

  pageHeading: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  title: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 43,
    textAlign: "center",
  },

  titleAccent: {
    color: Colors.accent,
    fontStyle: "italic",
  },

  subtitle: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 280,
  },

  // Profile Card

  profileCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F2E5D9",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: Colors.accent,
    fontSize: 19,
    fontWeight: "800",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
  },

  profilePhotoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  profilePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },

  profileIdentity: {
    flex: 1,
    gap: 4,
  },

  profileLabel: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  profileName: {
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },

  profileCaption: {
    color: Colors.secondary,
    fontSize: 10,
  },

  editButton: {
    padding: 8,
  },

  editButtonText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  details: {
    gap: Spacing.lg,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
  },

  detailLabel: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  detailValue: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },

  // Profile Form

  form: {
    gap: Spacing.lg,
  },

  inputGroup: {
    gap: Spacing.sm,
  },

  inputLabel: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  input: {
    height: 48,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.primary,
    fontSize: 13,
  },

  helperText: {
    color: Colors.muted,
    fontSize: 10,
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },

  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  cancelText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  saveText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "700",
  },

  // General Sections

  section: {
    gap: Spacing.md,
  },

  sectionLabel: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
  },

  // Device Card

  infoCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    gap: 4,
  },

  infoTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  infoDescription: {
    color: Colors.secondary,
    fontSize: 10,
  },

  // Travel Features

  featureCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  featureContent: {
    flex: 1,
    gap: 4,
  },

  featureTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  featureDescription: {
    color: Colors.secondary,
    fontSize: 10,
  },

  featureDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  emptyFeature: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: Spacing.md,
  },

  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: Spacing.sm,
  },

  metric: {
    width: "50%",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
  },

  metricValue: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 22,
  },

  chartCard: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },

  chartTitle: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },

  weekControls: {
    flexDirection: "row",
  },

  weekControl: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  chartTabs: {
    flexDirection: "row",
    padding: 3,
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
  },

  chartTab: {
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
  },

  selectedChartTab: {
    backgroundColor: Colors.primary,
  },

  chartTabText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  selectedChartTabText: {
    color: Colors.white,
  },

  chartReadout: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },

  chartReadoutValue: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 21,
  },

  chartBody: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },

  chartScale: {
    width: 40,
    height: 112,
    justifyContent: "space-between",
  },

  axisLabel: {
    color: Colors.secondary,
    fontSize: 10,
  },

  selectedAxisLabel: {
    color: Colors.primary,
    fontWeight: "800",
  },

  chartColumns: {
    flex: 1,
    flexDirection: "row",
  },

  chartGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 112,
    justifyContent: "space-between",
  },

  chartGridLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  chartColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: Spacing.xs,
  },

  barTrack: {
    width: "72%",
    maxWidth: 32,
    height: 112,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderTopLeftRadius: Spacing.xs,
    borderTopRightRadius: Spacing.xs,
  },

  selectedBarTrack: {
    backgroundColor: Colors.background,
  },

  chartBar: {
    width: "100%",
    backgroundColor: Colors.accent,
    borderTopLeftRadius: Spacing.xs,
    borderTopRightRadius: Spacing.xs,
  },

  selectedChartBar: {
    backgroundColor: Colors.primary,
  },

  timeChartBar: {
    backgroundColor: Colors.success,
  },

  completion: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },

  horizontalTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },

  horizontalFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },

  completionFill: {
    backgroundColor: Colors.success,
  },

  visitCount: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
  },

  insightRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },

  memoryAction: {
    paddingVertical: Spacing.three,
    justifyContent: "center",
  },

  memoryCard: {
    paddingHorizontal: 0,
    overflow: "hidden",
  },

  memoryCover: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: Colors.background,
  },

  memoryCardContent: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },

  memoryNote: {
    color: Colors.primary,
    fontSize: 13,
    lineHeight: 19,
  },

  memoryEditor: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },

  memoryEditorImage: {
    width: "100%",
    maxHeight: 300,
    aspectRatio: 16 / 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },

  memoryPhotoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: Spacing.md,
  },

  memoryCaption: {
    minHeight: 74,
    paddingVertical: Spacing.sm,
    textAlignVertical: "top",
  },

  disabledMemoryAction: {
    opacity: 0.45,
  },

  // Compact Quote Card

  quoteCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },

  quoteMark: {
    color: "#E8C6A8",
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 34,
  },

  quoteText: {
    color: Colors.white,
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
  },

  quoteAuthor: {
    color: "#E8C6A8",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    marginTop: Spacing.xs,
  },

  // Footer

  versionContainer: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },

  versionText: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  footer: {
    color: Colors.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
