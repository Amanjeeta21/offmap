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

const interests = [
  "Culture",
  "Food",
  "Adventure",
  "Nature",
  "History",
  "Shopping",
];

const features = [
  {
    id: "planning",
    number: "01",
    category: "PLAN LESS",
    title: "Less planning stress.",
    shortDescription: "Your trip, organised without the overwhelm.",
    description:
      "You don't have to stress anymore. Plan your next itinerary, organise your days, and keep all your travel details in one place. Spend less time figuring things out and more time looking forward to the journey.",
    action: "Plan my itinerary",
    backgroundColor: "#172B4D",
    rotation: "-5deg",
    position: "left",
  },
  {
    id: "discovering",
    number: "02",
    category: "LIVE MORE",
    title: "More discovering.",
    shortDescription: "Leave a little room for the unexpected.",
    description:
      "Travel isn't just about ticking places off a list. Discover new experiences, explore at your own pace, and leave room for the moments you never planned.",
    action: "Start exploring",
    backgroundColor: "#253E60",
    rotation: "5deg",
    position: "right",
  },
  {
    id: "journey",
    number: "03",
    category: "MAKE IT YOURS",
    title: "Your journey, your way.",
    shortDescription: "Every trip deserves its own story.",
    description:
      "Create your own travel journal, organise activities by day, and keep your memories together. Your journey should feel like yours, from the first plan to the last memory.",
    action: "Create my journey",
    backgroundColor: "#8D4939",
    rotation: "-3deg",
    position: "center",
  },
];

type Feature = (typeof features)[number];

