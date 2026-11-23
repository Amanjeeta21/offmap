import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, Keyframe, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const interests = [
  {
    title: "Culture",
    icon: "people-outline",
    description: "Discover how people live, celebrate, create and connect across the world.",
    tags: {
      Traditions: "Look for everyday rituals, from how people greet guests to how they serve tea.",
      Festivals: "Find out what a celebration marks and which events welcome visitors.",
      Music: "Listen for local instruments and ask where performers play.",
      Dance: "Watch how gesture, costume, and rhythm tell a story.",
      Art: "Visit a workshop or gallery to learn how a local technique is passed on.",
      Clothing: "Notice which textiles are worn daily and which are reserved for celebrations.",
      Food: "A shared meal can reveal how people welcome guests and mark special occasions.",
      Architecture: "Look at courtyards, roofs, and materials for clues about local ways of life.",
      Customs: "Check local etiquette before entering a home, place of worship, or ceremony.",
    },
    examples: ["Indian Culture", "Japanese Culture", "African Cultures", "European Cultures",
      "Middle Eastern Cultures", "Latin American Cultures", "Indigenous Cultures"],
    exampleHeading: "Around the world",
  },
  {
    title: "Food",
    icon: "restaurant-outline",
    description: "Explore the flavours, dishes and culinary traditions that make every destination unique.",
    tags: {
      "Street Food": "See what stalls are cooking fresh and ask what locals order.",
      "Fine Dining": "Look for menus that highlight ingredients grown in the region.",
      "Traditional Dishes": "Ask how a familiar dish changes between households or regions.",
      Desserts: "Bakeries and sweet shops often have specialties tied to festivals and seasons.",
      Markets: "See which ingredients are in season and how vendors suggest cooking them.",
      "Local Flavours": "Try a spice, condiment, or ingredient you rarely see at home.",
    },
    examples: ["Indian Cuisine", "Japanese Cuisine", "Italian Cuisine", "Mexican Cuisine", "Thai Cuisine",
      "Mediterranean Cuisine", "Street Food", "Local Specialties"],
    exampleHeading: "Cuisines and specialties",
  },
  {
    title: "Adventure",
    icon: "compass-outline",
    description: "Find experiences that take you beyond the ordinary, from your first trail to an unforgettable challenge.",
    tags: {
      Trails: "Compare elevation and terrain as well as distance when choosing a trail.",
      "On the Water": "Check water conditions and ask operators what experience their trips require.",
      "In the Air": "Look for a qualified local guide and allow room in your schedule for weather changes.",
      "Overnight": "Plan a campsite around local access rules, daylight, and water sources.",
    },
    examples: ["Trekking", "Hiking", "Camping", "Rafting", "Scuba Diving", "Paragliding", "Rock Climbing", "Safari"],
    exampleHeading: "Experiences to explore",
  },
  {
    title: "Nature",
    icon: "leaf-outline",
    description: "Slow down and discover the landscapes that make a destination special.",
    tags: {
      Wildlife: "Watch from a distance and leave animals enough space to move naturally.",
      "Scenic Views": "Look for viewpoints with a clear line of sight and check visibility before leaving.",
      Sunrise: "Find an east-facing spot and check whether it opens before dawn.",
      Sunset: "Pick a west-facing viewpoint and plan your return after dusk.",
      Trails: "Look for marked routes through the habitats you want to see.",
      "Eco Trips": "Choose guides who explain how your visit supports local conservation.",
    },
    examples: ["Mountains", "Beaches", "Waterfalls", "Forests", "Lakes", "Deserts", "Wildlife", "National Parks"],
    exampleHeading: "Landscapes to discover",
  },
  {
    title: "History",
    icon: "hourglass-outline",
    description: "Step into the stories, civilizations and places that shaped the world.",
    tags: {
      Ancient: "Look for inscriptions, pottery, or foundations that reveal everyday life.",
      Medieval: "Follow old walls, gates, or trade streets to see how settlements grew.",
      Colonial: "Compare different accounts of how a place changed under colonial rule.",
      "Modern History": "Look for oral histories and archives that connect recent events to the city today.",
    },
    examples: ["Ancient Civilizations", "Forts & Castles", "Temples", "Museums", "Archaeological Sites",
      "Historic Cities", "Monuments", "Battlefields"],
    exampleHeading: "Places that tell a story",
  },
  {
    title: "Shopping",
    icon: "bag-handle-outline",
    description: "Discover local markets, unique crafts and things worth taking home.",
    tags: {
      "Local Finds": "Ask vendors which items are made nearby and where their materials come from.",
      Handmade: "Visit an artisan's workshop to see the work behind a finished piece.",
      Fashion: "Explore regional fabrics, cuts, and weaving techniques.",
      Souvenirs: "Look for small objects that have a connection to the place you visited.",
      Markets: "Check market days and hours so you can explore at your own pace.",
    },
    examples: ["Local Markets", "Handicrafts", "Souvenirs", "Fashion", "Jewelry", "Art",
      "Street Markets", "Traditional Products"],
    exampleHeading: "Things to look for",
  },
] as const;

