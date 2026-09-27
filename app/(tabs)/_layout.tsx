import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CurrentUserAvatar } from "@/components/ui/UserAvatar";
import { Tabs } from "expo-router";

import { LiquidTabBar } from "@/components/LiquidTabBar";
import { AppTabs } from "@/components/nav/AppTabs";
import { useRedesign } from "@/lib/flags";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsWideWeb } from "@/hooks/useIsWideWeb";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // Wide web uses the sidebar in the root layout; phones and narrow web use the tab bar.
  const isWideWeb = useIsWideWeb();
  // The redesign swaps the whole tab layout. Flipping the flag remounts the
  // navigator, which is fine for a preview switch.
  const redesign = useRedesign();
  if (redesign) return <AppTabs />;

  return (
    <Tabs
      tabBar={isWideWeb ? () => null : (props) => <LiquidTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabHome" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="menus"
        options={{
          title: "Menus",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabMenus" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="test"
        options={{
          title: "Test",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabTest" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isWideWeb ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <CurrentUserAvatar size={size + 2} borderWidth={focused ? 1.5 : 0} borderColor={color} />
          ),
        }}
      />
      {/* Redesign-only tabs, hidden in the current layout. */}
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="prep" options={{ href: null }} />
      <Tabs.Screen name="bar" options={{ href: null }} />
      <Tabs.Screen name="collection" options={{ href: null }} />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          // Wide web searches from the sidebar and ⌘K instead.
          href: isWideWeb ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="magnifyingglass" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