export default function ExploreScreen() {
  const router = useRouter();

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

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

  const handleFeatureAction = () => {
    setSelectedFeature(null);
    router.push("/itinerary");
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
              <Text style={styles.calendarEyebrow}>MAKE TIME FOR YOURSELF</Text>
              <Text style={styles.calendarTitle}>When are you going?</Text>
            </View>

            <Text style={styles.calendarDecoration}>✳</Text>
          </View>

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

        {/* Explore by Interest */}
        <View style={styles.interestSection}>
          <Text style={styles.eyebrow}>FOLLOW YOUR CURIOSITY</Text>

          <Text style={styles.sectionTitle}>Explore by interest.</Text>

          <Text style={styles.sectionDescription}>
            What does your kind of adventure look like?
          </Text>

          <View style={styles.interestGrid}>
            {interests.map((interest) => {
              const isSelected = selectedInterest === interest;

              return (
                <Pressable
                  key={interest}
                  onPress={() =>
                    setSelectedInterest(isSelected ? null : interest)
                  }
                  style={[
                    styles.interestChip,
                    isSelected && styles.interestChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.interestText,
                      isSelected && styles.interestTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* OFFMAP Feature Cards */}
        <View style={styles.featuresSection}>
          <Text style={styles.eyebrow}>A DIFFERENT WAY TO TRAVEL</Text>

          <Text style={styles.featuresHeading}>
            What makes{"\n"}
            <Text style={styles.featuresHeadingAccent}>OFFMAP different?</Text>
          </Text>

          <Text style={styles.featuresSubtitle}>
            Less of the hassle. More of what matters.
          </Text>

          <View style={styles.featureStack}>
            {features.map((feature) => (
              <Pressable
                key={feature.id}
                onPress={() => setSelectedFeature(feature)}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: feature.backgroundColor,
                    transform: [{ rotate: feature.rotation }],
                  },
                  feature.position === "left" && styles.featureLeft,
                  feature.position === "right" && styles.featureRight,
                  feature.position === "center" && styles.featureCenter,
                ]}
              >
                <View style={styles.featureCardTop}>
                  <Text style={styles.featureNumber}>
                    {feature.number} / {feature.category}
                  </Text>
                  <Text style={styles.featureArrow}>↗</Text>
                </View>

                <View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.shortDescription}
                  </Text>
                </View>

                <Text style={styles.featureTap}>TAP TO DISCOVER</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.featureFooter}>LESS ROUTINE. MORE STORIES.</Text>
        </View>

        <Text style={styles.footer}>MADE FOR THE UNPLANNED MOMENTS.</Text>
      </ScrollView>

      {/* Date Selection Modal */}
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

      {/* OFFMAP Feature Modal */}
      <Modal
        visible={selectedFeature !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedFeature(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedFeature && (
            <View
              style={[
                styles.featureModalCard,
                { backgroundColor: selectedFeature.backgroundColor },
              ]}
            >
              <Pressable
                onPress={() => setSelectedFeature(null)}
                style={styles.featureCloseButton}
              >
                <Text style={styles.featureCloseText}>×</Text>
              </Pressable>

              <Text style={styles.featureModalNumber}>
                {selectedFeature.number} / {selectedFeature.category}
              </Text>

              <Text style={styles.featureModalDecoration}>✳</Text>

              <Text style={styles.featureModalTitle}>
                {selectedFeature.title}
              </Text>

              <Text style={styles.featureModalDescription}>
                {selectedFeature.description}
              </Text>

              <Pressable
                style={styles.featureModalAction}
                onPress={handleFeatureAction}
              >
                <Text style={styles.featureModalActionText}>
                  {selectedFeature.action}
                </Text>
                <Text style={styles.featureModalActionArrow}>↗</Text>
              </Pressable>

              <Text style={styles.featureModalFooter}>
                YOUR NEXT CHAPTER STARTS HERE.
              </Text>
            </View>
          )}
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
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },

  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    textAlign: "center",
  },

  title: {
    color: Colors.primary,
    fontSize: 37,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
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
    textAlign: "center",
  },

  // Calendar

  calendarCard: {
    backgroundColor: "#172B4D",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  calendarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  calendarEyebrow: {
    color: "#D7B69F",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  calendarTitle: {
    color: Colors.white,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  calendarDecoration: {
    color: "#D7B69F",
    fontSize: 28,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  monthName: {
    color: Colors.white,
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
    backgroundColor: "#304563",
    alignItems: "center",
    justifyContent: "center",
  },

  monthButtonText: {
    color: Colors.white,
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
    color: "#B8C3D1",
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
    color: Colors.white,
    fontSize: 11,
    fontWeight: "600",
  },

  todayButton: {
    borderWidth: 1,
    borderColor: "#D7B69F",
  },

  todayText: {
    color: "#E8C6A8",
  },

  selectedDate: {
    backgroundColor: Colors.accent,
    borderWidth: 0,
  },

  selectedDateText: {
    color: Colors.white,
    fontWeight: "800",
  },

  calendarHint: {
    color: "#B8C3D1",
    textAlign: "center",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  // Interests

  interestSection: {
    alignItems: "center",
    gap: Spacing.md,
  },

  sectionTitle: {
    color: Colors.primary,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },

  sectionDescription: {
    color: Colors.secondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },

  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },

  interestChip: {
    backgroundColor: "#203B60",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#203B60",
  },

  interestChipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },

  interestText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  interestTextSelected: {
    color: Colors.white,
  },

  // Feature Cards

  featuresSection: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },

  featuresHeading: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
  },

  featuresHeadingAccent: {
    color: Colors.accent,
    fontStyle: "italic",
  },

  featuresSubtitle: {
    color: Colors.secondary,
    fontSize: 12,
    textAlign: "center",
  },

  featureStack: {
    width: "100%",
    height: 405,
    marginTop: Spacing.md,
    position: "relative",
  },

  featureCard: {
    position: "absolute",
    width: "82%",
    height: 155,
    borderRadius: 22,
    padding: Spacing.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#FFFFFF22",
    shadowColor: "#101D30",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  featureLeft: {
    top: 0,
    left: 0,
    zIndex: 1,
  },

  featureRight: {
    top: 115,
    right: 0,
    zIndex: 2,
  },

  featureCenter: {
    top: 245,
    left: "9%",
    zIndex: 3,
  },

  featureCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  featureNumber: {
    color: "#E8C6A8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  featureArrow: {
    color: "#E8C6A8",
    fontSize: 21,
  },

  featureTitle: {
    color: Colors.white,
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },

  featureDescription: {
    color: "#D5DCE5",
    fontSize: 10,
    marginTop: 5,
  },

  featureTap: {
    color: "#E8C6A8",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  featureFooter: {
    color: Colors.secondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: Spacing.sm,
  },

  footer: {
    color: Colors.muted,
    fontSize: 8,
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  // Shared Modals

  modalOverlay: {
    flex: 1,
    backgroundColor: "#101D30CC",
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

  // Feature Modal

  featureModalCard: {
    width: "100%",
    borderRadius: 26,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  featureCloseButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  featureCloseText: {
    color: Colors.white,
    fontSize: 29,
  },

  featureModalNumber: {
    color: "#E8C6A8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
  },

  featureModalDecoration: {
    color: "#E8C6A8",
    fontSize: 31,
  },

  featureModalTitle: {
    color: Colors.white,
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
  },

  featureModalDescription: {
    color: "#E0E5EC",
    fontSize: 13,
    lineHeight: 22,
  },

  featureModalAction: {
    backgroundColor: "#F7F5F0",
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },

  featureModalActionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  featureModalActionArrow: {
    color: Colors.accent,
    fontSize: 20,
  },

  featureModalFooter: {
    color: "#B8C3D1",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
