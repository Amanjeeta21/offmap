import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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

const PROFILE_KEY = "@offmap/user-profile";

// ------------------------------------------
// Profile Types
// ------------------------------------------

type UserProfile = {
  name: string;
  dateOfBirth: string;
};

const EMPTY_PROFILE: UserProfile = {
  name: "",
  dateOfBirth: "",
};

// ------------------------------------------
// Quote Types and Session Cache
// ------------------------------------------

type TravelQuote = {
  quote: string;
  author: string;
};

// Cache the quote throughout the current app session.
let sessionQuote: TravelQuote | null = null;
let quoteRequest: Promise<TravelQuote> | null = null;

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

async function getSessionQuote(): Promise<TravelQuote> {
  if (sessionQuote) {
    return sessionQuote;
  }

  if (quoteRequest) {
    return quoteRequest;
  }

  const request = (async (): Promise<TravelQuote> => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_QUOTES_API_URL;

      if (!apiUrl) {
        throw new Error("Quotes API URL is missing.");
      }

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error("Unable to fetch quotes.");
      }

      const data = await response.json();

      const quotes: TravelQuote[] = data.quotes ?? [];

      const travelQuotes = quotes.filter((item) => {
        const quoteText = item.quote.toLowerCase();

        return TRAVEL_KEYWORDS.some((keyword) => quoteText.includes(keyword));
      });

      const availableQuotes =
        travelQuotes.length > 0 ? travelQuotes : FALLBACK_QUOTES;

      const randomIndex = Math.floor(Math.random() * availableQuotes.length);

      sessionQuote = availableQuotes[randomIndex];

      return sessionQuote;
    } catch (error) {
      console.log("Quote fetching failed:", error);

      const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length);

      sessionQuote = FALLBACK_QUOTES[randomIndex];

      return sessionQuote;
    }
  })();

  quoteRequest = request;

  try {
    return await request;
  } finally {
    quoteRequest = null;
  }
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

// ------------------------------------------
// Account Screen
// ------------------------------------------

export default function AccountScreen() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<UserProfile>(EMPTY_PROFILE);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [dailyQuote, setDailyQuote] = useState<TravelQuote | null>(
    sessionQuote,
  );

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
          };

          setProfile(loadedProfile);
          setSavedProfile(loadedProfile);
        }
      } catch {
        Alert.alert("Error", "Unable to load your profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  // Load one quote per app session.
  useEffect(() => {
    let isMounted = true;

    getSessionQuote().then((quote) => {
      if (isMounted) {
        setDailyQuote(quote);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save profile.
  async function saveProfile() {
    if (!profile.name.trim()) {
      Alert.alert("Missing name", "Please enter your name.");
      return;
    }

    try {
      const updatedProfile = {
        name: profile.name.trim(),
        dateOfBirth: profile.dateOfBirth,
      };

      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);
      setIsEditing(false);

      Alert.alert("Profile updated", "Your details have been saved.");
    } catch {
      Alert.alert("Error", "Unable to save your profile.");
    }
  }

  function cancelEditing() {
    setProfile(savedProfile);
    setIsEditing(false);
  }

  // Device platform.
  const devicePlatform =
    Platform.OS === "ios"
      ? "iOS"
      : Platform.OS === "android"
        ? "Android"
        : Platform.OS;

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
              The Traveller's{"\n"}
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
                <Text style={styles.avatarText}>{initials || "?"}</Text>
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
                  onPress={() => setIsEditing(true)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>EDIT</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.divider} />

            {isEditing ? (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>

                  <TextInput
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
                    style={styles.cancelButton}
                    onPress={cancelEditing}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable style={styles.saveButton} onPress={saveProfile}>
                    <Text style={styles.saveText}>Save Profile</Text>
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
          </View>

          {/* Device Information */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR DEVICE</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Text style={styles.iconText}>⌘</Text>
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Platform</Text>

                <Text style={styles.infoDescription}>
                  Device currently running OFFMAP
                </Text>
              </View>

              <Text style={styles.platformValue}>{devicePlatform}</Text>
            </View>
          </View>

          {/* Travel World */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR TRAVEL WORLD</Text>

            <View style={styles.featureCard}>
              <View style={styles.featureRow}>
                <Text style={styles.featureSymbol}>✳</Text>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Travel Statistics</Text>

                  <Text style={styles.featureDescription}>
                    Your journeys, destinations and activities.
                  </Text>
                </View>

                <Text style={styles.comingSoon}>SOON</Text>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureRow}>
                <Text style={styles.featureSymbol}>↗</Text>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Travel Insights</Text>

                  <Text style={styles.featureDescription}>
                    Discover patterns in your travels.
                  </Text>
                </View>

                <Text style={styles.comingSoon}>SOON</Text>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureRow}>
                <Text style={styles.featureSymbol}>♡</Text>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Memories</Text>

                  <Text style={styles.featureDescription}>
                    Revisit moments from your adventures.
                  </Text>
                </View>

                <Text style={styles.comingSoon}>SOON</Text>
              </View>
            </View>
          </View>

          {/* Quote of the Session */}

          <View style={styles.section}>
            <View style={styles.quoteHeading}>
              <Text style={styles.sectionLabel}>A LITTLE INSPIRATION</Text>

              <Text style={styles.quoteSessionLabel}>FOR THIS SESSION</Text>
            </View>

            <View style={styles.quoteCard}>
              <Text style={styles.quoteMark}>“</Text>

              <Text style={styles.quoteText}>
                {dailyQuote
                  ? dailyQuote.quote
                  : "Finding inspiration for your next journey..."}
              </Text>

              {dailyQuote && (
                <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text>
              )}
            </View>
          </View>

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

  iconText: {
    color: Colors.accent,
    fontSize: 21,
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

  platformValue: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "800",
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

  featureSymbol: {
    color: Colors.accent,
    fontSize: 23,
    width: 30,
    textAlign: "center",
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

  comingSoon: {
    color: Colors.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  featureDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Compact Quote Card

  quoteHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  quoteSessionLabel: {
    color: Colors.muted,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },

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
