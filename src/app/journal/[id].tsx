import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useJournals } from "@/context/journal-context";

export default function JournalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJournal, updateActivity } = useJournals();

  const journal = getJournal(id);
  const [selectedDay, setSelectedDay] = useState(0);

  if (!journal) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Journal not found.</Text>
      </SafeAreaView>
    );
  }

  const day = journal.days[selectedDay];

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

        {/* Days */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.days}
        >
          {journal.days.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedDay(index)}
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

        {/* Selected day */}
        <View style={styles.paper}>
          <Text style={styles.date}>{formatDate(day.date)}</Text>
          <Text style={styles.dayHeading}>{day.title}</Text>
          <Text style={styles.dayNotes}>{day.notes}</Text>

          {day.activities.map((activity) => (
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
                style={[styles.checkbox, activity.completed && styles.checked]}
              >
                {activity.completed && <Text style={styles.check}>✓</Text>}
              </View>

              <View style={styles.activityContent}>
                <View style={styles.timeRow}>
                  <Text style={styles.time}>{activity.time}</Text>

                  <Text
                    style={[
                      styles.priority,
                      activity.priority === "High" && styles.highPriority,
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

                <Text style={styles.location}>{activity.location}</Text>

                <Text style={styles.duration}>{activity.duration}</Text>

                {activity.notes ? (
                  <Text style={styles.notes}>{activity.notes}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
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

  error: {
    color: Colors.primary,
    padding: 25,
  },
});
