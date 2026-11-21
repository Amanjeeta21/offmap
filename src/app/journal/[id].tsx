import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { type JournalActivity, type Priority, type TravelJournal, useJournals } from "@/context/journal-context";
import { getCurrentLocation } from "@/services/location-service";
import { findNearbyLandmarks, type NearbyPlace } from "@/services/overpass-service";
import { parseDurationToMinutes } from "@/services/replanning/delay-detector";
import { replanJournalTrip } from "@/services/replanning/replanning-service";
import { getTimeInMinutes } from "@/services/replanning/trip-optimizer";
import type { TravelTimeData, TripActivityProposal, TripReplanningResult } from "@/types/replanning";

type DeadlineFormState = {
  hour: string;
  minute: string;
  period: "AM" | "PM";
  isEditing: boolean;
};

function getDeadlineFormState(day?: {
  returnDeadline?: string | null;
}): DeadlineFormState {
  if (!day?.returnDeadline) {
    return {
      hour: "09",
      minute: "00",
      period: "PM",
      isEditing: true,
    };
  }

  const [hours, minutes] = day.returnDeadline.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return {
    hour: String(displayHour).padStart(2, "0"),
    minute: String(minutes).padStart(2, "0"),
    period,
    isEditing: false,
  };
}

function getCurrentTime(now = new Date()): string {

  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function getCurrentDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTravel(travel: TravelTimeData) {
  const distance = travel.distanceMeters;
  const duration = `${travel.durationMinutes} min`;
  if (distance === undefined) return duration;
  return `${duration} / ${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}`;
}

const proposalLabels: Record<TripActivityProposal["status"], string> = {
  fixed: "Fixed",
  completed: "Completed (preserved)",
  "in-progress": "In progress (preserved)",
  past: "Past day (preserved)",
  scheduled: "",
  unscheduled: "Unscheduled",
};

export default function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    getJournal,
    isLoading,
    saveReplannedDays,
    updateActivity,
    addActivity,
    deleteActivity,
    startActivity,
    updateDayDeadline,
    updateAccommodationLocation,
  } = useJournals();

  const journal = getJournal(id);
  const days = journal?.days ?? [];

  const [selectedDay, setSelectedDay] = useState(0);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<NearbyPlace>();
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [hasLandmarkMapData, setHasLandmarkMapData] = useState(false);
  const [landmarkMessage, setLandmarkMessage] = useState<string>();
  const [isFindingLandmarks, setIsFindingLandmarks] = useState(false);
  const landmarkRequest = useRef(0);

  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [notes, setNotes] = useState("");

  const [showReplanTooltip, setShowReplanTooltip] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);

  const [showAccommodationEditor, setShowAccommodationEditor] = useState(false);
  const [accommodationInput, setAccommodationInput] = useState(
    () => journal?.accommodationLocation ?? "",
  );

  const [replanningPreview, setReplanningPreview] = useState<{
    result: TripReplanningResult;
    journal: TravelJournal;
    date: string;
  } | null>(null);
  const replanningResult = replanningPreview?.result;
  const replanningSnapshot = replanningPreview?.journal;
  const showReplanningPreview = Boolean(replanningPreview);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedPlan, setSavedPlan] = useState(false);

  const safeSelectedDay =
    days.length === 0 ? 0 : Math.min(selectedDay, days.length - 1);
  const day = days[safeSelectedDay];

  const initialDeadline = getDeadlineFormState(days[0]);
  const [deadlineHour, setDeadlineHour] = useState(initialDeadline.hour);
  const [deadlineMinute, setDeadlineMinute] = useState(initialDeadline.minute);
  const [deadlinePeriod, setDeadlinePeriod] = useState<"AM" | "PM">(
    initialDeadline.period,
  );
  const [isEditingDeadline, setIsEditingDeadline] = useState(
    initialDeadline.isEditing,
  );

  function syncDeadlineFromDay(nextDay?: { returnDeadline?: string | null }) {
    const nextDeadline = getDeadlineFormState(nextDay);

    setDeadlineHour(nextDeadline.hour);
    setDeadlineMinute(nextDeadline.minute);
    setDeadlinePeriod(nextDeadline.period);
    setIsEditingDeadline(nextDeadline.isEditing);
  }

  function handleSelectDay(index: number) {
    setSelectedDay(index);
    closeActivityForm();
    syncDeadlineFromDay(days[index]);
    setReplanningPreview(null);
  }

  if (!journal) {
    return (
      <SafeAreaView style={styles.container}>
        {isLoading ? <ActivityIndicator color={Colors.primary} /> : (
          <Text style={styles.error}>Journal not found.</Text>
        )}
      </SafeAreaView>
    );
  }

  const currentJournal = journal;
  const currentJournalId = currentJournal.id;
  function openActivityForm(activity?: JournalActivity) {
    landmarkRequest.current += 1;
    setEditingActivityId(activity?.id ?? null);
    setTime(activity?.time ?? "");
    setTitle(activity?.title ?? "");
    setLocation(activity?.location ?? "");
    setDuration(activity?.duration ?? "");
    setPriority(activity?.priority ?? "Medium");
    setNotes(activity?.notes ?? "");
    setLandmark(activity?.nearestLandmark);
    setNearbyPlaces([]);
    setHasLandmarkMapData(false);
    setLandmarkMessage(undefined);
    setIsFindingLandmarks(false);
    setShowAddActivity(true);
  }

  function closeActivityForm() {
    landmarkRequest.current += 1;
    setShowAddActivity(false);
  }

  async function handleFindLandmarks() {
    const request = ++landmarkRequest.current;
    setIsFindingLandmarks(true);
    setLandmarkMessage(undefined);
    setNearbyPlaces([]);
    setHasLandmarkMapData(false);
    try {
      const position = await getCurrentLocation(true);
      if (request !== landmarkRequest.current) return;
      if (position.accuracy === null || !Number.isFinite(position.accuracy) || position.accuracy > 50) {
        setLandmarkMessage("GPS accuracy is too low. Move to an open area or enable precise location, then try again.");
        return;
      }
      const results = await findNearbyLandmarks(position);
      if (request !== landmarkRequest.current) return;
      setNearbyPlaces(results.places);
      setHasLandmarkMapData(results.hasMapData);
      setLandmarkMessage(results.message);
    } catch (error) {
      if (request === landmarkRequest.current) {
        setLandmarkMessage(error instanceof Error ? error.message : "Location is unavailable. Try again.");
      }
    } finally {
      if (request === landmarkRequest.current) setIsFindingLandmarks(false);
    }
  }

  function handleSaveActivity() {
    if (!day) return;
    const existing = day.activities.find((item) => item.id === editingActivityId);
    if (editingActivityId && !existing) return;
    if (!title.trim() || (time.trim() !== existing?.time && getTimeInMinutes(time) === null)) {
      Alert.alert("Check activity details", "Enter an activity name and a valid time, such as 9:00 AM or 14:30.");
      return;
    }
    if (duration.trim() && duration.trim() !== existing?.duration && parseDurationToMinutes(duration) <= 0) {
      Alert.alert("Check duration", "Enter a duration such as 45 min or 1 hour.");
      return;
    }
    const fields = {
      time: time.trim(),
      title: title.trim(),
      location: location.trim(),
      duration: duration.trim(),
      priority,
      notes: notes.trim(),
      nearestLandmark: landmark,
    };
    if (existing) {
      updateActivity(currentJournalId, day.id, existing.id, fields);
    } else {
      addActivity(currentJournalId, day.id, { ...fields, completed: false });
    }
    closeActivityForm();
  }

  function confirmDeleteActivity(dayId: string, activity: JournalActivity) {
    const message = `Delete "${activity.title}"?`;
    const remove = () => deleteActivity(currentJournalId, dayId, activity.id);
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) remove();
      return;
    }
    Alert.alert("Delete activity", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: remove },
    ]);
  }

  function handleStartActivity(activityId: string) {
    if (!day) return;

    const started = startActivity(currentJournalId, day.id, activityId);

    if (!started) {
      Alert.alert(
        "Cannot start activity",
        "Complete the activity currently in progress before starting another one.",
      );
    }
  }

  function handleCompleteActivity(activityId: string) {
    if (!day) return;

    const activity = day.activities.find((item) => item.id === activityId);

    if (!activity || !activity.actualStartAt) return;

    updateActivity(currentJournalId, day.id, activityId, {
      completed: true,
      actualEndAt: new Date().toISOString(),
    });
  }

  function formatActualTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getActualDuration(start: string, end: string) {
    const difference = new Date(end).getTime() - new Date(start).getTime();
    const totalMinutes = Math.max(0, Math.floor(difference / 60000));

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} min`;
    }

    if (hours > 0) {
      return `${hours} hr`;
    }

    return `${minutes} min`;
  }

  function getDeadlineValue() {
    let hours = Number(deadlineHour);

    if (deadlinePeriod === "AM" && hours === 12) {
      hours = 0;
    } else if (deadlinePeriod === "PM" && hours !== 12) {
      hours += 12;
    }

    return `${String(hours).padStart(2, "0")}:${deadlineMinute}`;
  }

  function handleSaveDeadline() {
    if (!day) return;

    const deadline = getDeadlineValue();

    updateDayDeadline(currentJournalId, day.id, deadline);
    setIsEditingDeadline(false);
  }

  function handleEditDeadline() {
    setIsEditingDeadline(true);
  }

  function handleCancelDeadline() {
    if (!day?.returnDeadline) {
      setDeadlineHour("09");
      setDeadlineMinute("00");
      setDeadlinePeriod("PM");
      setIsEditingDeadline(true);
      return;
    }

    syncDeadlineFromDay(day);
  }

  function handleSaveAccommodation() {
    const value = accommodationInput.trim();

    if (!value) {
      Alert.alert(
        "Accommodation required",
        "Enter your hotel, hostel, or accommodation address.",
      );
      return;
    }

    updateAccommodationLocation(currentJournalId, value);
    setShowAccommodationEditor(false);

    Alert.alert(
      "Accommodation saved",
      "Your return location has been updated for this trip.",
    );
  }

  function handleCancelAccommodation() {
    setAccommodationInput(currentJournal.accommodationLocation ?? "");
    setShowAccommodationEditor(false);
  }

  async function handleReplan() {
    if (isReplanning) return;

    const now = new Date();
    const currentDate = getCurrentDate(now);
    try {
      setIsReplanning(true);
      setReplanningPreview(null);
      setSaveMessage("");
      setSavedPlan(false);
      const result = await replanJournalTrip({
        days: currentJournal.days,
        currentDate,
        currentTime: getCurrentTime(now),
        returnLocation: currentJournal.accommodationLocation ?? "",
        destination: currentJournal.destination,
      });
      setReplanningPreview({ result, journal: currentJournal, date: currentDate });
    } catch (error) {
      Alert.alert(
        "Replanning unavailable",
        error instanceof Error ? error.message : "OFFMAP could not calculate a new itinerary. Try again.",
      );
    } finally {
      setIsReplanning(false);
    }
  }

  function handleDiscardReplanning() {
    if (isSavingPlan) return;
    setSaveMessage("");
    setReplanningPreview(null);
  }

  const proposedDays = new Map(replanningResult?.days.map((day) => [day.id, day]));
  const updatedDays = replanningSnapshot?.days.map((savedDay) => {
    const proposal = proposedDays.get(savedDay.id);
    if (!proposal?.isFeasible || !replanningPreview || proposal.date < replanningPreview.date) {
      return savedDay;
    }

    const activities = proposal.activities.map(({ activity, proposedTime }) =>
      activity.time === proposedTime ? activity : { ...activity, time: proposedTime },
    );
    const hasChanges = activities.length !== savedDay.activities.length ||
      activities.some((activity, index) => activity !== savedDay.activities[index]);
    return hasChanges ? { ...savedDay, activities } : savedDay;
  });
  const canAccept = Boolean(updatedDays?.some((day, index) => day !== replanningSnapshot?.days[index]));

  async function handleAcceptReplanning() {
    if (!canAccept || !updatedDays || isSavingPlan) return;
    if (replanningSnapshot !== currentJournal) {
      handleDiscardReplanning();
      setSaveMessage("The itinerary changed. Replan again to review the latest activities.");
      return;
    }

    setSaveMessage("");
    setIsSavingPlan(true);
    try {
      await saveReplannedDays(currentJournal, updatedDays);
      setReplanningPreview(null);
      setSavedPlan(true);
      setSaveMessage("Itinerary changes saved.");
      const changedDayIndex = updatedDays.findIndex((day, index) => day !== currentJournal.days[index]);
      if (changedDayIndex >= 0 && updatedDays[safeSelectedDay] === currentJournal.days[safeSelectedDay]) {
        setSelectedDay(changedDayIndex);
        syncDeadlineFromDay(updatedDays[changedDayIndex]);
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "The itinerary could not be saved. Try again.");
    } finally {
      setIsSavingPlan(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.back}>← My Travel Journal</Text>
          </Pressable>

          <View style={styles.replanWrapper}>
            {showReplanTooltip ? (
              <View style={styles.replanTooltip}>
                <Text style={styles.replanTooltipText}>Replan my trip</Text>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.replanButton,
                isReplanning && styles.replanButtonDisabled,
              ]}
              onPress={handleReplan}
              onHoverIn={() => setShowReplanTooltip(true)}
              onHoverOut={() => setShowReplanTooltip(false)}
              onLongPress={() => setShowReplanTooltip(true)}
              disabled={isReplanning}
              accessibilityRole="button"
              accessibilityLabel="Replan my trip"
            >
              {isReplanning ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Ionicons name="refresh" size={24} color={Colors.white} />
              )}
            </Pressable>
          </View>
        </View>

        {saveMessage && !showReplanningPreview ? (
          <View style={styles.savedPlanMessage}>
            <Text accessibilityLiveRegion="polite" style={styles.previewReason}>{saveMessage}</Text>
            {savedPlan ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate({ pathname: "/itinerary", params: { journalId: currentJournal.id } })}
                style={styles.savedPlanLink}
              >
                <Text style={styles.previewDiscardText}>View itinerary</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.eyebrow}>TRAVEL JOURNAL</Text>
        <Text style={styles.title}>{currentJournal.title}</Text>
        <Text style={styles.destination}>{currentJournal.destination}</Text>
        <Text style={styles.description}>{currentJournal.description}</Text>

        {/* Accommodation */}
        <View style={styles.accommodationCard}>
          <View style={styles.accommodationIcon}>
            <Ionicons name="bed-outline" size={21} color={Colors.primary} />
          </View>

          <View style={styles.accommodationContent}>
            <Text style={styles.accommodationLabel}>YOUR ACCOMMODATION</Text>
            <Text style={styles.accommodationValue}>
              {currentJournal.accommodationLocation || "No accommodation added yet"}
            </Text>
          </View>

          <Pressable
            style={styles.accommodationEditButton}
            onPress={() => {
              setAccommodationInput(currentJournal.accommodationLocation ?? "");
              setShowAccommodationEditor(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit accommodation"
          >
            <Ionicons name="create-outline" size={19} color={Colors.primary} />
          </Pressable>
        </View>

        {days.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.days}
            >
              {days.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectDay(index)}
                  style={[
                    styles.dayButton,
                    index === safeSelectedDay && styles.activeDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      index === safeSelectedDay && styles.activeText,
                    ]}
                  >
                    DAY {index + 1}
                  </Text>

                  <Text
                    style={[
                      styles.dayTitle,
                      index === safeSelectedDay && styles.activeText,
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {day ? (
              <View style={styles.paper}>
                <Text style={styles.date}>{formatDate(day.date)}</Text>
                <Text style={styles.dayHeading}>{day.title}</Text>

                {day.notes ? (
                  <Text style={styles.dayNotes}>{day.notes}</Text>
                ) : null}

                <Pressable style={styles.addButton} onPress={() => openActivityForm()}>
                  <Text style={styles.addButtonText}>+ ADD ACTIVITY</Text>
                </Pressable>

                {day.activities.length > 0 ? (
                  day.activities.map((activity) => {
                    const isInProgress =
                      !!activity.actualStartAt &&
                      !activity.actualEndAt &&
                      !activity.completed;

                    return (
                      <View key={activity.id} style={styles.activity}>
                        <View
                          style={[
                            styles.checkbox,
                            activity.completed && styles.checked,
                            isInProgress && styles.inProgressCheckbox,
                          ]}
                        >
                          {activity.completed ? (
                            <Text style={styles.check}>✓</Text>
                          ) : isInProgress ? (
                            <View style={styles.activeDot} />
                          ) : null}
                        </View>

                        <View style={styles.activityContent}>
                          <View style={styles.timeRow}>
                            <Text style={styles.time}>{activity.time}</Text>

                            <Text
                              style={[
                                styles.priority,
                                activity.priority === "High" &&
                                  styles.highPriority,
                              ]}
                            >
                              {activity.priority}
                            </Text>
                            <View style={styles.activityActions}>
                              <Pressable onPress={() => openActivityForm(activity)} accessibilityRole="button" accessibilityLabel={`Edit ${activity.title}`} hitSlop={8}>
                                <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                              </Pressable>
                              <Pressable onPress={() => confirmDeleteActivity(day.id, activity)} accessibilityRole="button" accessibilityLabel={`Delete ${activity.title}`} hitSlop={8}>
                                <Ionicons name="trash-outline" size={18} color={Colors.accent} />
                              </Pressable>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.activityTitle,
                              activity.completed && styles.completed,
                            ]}
                          >
                            {activity.title}
                          </Text>

                          {activity.location ? (
                            <Text style={styles.location}>
                              {activity.location}
                            </Text>
                          ) : null}

                          {activity.nearestLandmark ? (
                            <Text style={styles.location}>Nearest landmark / {activity.nearestLandmark.name}</Text>
                          ) : null}

                          {activity.duration ? (
                            <Text style={styles.duration}>
                              Planned: {activity.duration}
                            </Text>
                          ) : null}

                          {activity.notes ? (
                            <Text style={styles.notes}>{activity.notes}</Text>
                          ) : null}

                          {activity.actualStartAt ? (
                            <View style={styles.trackingDetails}>
                              <Text style={styles.trackingText}>
                                Started:{" "}
                                {formatActualTime(activity.actualStartAt)}
                              </Text>

                              {activity.actualEndAt ? (
                                <>
                                  <Text style={styles.trackingText}>
                                    Finished:{" "}
                                    {formatActualTime(activity.actualEndAt)}
                                  </Text>

                                  <Text style={styles.actualDuration}>
                                    Actual time:{" "}
                                    {getActualDuration(
                                      activity.actualStartAt,
                                      activity.actualEndAt,
                                    )}
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.inProgressText}>
                                  Currently in progress
                                </Text>
                              )}
                            </View>
                          ) : null}

                          {!activity.completed && !activity.actualStartAt ? (
                            <Pressable
                              style={styles.startButton}
                              onPress={() => handleStartActivity(activity.id)}
                            >
                              <Text style={styles.startButtonText}>
                                START ACTIVITY
                              </Text>
                            </Pressable>
                          ) : null}

                          {isInProgress ? (
                            <Pressable
                              style={styles.completeButton}
                              onPress={() =>
                                Alert.alert(
                                  "Complete activity?",
                                  `Have you finished ${activity.title}?`,
                                  [
                                    {
                                      text: "Not yet",
                                      style: "cancel",
                                    },
                                    {
                                      text: "Complete",
                                      onPress: () =>
                                        handleCompleteActivity(activity.id),
                                    },
                                  ],
                                )
                              }
                            >
                              <Text style={styles.completeButtonText}>
                                COMPLETE ACTIVITY
                              </Text>
                            </Pressable>
                          ) : null}

                          {activity.completed ? (
                            <View style={styles.completedBadge}>
                              <Text style={styles.completedBadgeText}>
                                ACTIVITY COMPLETED
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>
                    No activities planned for this day yet.
                  </Text>
                )}

                {/* Daily Return Deadline */}
                <View style={styles.deadlineSection}>
                  <View style={styles.deadlineHeadingRow}>
                    <View style={styles.deadlineHeadingContent}>
                      <Text style={styles.deadlineEyebrow}>
                        YOUR DAY, YOUR PACE
                      </Text>

                      <Text style={styles.deadlineTitle}>
                        When are you calling it a day?
                      </Text>

                      <Text style={styles.deadlineDescription}>
                        Set the time you plan to return to your accommodation.
                      </Text>
                    </View>
                  </View>

                  {day.returnDeadline && !isEditingDeadline ? (
                    <View style={styles.savedDeadlineCard}>
                      <View style={styles.savedDeadlineContent}>
                        <Text style={styles.savedDeadlineLabel}>
                          YOUR RETURN TIME
                        </Text>

                        <View style={styles.savedTimeRow}>
                          <Text style={styles.savedDeadlineTime}>
                            {formatDeadline(day.returnDeadline)}
                          </Text>

                          <Text style={styles.savedDeadlineNote}>
                            Planned for today
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        style={styles.editDeadlineButton}
                        onPress={handleEditDeadline}
                        accessibilityRole="button"
                        accessibilityLabel="Change return deadline"
                      >
                        <Text style={styles.editDeadlineIcon}>✎</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.deadlineEditor}>
                      <View style={styles.wheelRow}>
                        <WheelPicker
                          values={Array.from({ length: 12 }, (_, index) =>
                            String(index + 1).padStart(2, "0"),
                          )}
                          selectedValue={deadlineHour}
                          onValueChange={setDeadlineHour}
                          width={58}
                        />

                        <Text style={styles.timeSeparator}>:</Text>

                        <WheelPicker
                          values={Array.from({ length: 60 }, (_, index) =>
                            String(index).padStart(2, "0"),
                          )}
                          selectedValue={deadlineMinute}
                          onValueChange={setDeadlineMinute}
                          width={58}
                        />

                        <WheelPicker
                          values={["AM", "PM"]}
                          selectedValue={deadlinePeriod}
                          onValueChange={(value) =>
                            setDeadlinePeriod(value as "AM" | "PM")
                          }
                          width={58}
                        />
                      </View>

                      <View style={styles.deadlineButtonRow}>
                        {day.returnDeadline ? (
                          <Pressable
                            style={styles.cancelDeadlineButton}
                            onPress={handleCancelDeadline}
                          >
                            <Text style={styles.cancelDeadlineText}>
                              Cancel
                            </Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          style={styles.saveDeadlineButton}
                          onPress={handleSaveDeadline}
                        >
                          <Text style={styles.saveDeadlineText}>
                            Save deadline
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.paper}>
            <Text style={styles.dayHeading}>Your itinerary is empty</Text>
            <Text style={styles.emptyText}>
              No itinerary days have been created for this journal yet.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddActivity} onRequestClose={closeActivityForm} animationType="slide">
        <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
            <View style={styles.form}>
              <Text style={styles.formTitle}>{editingActivityId ? "Edit Activity" : "Add Activity"}</Text>

              <Text style={styles.label}>TIME</Text>
              <TextInput
                accessibilityLabel="Scheduled time"
                value={time}
                onChangeText={setTime}
                placeholder="e.g. 9:00 AM"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>ACTIVITY</Text>
              <TextInput
                accessibilityLabel="Activity name"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Visit Jagannath Temple"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>INTENDED LOCATION</Text>
              <TextInput
                accessibilityLabel="Intended location"
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Grand Road"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>NEAREST LANDMARK</Text>
              {landmark ? (
                <View style={styles.landmarkAction}>
                  <Text style={[styles.location, { flex: 1 }]}>{landmark.name}</Text>
                  <Pressable onPress={() => setLandmark(undefined)} accessibilityLabel="Remove landmark" hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={22} color={Colors.accent} />
                  </Pressable>
                </View>
              ) : null}
              <Pressable style={styles.landmarkAction} onPress={handleFindLandmarks} disabled={isFindingLandmarks} accessibilityRole="button">
                {isFindingLandmarks ? <ActivityIndicator size="small" color={Colors.primary} /> :
                  <Ionicons name="locate-outline" size={20} color={Colors.primary} />}
                <Text style={styles.previewItemTitle}>
                  {isFindingLandmarks ? "Finding places near you..." : "Find places near me"}
                </Text>
              </Pressable>
              {landmarkMessage ? (
                <Text accessibilityLiveRegion="polite" style={styles.previewReason}>{landmarkMessage}</Text>
              ) : null}
              {nearbyPlaces.map((place, index) => {
                const selected = landmark?.id === place.id && landmark?.osmType === place.osmType;
                return (
                  <Pressable
                    key={`${place.osmType}-${place.id}`}
                    style={styles.landmarkAction}
                    onPress={() => setLandmark(place)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={19} color={Colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewItemTitle}>{place.name}</Text>
                      <Text style={styles.previewReason}>
                        {place.category} / about {place.distance} m{index === 0 ? " / Suggested" : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {hasLandmarkMapData ? (
                <Text style={styles.previewFootnote}>Map data © OpenStreetMap contributors</Text>
              ) : null}

              <Text style={styles.label}>DURATION</Text>
              <TextInput
                accessibilityLabel="Duration"
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g. 2 hours"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>PRIORITY</Text>

              <View style={styles.priorityRow}>
                {(["High", "Medium", "Low"] as Priority[]).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setPriority(item)}
                    style={[
                      styles.priorityButton,
                      priority === item && styles.selectedPriority,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        priority === item && styles.selectedPriorityText,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>NOTES</Text>
              <TextInput
                accessibilityLabel="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add some notes..."
                placeholderTextColor={Colors.muted}
                style={[styles.input, styles.notesInput]}
                multiline
              />

              <View style={styles.formButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeActivityForm}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.saveButton}
                  onPress={handleSaveActivity}
                >
                  <Text style={styles.saveText}>Save Activity</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Accommodation editor */}
      <Modal
        visible={showAccommodationEditor}
        transparent
        animationType="fade"
        onRequestClose={handleCancelAccommodation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>YOUR STAY</Text>
            <Text style={styles.modalTitle}>Where are you staying?</Text>
            <Text style={styles.modalDescription}>
              Enter your hotel name or full address. OFFMAP uses this location
              to calculate your return journey.
            </Text>

            <TextInput
              value={accommodationInput}
              onChangeText={setAccommodationInput}
              placeholder="Hotel name, street, city"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              autoCapitalize="words"
              multiline
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCancelAccommodation}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={handleSaveAccommodation}
              >
                <Text style={styles.saveText}>Save location</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Replanning preview */}
      <Modal
        visible={showReplanningPreview}
        transparent
        animationType="fade"
        onRequestClose={handleDiscardReplanning}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewHeaderContent}>
                <Text style={styles.modalEyebrow}>OFFMAP ROUTE UPDATE</Text>
                <Text style={styles.previewTitle}>Your revised trip</Text>
                <Text style={styles.previewSubtitle}>
                  Review the day-by-day changes before saving.
                </Text>
              </View>

              <Pressable
                onPress={handleDiscardReplanning}
                disabled={isSavingPlan}
                accessibilityLabel="Close replanning preview"
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.previewScroll}
              showsVerticalScrollIndicator={false}
            >
              {replanningResult ? (
                <>
                  <Text style={styles.resultSummaryText}>
                    {canAccept && replanningResult.changes.length === 0
                      ? "Review the updated order of your activities before saving."
                      : replanningResult.explanation}
                  </Text>
                  {replanningResult.warnings.map((warning) => (
                    <Text key={warning} style={styles.previewReason}>{warning}</Text>
                  ))}
                  {replanningResult.days.length === 0 ? (
                    <Text style={styles.previewEmpty}>This journal has no trip days.</Text>
                  ) : null}
                  {replanningResult.days.map((proposedDay) => (
                    <View key={proposedDay.id}>
                      <Text style={styles.previewSectionTitle}>
                        {formatDate(proposedDay.date)} / {proposedDay.title}
                      </Text>
                      {proposedDay.activities.length === 0 ? (
                        <Text style={styles.previewEmpty}>No activities planned for this day.</Text>
                      ) : null}
                      {proposedDay.activities.map(({ activity, proposedTime, originalDate, status, reason, incomingTravel }) => (
                        <View key={activity.id} style={styles.previewItem}>
                          <Text style={styles.previewItemTitle}>{activity.title}</Text>
                          {activity.location ? <Text style={styles.previewReason}>{activity.location}</Text> : null}
                          <View style={styles.changeTimeRow}>
                            {activity.time !== proposedTime || originalDate ? (
                              <>
                                <Text style={styles.oldTime}>
                                  {originalDate ? `${formatDate(originalDate)} ` : ""}{activity.time}
                                </Text>
                                <Ionicons name="arrow-forward" size={15} color={Colors.accent} />
                              </>
                            ) : null}
                            <Text style={styles.newTime}>{proposedTime}</Text>
                            {status !== "scheduled" ? (
                              <Text style={styles.previewReason}>
                                {status === "fixed" && activity.priority === "High"
                                  ? "High priority (fixed)"
                                  : proposalLabels[status]}
                              </Text>
                            ) : null}
                          </View>
                          {reason ? <Text style={styles.previewReason}>{reason}</Text> : null}
                          {incomingTravel && incomingTravel.durationMinutes > 0 ? (
                            <Text style={styles.previewReason}>
                              Travel to activity / {formatTravel(incomingTravel)}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                      {proposedDay.returnTravel ? (
                        <Text style={styles.previewReason}>Return to accommodation / {formatTravel(proposedDay.returnTravel)}</Text>
                      ) : null}
                      {proposedDay.warnings.map((warning) => (
                        <Text key={warning} style={styles.previewReason}>{warning}</Text>
                      ))}
                      {proposedDay.alternatives?.length ? (
                        <View>
                          <Text style={styles.previewSectionTitle}>Nearby alternatives</Text>
                          {proposedDay.alternatives.map((place) => (
                            <Text key={`${place.id}-${place.name}`} style={styles.previewReason}>
                              {place.name} / {place.category} / {place.travelTimeMinutes} min from starting point
                            </Text>
                          ))}
                          <Text style={styles.previewFootnote}>Map data © OpenStreetMap contributors</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>

            {saveMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.previewReason}>{saveMessage}</Text>
            ) : null}
            <View style={styles.previewActions}>
              {canAccept ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.previewDiscardButton}
                  onPress={handleDiscardReplanning}
                  disabled={isSavingPlan}
                >
                  <Text style={styles.previewDiscardText}>Discard Changes</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: isSavingPlan }}
                style={[styles.previewAcceptButton, isSavingPlan && styles.replanButtonDisabled]}
                onPress={canAccept ? handleAcceptReplanning : handleDiscardReplanning}
                disabled={isSavingPlan}
              >
                <Text style={styles.previewAcceptText}>
                  {isSavingPlan ? "Saving..." : canAccept ? "Accept Changes" : "Done"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type WheelPickerProps = {
  values: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  width: number;
};

function WheelPicker({
  values,
  selectedValue,
  onValueChange,
  width,
}: WheelPickerProps) {
  const scrollRef = useRef<any>(null);
  const ITEM_HEIGHT = 36;

  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  useEffect(() => {
    scrollRef.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = event.nativeEvent.contentOffset.y;

    const index = Math.max(
      0,
      Math.min(values.length - 1, Math.round(offsetY / ITEM_HEIGHT)),
    );

    onValueChange(values[index]);
  }

  return (
    <View style={[styles.wheelContainer, { width }]}>
      <View pointerEvents="none" style={styles.wheelSelection} />

      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={styles.wheelContent}
      >
        {values.map((value) => (
          <View key={value} style={styles.wheelItem}>
            <Text
              style={[
                styles.wheelText,
                selectedValue === value && styles.selectedWheelText,
              ]}
            >
              {value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDeadline(deadline: string) {
  const [hours, minutes] = deadline.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 50,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  backButton: {
    flex: 1,
  },
  back: {
    color: Colors.accent,
    fontSize: 12,
  },
  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    letterSpacing: 2,
  },
  title: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 30,
    marginTop: 8,
  },
  destination: {
    color: Colors.secondary,
    fontSize: 12,
    marginTop: 5,
  },
  description: {
    color: Colors.secondary,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 12,
  },
  days: {
    marginVertical: 25,
  },
  dayButton: {
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  activeDay: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayNumber: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "700",
  },
  dayTitle: {
    color: Colors.primary,
    fontSize: 11,
    marginTop: 4,
  },
  activeText: {
    color: Colors.white,
  },
  paper: {
    backgroundColor: "#FFFDF8",
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  date: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dayHeading: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 24,
    marginTop: 7,
  },
  dayNotes: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 20,
  },
  addButton: {
    marginTop: 20,
    marginBottom: 5,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  addButtonText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  form: {
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 20,
    marginBottom: 18,
  },
  label: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: Colors.primary,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  selectedPriority: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  priorityButtonText: {
    color: Colors.secondary,
    fontSize: 10,
  },
  selectedPriorityText: {
    color: Colors.white,
  },
  formButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  cancelText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  saveText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  activity: {
    flexDirection: "row",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 5,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  check: {
    color: Colors.white,
    fontWeight: "700",
  },
  inProgressCheckbox: {
    borderColor: Colors.accent,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  activityContent: {
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  priority: {
    color: Colors.secondary,
    fontSize: 8,
    textTransform: "uppercase",
  },
  highPriority: {
    color: Colors.accent,
    fontWeight: "700",
  },
  activityTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 17,
    marginTop: 5,
  },
  completed: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  location: {
    color: Colors.secondary,
    fontSize: 11,
    marginTop: 5,
  },
  duration: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  notes: {
    color: Colors.secondary,
    fontSize: 10,
    fontStyle: "italic",
    lineHeight: 16,
    marginTop: 8,
  },
  trackingDetails: {
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    gap: 5,
  },
  trackingText: {
    color: Colors.secondary,
    fontSize: 10,
  },
  actualDuration: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  inProgressText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  startButton: {
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
  },
  startButtonText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  completeButton: {
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
  },
  completeButtonText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  completedBadge: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#E5EFE6",
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
  },
  completedBadgeText: {
    color: "#426B4B",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  emptyText: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 12,
  },
  deadlineSection: {
    marginTop: 28,
    paddingTop: 23,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deadlineHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  deadlineHeadingContent: {
    flex: 1,
  },
  deadlineEyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 9,
  },
  deadlineTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "600",
  },
  deadlineDescription: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  savedDeadlineCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: "#F1EEE6",
    borderWidth: 1,
    borderColor: "#E6E0D4",
    borderRadius: Radius.md,
  },
  savedDeadlineContent: {
    flex: 1,
  },
  savedDeadlineLabel: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  savedTimeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 5,
  },
  savedDeadlineTime: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 25,
    fontWeight: "600",
  },
  savedDeadlineNote: {
    color: Colors.secondary,
    fontSize: 9,
  },
  editDeadlineButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5DFD2",
    borderRadius: 21,
    marginLeft: 12,
  },
  editDeadlineIcon: {
    color: Colors.primary,
    fontSize: 23,
    fontWeight: "600",
  },
  deadlineEditor: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#F1EEE6",
    borderWidth: 1,
    borderColor: "#E6E0D4",
    borderRadius: Radius.md,
  },
  wheelRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  wheelContainer: {
    height: 108,
    overflow: "hidden",
    position: "relative",
  },
  wheelContent: {
    paddingVertical: 36,
  },
  wheelItem: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    color: Colors.muted,
    fontSize: 16,
  },
  selectedWheelText: {
    color: Colors.primary,
    fontSize: 19,
    fontWeight: "700",
  },
  wheelSelection: {
    position: "absolute",
    top: 36,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: "#E5DFD2",
    borderRadius: Radius.sm,
    zIndex: 0,
  },
  timeSeparator: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: "600",
  },
  deadlineButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  cancelDeadlineButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cancelDeadlineText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: "600",
  },
  saveDeadlineButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 19,
    paddingVertical: 11,
    borderRadius: Radius.sm,
  },
  saveDeadlineText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  replanWrapper: {
    position: "relative",
    alignItems: "center",
    zIndex: 10,
  },
  replanButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  replanButtonDisabled: {
    opacity: 0.6,
  },
  replanTooltip: {
    position: "absolute",
    top: 54,
    right: 0,
    backgroundColor: Colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 125,
    alignItems: "center",
    zIndex: 20,
    elevation: 6,
  },
  replanTooltipText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "600",
  },
  error: {
    color: Colors.primary,
    padding: 25,
  },

  // Accommodation
  accommodationCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    padding: 13,
    backgroundColor: "#F1EEE6",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#E6E0D4",
  },
  accommodationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E5DFD2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  accommodationContent: {
    flex: 1,
  },
  accommodationLabel: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  accommodationValue: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 5,
  },
  accommodationEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5DFD2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 25, 40, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFDF8",
    borderRadius: Radius.md,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalEyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
  modalTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 25,
    marginTop: 9,
  },
  modalDescription: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 9,
    marginBottom: 17,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  activityActions: {
    flexDirection: "row",
    columnGap: 18,
    marginLeft: "auto",
  },
  landmarkAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  previewCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    backgroundColor: "#FFFDF8",
    borderRadius: Radius.md,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  previewHeaderContent: {
    flex: 1,
  },
  previewTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 27,
    marginTop: 6,
  },
  previewSubtitle: {
    color: Colors.secondary,
    fontSize: 11,
    marginTop: 5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1EEE6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  previewScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  savedPlanMessage: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    marginTop: 12,
  },
  savedPlanLink: {
    paddingVertical: 10,
  },
  resultSummaryText: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },
  previewSectionTitle: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 15,
    marginBottom: 9,
  },
  previewItem: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  previewItemTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  changeTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  oldTime: {
    color: Colors.muted,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  newTime: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: "700",
  },
  previewReason: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    flexShrink: 1,
  },
  previewEmpty: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
  },
  alternativeGroup: {
    marginBottom: 12,
  },
  alternativeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  selectedAlternativeItem: {
    borderColor: Colors.success,
    backgroundColor: "#EDF3EA",
  },
  alternativeText: {
    flex: 1,
    paddingRight: 10,
  },
  alternativeName: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  alternativeTravel: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
  },
  delayText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 15,
  },
  previewFootnote: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 17,
    marginBottom: 12,
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  previewDiscardButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  previewDiscardText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
  previewAcceptButton: {
    flex: 1.4,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  previewAcceptText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
});
