import { ProfileMenu } from "@/components/ProfileMenu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/ctx/AuthContext";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const navItems = [
    { label: "COCKTAILS", route: "/cocktails" },
    { label: "WINES", route: "/wines" },
    { label: "BEERS", route: "/beers" },
    { label: "PREP", route: "/prep" },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {/* Title as Button (though already home) */}
          <TouchableOpacity onPress={() => { }}>
            <ThemedText type="title" style={styles.title}>Caretaker's{"\n"}Cottage</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setProfileMenuVisible(true)}>
            <Image
              source={{ uri: user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80" }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <ProfileMenu visible={profileMenuVisible} onClose={() => setProfileMenuVisible(false)} />
        </View>

        <View style={styles.content}>
          <View style={styles.grid}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.gridItemWrapper}
                onPress={() => router.push(item.route as any)}
              >
                <GlassView style={styles.gridItem} intensity={30}>
                  <ThemedText style={styles.gridLabel}>{item.label}</ThemedText>
                </GlassView>
              </TouchableOpacity>
            ))}
          </View>

          <GlassView style={styles.searchContainer} intensity={40}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.dark.icon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find your drink..."
              placeholderTextColor={Colors.dark.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                // Optional: navigate to cocktails with query
                // router.push({ pathname: "/cocktails", params: { q: searchQuery } }); 
                // For now, simple nav
                router.push("/cocktails");
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.icon} />
              </TouchableOpacity>
            )}
          </GlassView>
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  content: {
    paddingHorizontal: 20,
    flex: 1,
    paddingBottom: 40, // Add padding at bottom
    justifyContent: "flex-end", // Align items to bottom
    gap: 30, // Space between Grid and Search
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 25,
    // marginBottom removed as we use space-between
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 18,
    padding: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    justifyContent: "space-between",
  },
  gridItemWrapper: {
    width: "47%", // slightly less than 50% to account for gap
    aspectRatio: 1.2, // Make them slight rectangles
    marginBottom: 0, // Handled by gap
  },
  gridItem: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: 10,
  },
  gridLabel: {
    fontSize: 20, // Reduced from 22
    fontWeight: "bold",
    letterSpacing: 2,
    color: Colors.dark.text,
    textAlign: "center",
  },
});
