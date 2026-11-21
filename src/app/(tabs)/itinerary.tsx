import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useJournals } from "@/context/journal-context";

export default function ItineraryScreen() {
  const router = useRouter();
  const { journalId } = useLocalSearchParams<{ journalId?: string }>();
  const { journals, isLoading, deleteJournal } = useJournals();
  const [expanded, setExpanded] = useState<{ requested?: string; journalId: string | null }>();
  const expandedJournalId = expanded && expanded.requested === journalId
    ? expanded.journalId
    : journalId;

  function openJournal(id: string) {
    router.push({
      pathname: "/journal/[id]",
      params: { id },
    });
  }

  function createJournal() {
    router.push("/journal/create");
  }

  function confirmDelete(id: string, title: string) {
    Alert.alert(
      "Delete Journal",
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteJournal(id),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>OFFMAP · YOUR STORIES</Text>

        <Text style={styles.heading}>My Travel Journal</Text>

        <Text style={styles.subtitle}>
          Every journey deserves its own little story.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.section}>YOUR JOURNALS</Text>

        {isLoading ? (
          <Text style={styles.message}>Opening your journals...</Text>
        ) : (
          journals.map((journal) => {
            const isExpanded = expandedJournalId === journal.id;
            return (
              <View key={journal.id} style={styles.card}>
                {/* Journal Card Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.sample}>
                    {journal.isSample ? "SAMPLE JOURNAL" : "YOUR JOURNAL"}
                  </Text>

                  {/* Delete Icon */}
                  <Pressable
                    onPress={() => confirmDelete(journal.id, journal.title)}
                    style={styles.deleteButton}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={Colors.accent}
                    />
                  </Pressable>
                </View>

                {/* Journal Details */}
                <Pressable onPress={() => openJournal(journal.id)}>
                  <Text style={styles.title}>{journal.title}</Text>

                  <Text style={styles.destination}>{journal.destination}</Text>

                  <Text style={styles.description}>{journal.description}</Text>

                  <Text style={styles.open}>OPEN NOTEBOOK ↗</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityLabel={`View itinerary for ${journal.title}`}
                  onPress={() => setExpanded({ requested: journalId, journalId: isExpanded ? null : journal.id })}
                  style={styles.scheduleToggle}
                >
                  <Text style={styles.scheduleToggleText}>{isExpanded ? "Hide itinerary" : "View itinerary"}</Text>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.primary} />
                </Pressable>

                {isExpanded && (
                  journal.days.length ? journal.days.map((day) => (
                    <View key={day.id} style={styles.scheduleDay}>
                      <Text style={styles.scheduleDayTitle}>{day.title}</Text>
                      <Text style={styles.scheduleDate}>{day.date}</Text>
                      {day.activities.length ? day.activities.map((activity) => (
                        <View key={activity.id} style={styles.scheduleRow}>
                          <Text style={styles.scheduleTime}>{activity.time}</Text>
                          <View style={styles.scheduleActivity}>
                            <Text style={styles.scheduleActivityTitle}>{activity.title}</Text>
                            {activity.location ? <Text style={styles.scheduleDate}>{activity.location}</Text> : null}
                          </View>
                        </View>
                      )) : <Text style={styles.scheduleDate}>No activities planned for this day.</Text>}
                    </View>
                  )) : <Text style={styles.scheduleDate}>No itinerary days yet.</Text>
                )}
              </View>
            );
          })
        )}

        {/* Create Journal */}
        <Pressable style={styles.create} onPress={createJournal}>
          <Text style={styles.plus}>＋</Text>

          <Text style={styles.createTitle}>Create a new journal</Text>

          <Text style={styles.subtitle}>Start another adventure.</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },

  eyebrow: {
    color: Colors.accent,
    fontSize: 10,
    letterSpacing: 2,
  },

  heading: {
    color: Colors.primary,
    fontSize: 29,
    fontFamily: "Georgia",
    textAlign: "center",
    marginTop: 15,
  },

  subtitle: {
    color: Colors.secondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 25,
  },

  section: {
    color: Colors.secondary,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 15,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sample: {
    color: Colors.accent,
    fontSize: 9,
    letterSpacing: 1.5,
  },

  deleteButton: {
    padding: 5,
  },

  title: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 23,
    marginTop: 12,
  },

  destination: {
    color: Colors.secondary,
    fontSize: 12,
    marginTop: 6,
  },

  description: {
    color: Colors.secondary,
    fontSize: 12,
    marginTop: 12,
  },

  open: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 20,
    letterSpacing: 1,
  },

  scheduleToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  scheduleToggleText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  scheduleDay: {
    marginTop: Spacing.md,
  },
  scheduleDayTitle: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  scheduleDate: {
    color: Colors.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  scheduleRow: {
    flexDirection: "row",
    columnGap: 12,
    paddingVertical: 6,
  },
  scheduleTime: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "700",
    width: 74,
  },
  scheduleActivity: {
    flex: 1,
  },
  scheduleActivityTitle: {
    color: Colors.primary,
    fontSize: 13,
  },

  create: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: 10,
  },

  plus: {
    color: Colors.accent,
    fontSize: 26,
  },

  createTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 17,
    marginTop: 8,
  },

  message: {
    color: Colors.secondary,
    padding: 15,
  },
});