type Interest = (typeof interests)[number];

const entrance = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.95 }, { translateY: 8 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(230).reduceMotion(ReduceMotion.System);

const light = {
  card: Colors.background, text: Colors.primary, secondary: Colors.secondary,
  accent: "#994B2E", chip: "#F2E5D9", border: Colors.border,
  selected: Colors.primary, selectedText: Colors.white, tip: "#E6EEE7", tipText: "#345741",
};
const dark = {
  card: "#182438", text: "#F7F5F0", secondary: "#C6D0DF",
  accent: "#F1A583", chip: "#263A53", border: "#3D4E65",
  selected: "#F1A583", selectedText: "#172B4D", tip: "#223C34", tipText: "#C4E1CB",
};

export function ExploreInterests() {
  const [selected, setSelected] = useState<Interest>();
  const [selectedTag, setSelectedTag] = useState(0);
  const palette = useColorScheme() === "dark" ? dark : light;
  const reduceMotion = useReducedMotion();
  const tags = selected ? Object.entries(selected.tags) : [];
  const close = () => setSelected(undefined);

  return (
    <>
      <View style={styles.grid}>
        {interests.map((interest) => (
          <Pressable
            key={interest.title}
            accessibilityRole="button"
            accessibilityState={{ expanded: selected === interest }}
            onPress={() => {
              setSelectedTag(0);
              setSelected(interest);
            }}
            style={({ pressed }) => [
              styles.entry,
              (pressed || selected === interest) && styles.entrySelected,
              !reduceMotion && pressed && styles.entryPressed,
            ]}
          >
            <Text style={styles.entryText}>{interest.title}</Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <Modal transparent visible onRequestClose={close} statusBarTranslucent>
          <View style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Dismiss interest details"
              onPress={close}
            />
            <Animated.View
              entering={entrance}
              accessibilityViewIsModal
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.header}>
                <View style={[styles.icon, { backgroundColor: palette.chip }]}>
                  <Ionicons name={selected.icon} size={22} color={palette.accent} />
                </View>
                <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{selected.title}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close interest details" onPress={close} style={styles.close}>
                  <Ionicons name="close" size={22} color={palette.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.description, { color: palette.secondary }]}>{selected.description}</Text>
                <View style={styles.tags}>
                  {tags.map(([label], index) => {
                    const active = selectedTag === index;
                    return (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedTag(index)}
                        style={[styles.tag, { backgroundColor: active ? palette.selected : palette.chip }]}
                      >
                        <Text style={[styles.tagText, { color: active ? palette.selectedText : palette.text }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.tip, { backgroundColor: palette.tip, color: palette.tipText }]}
                >
                  {tags[selectedTag]?.[1]}
                </Text>
                <Text style={[styles.exampleHeading, { color: palette.text }]}>{selected.exampleHeading}</Text>
                <ScrollView horizontal contentContainerStyle={styles.examples} showsHorizontalScrollIndicator>
                  {selected.examples.map((example) => (
                    <View key={example} style={[styles.example, { borderColor: palette.border }]}>
                      <Ionicons name="navigate-outline" size={14} color={palette.accent} />
                      <Text style={[styles.tagText, { color: palette.text }]}>{example}</Text>
                    </View>
                  ))}
                </ScrollView>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, width: "100%" },
  entry: { backgroundColor: "#203B60", paddingHorizontal: 17, paddingVertical: 14, borderRadius: Radius.sm },
  entrySelected: { backgroundColor: "#994B2E" },
  entryPressed: { transform: [{ scale: 0.96 }] },
  entryText: { color: Colors.white, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  overlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: Spacing.lg, backgroundColor: "rgba(13, 25, 43, 0.62)",
  },
  card: {
    width: "100%", maxWidth: 440, maxHeight: "87%", borderRadius: Radius.lg, borderWidth: 1,
    boxShadow: "0 12px 36px rgba(13, 25, 43, 0.24)", elevation: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
  icon: { width: 42, height: 42, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 25, fontWeight: "800" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 0 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  description: { fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginVertical: Spacing.xs },
  tag: { borderRadius: Radius.full, paddingHorizontal: 12, justifyContent: "center", minHeight: 36 },
  tagText: { fontSize: 12, fontWeight: "700" },
  tip: { borderRadius: Radius.sm, padding: Spacing.sm, fontSize: 13, lineHeight: 19 },
  exampleHeading: { fontSize: 13, fontWeight: "800", marginTop: Spacing.xs },
  examples: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  example: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
  },
});
