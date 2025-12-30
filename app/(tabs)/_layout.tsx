import { Tabs } from "expo-router";
import { Text } from "react-native";

import { LiquidTabBar } from "@/components/LiquidTabBar";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{
              color,
              fontSize: 14,
              fontWeight: "bold",
              letterSpacing: 1
            }}>
              CLASSICS
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{
              color,
              fontSize: 14,
              fontWeight: "bold",
              letterSpacing: 1
            }}>
              CURRENT
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{
              color,
              fontSize: 14,
              fontWeight: "bold",
              letterSpacing: 1,
              textAlign: "center", // Add textAlign center for multi-word
              width: 150 // fixed width to prevent wrapping issues if needed, or let flex handle it
            }}>
              PREVIOUS{"\n"}MENUS
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
