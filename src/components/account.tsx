import { useState } from "react";
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

export default function AccountScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing details", "Please enter your email and password.");
      return;
    }

    if (!isLogin && !name.trim()) {
      Alert.alert("Almost there", "Please enter your name.");
      return;
    }

    Alert.alert(
      isLogin ? "Welcome back!" : "Account created!",
      "Authentication will be connected in a later step.",
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <View style={styles.header}>
            <Text style={styles.brand}>OFFMAP</Text>
            <Text style={styles.tagline}>TRAVEL DIFFERENTLY.</Text>
          </View>

          {/* Welcome */}
          <View style={styles.hero}>
            <Text style={styles.heroDecoration}>✳</Text>
            <Text style={styles.eyebrow}>YOUR NEXT CHAPTER BEGINS HERE</Text>

            <Text style={styles.title}>
              Every journey
              {"\n"}
              starts with <Text style={styles.titleAccent}>you.</Text>
            </Text>

            <Text style={styles.subtitle}>
              Save your favourite places, collect your travel ideas, and keep
              all your adventures in one place.
            </Text>
          </View>

          {/* Authentication card */}
          <View style={styles.authCard}>
            <View style={styles.tabSwitch}>
              <Pressable
                onPress={() => setIsLogin(true)}
                style={[styles.tabButton, isLogin && styles.activeTab]}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Log in
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setIsLogin(false)}
                style={[styles.tabButton, !isLogin && styles.activeTab]}
              >
                <Text
                  style={[styles.tabText, !isLogin && styles.activeTabText]}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>

            <View style={styles.formHeading}>
              <Text style={styles.formTitle}>
                {isLogin ? "Welcome back." : "Join the journey."}
              </Text>
              <Text style={styles.formSubtitle}>
                {isLogin
                  ? "Pick up right where you left off."
                  : "Create an account and start exploring."}
              </Text>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YOUR NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.muted}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.muted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.muted}
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />

                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.showPassword}>
                    {showPassword ? "HIDE" : "SHOW"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {isLogin && (
              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Forgot password",
                    "Password recovery will be added later.",
                  )
                }
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}

            <Pressable onPress={handleSubmit} style={styles.submitButton}>
              <Text style={styles.submitText}>
                {isLogin ? "Log in to OFFMAP" : "Create my account"}
              </Text>
              <Text style={styles.submitArrow}>↗</Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              By continuing, you agree to use OFFMAP responsibly and make room
              for new adventures.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerQuote}>
              NOT EVERY JOURNEY NEEDS A PLAN.
            </Text>
            <Text style={styles.footerBrand}>OFFMAP © 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  },
  brand: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 6,
  },
  tagline: {
    color: Colors.secondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 2,
  },
  hero: {
    gap: Spacing.sm,
  },
  heroDecoration: {
    color: Colors.accent,
    fontSize: 30,
  },
  eyebrow: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: Colors.primary,
    fontSize: 35,
    lineHeight: 43,
    fontWeight: "800",
    letterSpacing: -1,
  },
  titleAccent: {
    color: Colors.accent,
    fontStyle: "italic",
  },
  subtitle: {
    color: Colors.secondary,
    fontSize: 13,
    lineHeight: 21,
  },
  authCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  tabSwitch: {
    flexDirection: "row",
    backgroundColor: "#F2EDE5",
    borderRadius: Radius.full,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: Radius.full,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  activeTabText: {
    color: Colors.white,
  },
  formHeading: {
    gap: 5,
  },
  formTitle: {
    color: Colors.primary,
    fontSize: 23,
    fontWeight: "800",
  },
  formSubtitle: {
    color: Colors.secondary,
    fontSize: 12,
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
    height: 49,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.primary,
    fontSize: 13,
  },
  passwordContainer: {
    minHeight: 49,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    color: Colors.primary,
    fontSize: 13,
    paddingVertical: Spacing.md,
  },
  showPassword: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -Spacing.sm,
  },
  forgotText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submitText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  submitArrow: {
    color: "#E7C5B4",
    fontSize: 20,
  },
  disclaimer: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  footerQuote: {
    color: Colors.secondary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  footerBrand: {
    color: Colors.muted,
    fontSize: 9,
  },
});
