import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Spacing } from "@/constants/theme";

type AppScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AppScreen({
  eyebrow,
  title,
  subtitle,
  children,
}: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brand}>OFFMAP</Text>
          <Text style={styles.tagline}>TRAVEL DIFFERENTLY.</Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: Colors.primary,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 2,
  },
  tagline: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  heading: {
    gap: Spacing.sm,
  },
  eyebrow: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: Colors.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
