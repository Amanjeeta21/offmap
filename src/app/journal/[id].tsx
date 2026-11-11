import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Priority, useJournals } from "@/context/journal-context";

export default function JournalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { getJournal, updateActivity, addActivity } = useJournals();

  const journal = getJournal(id);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [notes, setNotes] = useState("");

  const days = journal?.days ?? [];

  useEffect(() => {
    if (selectedDay >= days.length) {
      setSelectedDay(0);
    }
  }, [days.length, selectedDay]);

  if (!journal) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Journal not found.</Text>
      </SafeAreaView>
    );
  }

  const day = days[selectedDay];

  function resetActivityForm() {
    setTime("");
    setTitle("");
    setLocation("");
    setDuration("");
    setPriority("Medium");
    setNotes("");
  }

  function handleAddActivity() {
    if (!day) return;

    if (!title.trim() || !time.trim()) {
      Alert.alert(
        "Missing information",
        "Please enter at least the time and activity title.",
      );
      return;
    }

    addActivity(journal.id, day.id, {
      time: time.trim(),
      title: title.trim(),
      location: location.trim(),
      duration: duration.trim(),
      priority,
      completed: false,
      notes: notes.trim(),
    });

    resetActivityForm();
    setShowAddActivity(false);

    Alert.alert("Activity added", `${title.trim()} was added to ${day.title}.`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← My Travel Journal</Text>
        </Pressable>

        <Text style={styles.eyebrow}>TRAVEL JOURNAL</Text>
        <Text style={styles.title}>{journal.title}</Text>
        <Text style={styles.destination}>{journal.destination}</Text>
        <Text style={styles.description}>{journal.description}</Text>

        {days.length > 0 ? (
          <>
            {/* Day Selection */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.days}
            >
              {days.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelectedDay(index);
                    setShowAddActivity(false);
                  }}
                  style={[
                    styles.dayButton,
                    index === selectedDay && styles.activeDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      index === selectedDay && styles.activeText,
                    ]}
                  >
                    DAY {index + 1}
                  </Text>

                  <Text
                    style={[
                      styles.dayTitle,
                      index === selectedDay && styles.activeText,
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Selected Day */}
            {day ? (
              <View style={styles.paper}>
                <Text style={styles.date}>{formatDate(day.date)}</Text>
                <Text style={styles.dayHeading}>{day.title}</Text>

                {day.notes ? (
                  <Text style={styles.dayNotes}>{day.notes}</Text>
                ) : null}

                {/* Add Activity Button */}
                {!showAddActivity ? (
                  <Pressable
                    style={styles.addButton}
                    onPress={() => setShowAddActivity(true)}
                  >
                    <Text style={styles.addButtonText}>+ ADD ACTIVITY</Text>
                  </Pressable>
                ) : (
                  <View style={styles.form}>
                    <Text style={styles.formTitle}>Add Activity</Text>

                    <Text style={styles.label}>TIME</Text>
                    <TextInput
                      value={time}
                      onChangeText={setTime}
                      placeholder="e.g. 9:00 AM"
                      placeholderTextColor={Colors.muted}
                      style={styles.input}
                    />

                    <Text style={styles.label}>ACTIVITY</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Visit Jagannath Temple"
                      placeholderTextColor={Colors.muted}
                      style={styles.input}
                    />

                    <Text style={styles.label}>LOCATION</Text>
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="e.g. Grand Road"
                      placeholderTextColor={Colors.muted}
                      style={styles.input}
                    />

                    <Text style={styles.label}>DURATION</Text>
                    <TextInput
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
                        onPress={() => {
                          resetActivityForm();
                          setShowAddActivity(false);
                        }}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>

                      <Pressable
                        style={styles.saveButton}
                        onPress={handleAddActivity}
                      >
                        <Text style={styles.saveText}>Save Activity</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Activities */}
                {day.activities.length > 0 ? (
                  day.activities.map((activity) => (
                    <Pressable
                      key={activity.id}
                      style={styles.activity}
                      onPress={() =>
                        updateActivity(journal.id, day.id, activity.id, {
                          completed: !activity.completed,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.checkbox,
                          activity.completed && styles.checked,
                        ]}
                      >
                        {activity.completed && (
                          <Text style={styles.check}>✓</Text>
                        )}
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

                        {activity.duration ? (
                          <Text style={styles.duration}>
                            {activity.duration}
                          </Text>
                        ) : null}

                        {activity.notes ? (
                          <Text style={styles.notes}>{activity.notes}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No activities planned for this day yet.
                  </Text>
                )}
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
    </SafeAreaView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: Spacing.lg,
    paddingBottom: 50,
  },

  back: {
    color: Colors.accent,
    fontSize: 12,
    marginBottom: 25,
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

  emptyText: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 12,
  },

  error: {
    color: Colors.primary,
    padding: 25,
  },
});
