import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Colors } from "@/constants/theme";

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.secondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 65,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: "safari", android: "explore", web: "explore" }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="itinerary"
        options={{
          title: "Itinerary",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: "note.text",
                android: "edit_note",
                web: "edit_note",
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: "person.crop.circle",
                android: "account_circle",
                web: "account_circle",
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
