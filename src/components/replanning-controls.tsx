import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { JournalActivity, useJournals } from "@/context/journal-context";
import { replanTrip } from "@/services/replanning/replanning-service";
import { ReplanningActivity, ReplanningResult } from "@/types/replanning";

const STORAGE_KEY = "@offmap/accommodation-locations";

type Props = {
  journalId: string;
  dayId: string;
  activities: JournalActivity[];
  returnDeadline?: string | null;
};

type AccommodationMap = Record<string, string>;

function getCurrentTime(): string {
  const now = new Date();

  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

export default function ReplanningControls({
  journalId,
  dayId,
  activities,
  returnDeadline,
}: Props) {
  const { updateActivity } = useJournals();

  const [accommodation, setAccommodation] = useState("");
  const [accommodationInput, setAccommodationInput] = useState("");
  const [isEditingAccommodation, setIsEditingAccommodation] = useState(false);
  const [isLoadingAccommodation, setIsLoadingAccommodation] = useState(true);

  const [isReplanning, setIsReplanning] = useState(false);
  const [result, setResult] = useState<ReplanningResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadAccommodation = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const locations: AccommodationMap = stored ? JSON.parse(stored) : {};

        const saved = locations[journalId] ?? "";

        if (!isActive) return;

        setAccommodation(saved);
        setAccommodationInput(saved);
      } catch {
        if (!isActive) return;

        Alert.alert(
          "Unable to load accommodation",
          "Your saved accommodation could not be loaded.",
        );
      } finally {
        if (isActive) {
          setIsLoadingAccommodation(false);
        }
      }
    };

    void loadAccommodation();

    return () => {
      isActive = false;
    };
  }, [journalId]);

  async function saveAccommodation() {
    const value = accommodationInput.trim();

    if (!value) {
      Alert.alert(
        "Accommodation required",
        "Enter your hotel, accommodation or return location.",
      );
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const locations: AccommodationMap = stored ? JSON.parse(stored) : {};

      locations[journalId] = value;

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations));

      setAccommodation(value);
      setAccommodationInput(value);
      setIsEditingAccommodation(false);

      Alert.alert(
        "Accommodation saved",
        "OFFMAP will use this location as your return destination.",
      );
    } catch {
      Alert.alert(
        "Unable to save",
        "Your accommodation could not be saved. Please try again.",
      );
    }
  }

  async function handleReplan() {
    if (!accommodation.trim()) {
      Alert.alert(
        "Set your accommodation first",
        "OFFMAP needs your return location to calculate the revised itinerary.",
      );
      setIsEditingAccommodation(true);
      setAccommodationInput(accommodation);
      return;
    }

    if (!returnDeadline) {
      Alert.alert(
        "Return deadline missing",
        "Please save your daily return deadline before replanning.",
      );
      return;
    }

    if (activities.length === 0) {
      Alert.alert(
        "No activities",
        "Add activities to your itinerary before replanning.",
      );
      return;
    }

    try {
      setIsReplanning(true);

      const replanningActivities = activities.map((activity) => ({
        ...activity,
        isFixed:
          (activity as JournalActivity & { isFixed?: boolean }).isFixed ??
          false,
      })) as ReplanningActivity[];

      const proposed = await replanTrip({
        activities: replanningActivities,
        currentTime: getCurrentTime(),
        returnDeadline,
        returnLocation: accommodation,
      });

      setResult(proposed);
      setShowPreview(true);
    } catch (error) {
      Alert.alert(
        "Replanning unavailable",
        error instanceof Error
          ? error.message
          : "Something went wrong while recalculating your itinerary.",
      );
    } finally {
      setIsReplanning(false);
    }
  }

  function acceptChanges() {
    if (!result) return;

    // Apply only the proposed time changes.
    // Completed and protected activities are preserved by the optimizer.
    result.changes.forEach((change) => {
      updateActivity(journalId, dayId, change.activityId, {
        time: change.proposedTime,
      });
    });

    setShowPreview(false);

    Alert.alert(
      "Itinerary updated",
      result.changes.length > 0
        ? `${result.changes.length} activity schedule(s) updated. Activities listed as unscheduled have been left unchanged for you to review.`
        : "No schedule changes were necessary.",
    );
  }

  function discardChanges() {
    setShowPreview(false);
    setResult(null);
  }

  return (
    <View style={styles.container}>
      {/* Accommodation */}
      <View style={styles.accommodationCard}>
        <View style={styles.accommodationHeader}>
          <View style={styles.accommodationIcon}>
            <Ionicons name="bed-outline" size={19} color={Colors.primary} />
          </View>

          <View style={styles.accommodationHeading}>
            <Text style={styles.sectionEyebrow}>YOUR RETURN DESTINATION</Text>
            <Text style={styles.accommodationTitle}>Accommodation</Text>
          </View>

          {!isEditingAccommodation && accommodation ? (
            <Pressable
              onPress={() => {
                setAccommodationInput(accommodation);
                setIsEditingAccommodation(true);
              }}
              style={styles.editButton}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color={Colors.primary}
              />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        {isLoadingAccommodation ? (
          <ActivityIndicator color={Colors.primary} />
        ) : isEditingAccommodation || !accommodation ? (
          <>
            <Text style={styles.helperText}>
              Enter your hotel or the place you need to return to.
            </Text>

            <TextInput
              value={accommodationInput}
              onChangeText={setAccommodationInput}
              placeholder="e.g. Hotel name, area, city"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              autoCapitalize="words"
            />

            <View style={styles.accommodationActions}>
              {accommodation ? (
                <Pressable
                  onPress={() => {
                    setAccommodationInput(accommodation);
                    setIsEditingAccommodation(false);
                  }}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              ) : null}

              <Pressable onPress={saveAccommodation} style={styles.saveButton}>
                <Text style={styles.saveText}>Save location</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.accommodationValue}>{accommodation}</Text>
        )}
      </View>

      {/* Replan button */}
      <Pressable
        style={[styles.replanButton, isReplanning && styles.disabledButton]}
        onPress={handleReplan}
        disabled={isReplanning}
      >
        {isReplanning ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Ionicons name="refresh" size={19} color={Colors.white} />
        )}

        <Text style={styles.replanButtonText}>
          {isReplanning ? "RECALCULATING..." : "REPLAN MY TRIP"}
        </Text>
      </Pressable>

      <Text style={styles.replanDescription}>
        Recalculates your remaining itinerary using your current location, road
        travel times and return deadline.
      </Text>

      {/* Replanning preview */}
      <Modal
        visible={showPreview}
        animationType="slide"
        transparent
        onRequestClose={discardChanges}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  OFFMAP ITINERARY UPDATE
                </Text>
                <Text style={styles.modalTitle}>Your revised plan</Text>
              </View>

              <Pressable onPress={discardChanges} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.previewScroll}
              showsVerticalScrollIndicator={false}
            >
              {result ? (
                <>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>
                      {result.isFeasible
                        ? "Your return deadline looks achievable"
                        : "Your itinerary has a scheduling conflict"}
                    </Text>

                    <Text style={styles.summaryDescription}>
                      {result.explanation}
                    </Text>

                    <Text style={styles.delayText}>
                      Total delay: {result.totalDelayMinutes} min
                    </Text>
                  </View>

                  {result.changes.length > 0 ? (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewHeading}>
                        PROPOSED SCHEDULE CHANGES
                      </Text>

                      {result.changes.map((change) => {
                        const activity = activities.find(
                          (item) => item.id === change.activityId,
                        );

                        return (
                          <View
                            key={change.activityId}
                            style={styles.previewItem}
                          >
                            <Text style={styles.itemTitle}>
                              {activity?.title ?? "Activity"}
                            </Text>

                            <Text style={styles.timeChange}>
                              {change.originalTime} → {change.proposedTime}
                            </Text>

                            <Text style={styles.itemReason}>
                              {change.reason}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyPreview}>
                      No activity timings need to change.
                    </Text>
                  )}

                  {result.unscheduledActivities.length > 0 ? (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewHeading}>
                        ACTIVITIES THAT COULD NOT FIT
                      </Text>

                      {result.unscheduledActivities.map((item) => (
                        <View key={item.activityId} style={styles.warningItem}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemReason}>{item.reason}</Text>
                          <Text style={styles.itemReason}>
                            This activity will remain unchanged unless you
                            adjust it yourself.
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {result.alternativeSuggestions.map((suggestion) => (
                    <View
                      key={suggestion.activityId}
                      style={styles.previewSection}
                    >
                      <Text style={styles.previewHeading}>
                        ALTERNATIVES FOR{" "}
                        {suggestion.originalTitle.toUpperCase()}
                      </Text>

                      {suggestion.alternatives.map((alternative) => (
                        <View
                          key={`${suggestion.activityId}-${alternative.name}`}
                          style={styles.alternativeItem}
                        >
                          <Text style={styles.itemTitle}>
                            {alternative.name}
                          </Text>

                          <Text style={styles.itemReason}>
                            {alternative.location}
                          </Text>

                          <Text style={styles.itemReason}>
                            {alternative.travelTimeMinutes} min away by road
                          </Text>

                          <Text style={styles.itemReason}>
                            {alternative.reason}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}

                  {result.warnings.length > 0 ? (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewHeading}>
                        IMPORTANT WARNINGS
                      </Text>

                      {result.warnings.map((warning, index) => (
                        <Text
                          key={`${index}-${warning}`}
                          style={styles.warningText}
                        >
                          • {warning}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={discardChanges} style={styles.discardButton}>
                <Text style={styles.discardText}>Discard</Text>
              </Pressable>

              <Pressable onPress={acceptChanges} style={styles.acceptButton}>
                <Text style={styles.acceptText}>Accept changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    gap: 10,
  },
  accommodationCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: "#F1EEE6",
    gap: 10,
  },
  accommodationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  accommodationIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: "#E5DFD2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  accommodationHeading: {
    flex: 1,
  },
  sectionEyebrow: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  accommodationTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 17,
    marginTop: 3,
  },
  accommodationValue: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 18,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 7,
  },
  editButtonText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  helperText: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 15,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 12,
    color: Colors.primary,
    fontSize: 12,
  },
  accommodationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  cancelText: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  saveText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  replanButton: {
    minHeight: 47,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  disabledButton: {
    opacity: 0.65,
  },
  replanButtonText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  replanDescription: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 25, 40, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "90%",
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  modalTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 25,
    marginTop: 5,
  },
  closeButton: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: "#E5DFD2",
    alignItems: "center",
    justifyContent: "center",
  },
  previewScroll: {
    flexGrow: 0,
  },
  summaryCard: {
    backgroundColor: "#F1EEE6",
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 17,
  },
  summaryTitle: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryDescription: {
    color: Colors.secondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  delayText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 10,
  },
  previewSection: {
    marginBottom: 18,
  },
  previewHeading: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 9,
  },
  previewItem: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  warningItem: {
    padding: 11,
    marginBottom: 8,
    backgroundColor: "#F1EEE6",
    borderRadius: Radius.sm,
  },
  alternativeItem: {
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  itemTitle: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  timeChange: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  itemReason: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  warningText: {
    color: Colors.secondary,
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 5,
  },
  emptyPreview: {
    color: Colors.secondary,
    fontSize: 11,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  discardButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 13,
    alignItems: "center",
  },
  discardText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
  acceptButton: {
    flex: 1.4,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 13,
    alignItems: "center",
  },
  acceptText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
});
