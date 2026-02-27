import { CustomIcon } from "@/components/ui/CustomIcons";
import { useAuth } from "@/ctx/AuthContext";
import { Image } from "expo-image";
import { Tabs } from "expo-router";

import { LiquidTabBar } from "@/components/LiquidTabBar";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  
  const avatarUrl = user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80";

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
          title: "Menus",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabMenus" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="drinks"
        options={{
          title: "Drinks",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabDrinks" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="ingredients"
        options={{
          title: "Ingredients",
          tabBarIcon: ({ color, size }) => (
            <CustomIcon name="TabIngredients" size={size} color={color} />
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
          tabBarIcon: ({ color, size, focused }) => (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: size + 2,
                height: size + 2,
                borderRadius: (size + 2) / 2,
                borderWidth: focused ? 1 : 0,
                borderColor: "#FFFFFF"
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
