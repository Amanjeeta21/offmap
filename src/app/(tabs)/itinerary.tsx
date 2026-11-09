import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useJournals } from "@/context/journal-context";

export default function ItineraryScreen() {
  const router = useRouter();
  const { journals, isLoading } = useJournals();

  function openJournal(id: string) {
    router.push({
      pathname: "/journal/[id]",
      params: { id },
    });
  }

  function createJournal() {
    router.push("/journal/create");
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

        <Text style={styles.section}>YOUR NOTEBOOKS</Text>

        {isLoading ? (
          <Text style={styles.message}>Opening your journals...</Text>
        ) : (
          journals.map((journal) => (
            <Pressable
              key={journal.id}
              style={styles.card}
              onPress={() => openJournal(journal.id)}
            >
              <Text style={styles.sample}>
                {journal.isSample ? "SAMPLE JOURNAL" : "YOUR JOURNAL"}
              </Text>

              <Text style={styles.title}>{journal.title}</Text>
              <Text style={styles.destination}>{journal.destination}</Text>
              <Text style={styles.description}>{journal.description}</Text>
              <Text style={styles.open}>OPEN NOTEBOOK ↗</Text>
            </Pressable>
          ))
        )}

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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  eyebrow: { color: Colors.accent, fontSize: 10, letterSpacing: 2 },
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
  sample: { color: Colors.accent, fontSize: 9, letterSpacing: 1.5 },
  title: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 23,
    marginTop: 12,
  },
  destination: { color: Colors.secondary, fontSize: 12, marginTop: 6 },
  description: { color: Colors.secondary, fontSize: 12, marginTop: 12 },
  open: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 20,
    letterSpacing: 1,
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
  plus: { color: Colors.accent, fontSize: 26 },
  createTitle: {
    color: Colors.primary,
    fontFamily: "Georgia",
    fontSize: 17,
    marginTop: 8,
  },
  message: { color: Colors.secondary, padding: 15 },
});
