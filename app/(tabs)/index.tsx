import { ProfileMenu } from "@/components/ProfileMenu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/ctx/AuthContext";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

const { width } = Dimensions.get('window');

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
      {/* Background Image with Fade */}
      <View style={styles.backgroundContainer}>
        <Image
          source={require("@/assets/images/caretakers-bar-bg.jpg")}
          style={styles.backgroundImage}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', Colors.dark.background]}
          style={styles.backgroundGradient}
          locations={[0.4, 1.0]}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {/* Title as Button (though already home) */}
          <TouchableOpacity onPress={() => { }}>
            <ThemedText type="title" style={styles.title}>Caretaker's Cottage</ThemedText>
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
                <GlassView style={styles.gridItem} intensity={15}>
                  <View style={styles.shine} />
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
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 500, // Adjust height as needed
    zIndex: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8, // Increased opacity to show more of the image (was 0.15)
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1, // Ensure content is above background
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
    fontSize: 28, // Reduced from 36 to avoid overlapping profile button
    lineHeight: 32,
    // Add text shadow for better visibility over image
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
    justifyContent: "space-between", // Restore 2x2 spacing
  },
  gridItemWrapper: {
    width: "47%", // Safe width for 2-column with gap
    height: 90, // Taller buttons (Slightly larger than previous 80)
    marginBottom: 0,
  },
  gridItem: {
    flex: 1,
    borderRadius: 22, // Slightly more round
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)", // Shiny edge
    backgroundColor: "rgba(255,255,255,0.01)", // Even more subtle filler for transparency
    overflow: 'hidden', // Contain shine
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%', // slightly taller shine
    backgroundColor: 'rgba(255,255,255,0.06)', // Slightly stronger shine for contrast
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  gridLabel: {
    fontSize: 18, // Increased from 16
    fontWeight: "700", // Slightly bolder
    letterSpacing: 2,
    color: Colors.dark.text,
    textAlign: "center",
  },
});
