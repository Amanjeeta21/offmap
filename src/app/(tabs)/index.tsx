import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

export default function ExploreScreen() {
  const router = useRouter();

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  const changeMonth = (amount: number) => {
    setVisibleMonth(new Date(year, month + amount, 1));
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const handleStartPlanning = () => {
    if (!selectedDate) return;

    const selectedDateString = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, "0"),
      String(selectedDate.getDate()).padStart(2, "0"),
    ].join("-");

    setSelectedDate(null);

    router.push({
      pathname: "/itinerary",
      params: { date: selectedDateString },
    });
  };

  const today = new Date();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.header}>
          <Text style={styles.brand}>OFFMAP</Text>
          <Text style={styles.tagline}>TRAVEL DIFFERENTLY.</Text>
        </View>

        {/* Introduction */}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>A WORLD BEYOND THE ORDINARY</Text>

          <Text style={styles.title}>
            Find places.{"\n"}
            <Text style={styles.titleAccent}>Feel everything.</Text>
          </Text>

          <Text style={styles.subtitle}>
            Your journey, your pace, your own little adventure. Start with a
            date. We'll take it from there.
          </Text>
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarTop}>
            <View>
              <Text style={styles.eyebrow}>MAKE TIME FOR YOURSELF</Text>
              <Text style={styles.calendarTitle}>When are you going?</Text>
            </View>

            <Text style={styles.calendarDecoration}>✳</Text>
          </View>

          {/* Month navigation */}
          <View style={styles.monthHeader}>
            <Text style={styles.monthName}>
              {visibleMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>

            <View style={styles.monthControls}>
              <Pressable
                onPress={() => changeMonth(-1)}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>

              <Pressable
                onPress={() => changeMonth(1)}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {weekdays.map((day, index) => (
              <View key={`${day}-${index}`} style={styles.calendarCell}>
                <Text style={styles.weekday}>{day}</Text>
              </View>
            ))}

            {calendarDays.map((day, index) => {
              const isSelected =
                day !== null &&
                selectedDate !== null &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

              const isToday =
                day !== null &&
                today.getDate() === day &&
                today.getMonth() === month &&
                today.getFullYear() === year;

              return (
                <View key={index} style={styles.calendarCell}>
                  {day !== null && (
                    <Pressable
                      onPress={() =>
                        setSelectedDate(new Date(year, month, day))
                      }
                      style={[
                        styles.dateButton,
                        isToday && styles.todayButton,
                        isSelected && styles.selectedDate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          isToday && styles.todayText,
                          isSelected && styles.selectedDateText,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.calendarHint}>
            PICK A DAY. LET THE JOURNEY BEGIN.
          </Text>
        </View>

        {/* Closing message */}
        <View style={styles.bottomCard}>
          <Text style={styles.bottomDecoration}>✳</Text>

          <Text style={styles.bottomTitle}>Leave room for the unexpected.</Text>

          <Text style={styles.bottomDescription}>
            Plans can change. Your journey doesn't have to stop. OFFMAP helps
            you adapt along the way.
          </Text>
        </View>

        <Text style={styles.footer}>MADE FOR THE UNPLANNED MOMENTS.</Text>
      </ScrollView>

      {/* Date selection popup */}
      <Modal
        visible={selectedDate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setSelectedDate(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            <Text style={styles.modalDecoration}>✳</Text>

            <Text style={styles.eyebrow}>A NEW ADVENTURE AWAITS</Text>

            <Text style={styles.modalTitle}>Let's plan!</Text>

            <Text style={styles.modalDescription}>
              {selectedDate ? formatDate(selectedDate) : ""}
            </Text>

            <Text style={styles.modalHint}>
              Pick a date, dream a little, and make it yours.
            </Text>

            <Pressable style={styles.modalAction} onPress={handleStartPlanning}>
              <Text style={styles.modalActionText}>Start planning</Text>
              <Text style={styles.modalActionArrow}>↗</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  header: {
    alignItems: "center",
    gap: 5,
    paddingVertical: Spacing.sm,
  },

  brand: {
    color: Colors.primary,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 6,
  },

  tagline: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
  },

  intro: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },

  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
  },

  title: {
    color: Colors.primary,
    fontSize: 37,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
  },

  titleAccent: {
    color: Colors.accent,
    fontStyle: "italic",
  },

  subtitle: {
    color: Colors.secondary,
    fontSize: 13,
    lineHeight: 21,
    maxWidth: 310,
  },

  calendarCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  calendarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  calendarTitle: {
    color: Colors.primary,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  calendarDecoration: {
    color: Colors.accent,
    fontSize: 28,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  monthName: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  monthControls: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  monthButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: "#F2EDE5",
    alignItems: "center",
    justifyContent: "center",
  },

  monthButtonText: {
    color: Colors.primary,
    fontSize: 21,
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  calendarCell: {
    width: "14.2857%",
    height: 39,
    alignItems: "center",
    justifyContent: "center",
  },

  weekday: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  dateButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  dateText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },

  todayButton: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },

  todayText: {
    color: Colors.accent,
  },

  selectedDate: {
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },

  selectedDateText: {
    color: Colors.white,
    fontWeight: "800",
  },

  calendarHint: {
    color: Colors.muted,
    textAlign: "center",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  bottomCard: {
    backgroundColor: "#EFEAE1",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: "center",
  },

  bottomDecoration: {
    color: Colors.accent,
    fontSize: 28,
  },

  bottomTitle: {
    color: Colors.primary,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 30,
  },

  bottomDescription: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },

  footer: {
    color: Colors.muted,
    fontSize: 8,
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "#172B4D99",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },

  modalCard: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },

  closeButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: Colors.secondary,
    fontSize: 27,
  },

  modalDecoration: {
    color: Colors.accent,
    fontSize: 35,
  },

  modalTitle: {
    color: Colors.primary,
    fontSize: 34,
    fontWeight: "900",
  },

  modalDescription: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  modalHint: {
    color: Colors.secondary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
  },

  modalAction: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },

  modalActionText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
  },

  modalActionArrow: {
    color: "#E7C5B4",
    fontSize: 20,
  },
});
