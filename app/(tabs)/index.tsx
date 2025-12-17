import { CocktailCard } from "@/components/CocktailCard";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/ctx/AuthContext";
import { cocktails } from "@/data/cocktails";
import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";


export default function HomeScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const filteredCocktails = cocktails.filter((cocktail) =>
    cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      {/* Background Image if we want one, or just the dark color */}
      {/* <Image
        source={{ uri: "https://some-dark-texture.jpg" }}
        style={StyleSheet.absoluteFill}
      /> */}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="title" style={styles.title}>Caretaker's{"\n"}Cottage</ThemedText>
            <TouchableOpacity onPress={() => setProfileMenuVisible(true)}>
              <Image
                source={{ uri: user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80" }}
                style={styles.avatar}
              />
            </TouchableOpacity>
            <ProfileMenu visible={profileMenuVisible} onClose={() => setProfileMenuVisible(false)} />
          </View>

          <GlassView style={styles.searchContainer} intensity={40}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.dark.icon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find your drink..."
              placeholderTextColor={Colors.dark.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.icon} />
              </TouchableOpacity>
            )}
          </GlassView>

          <View style={styles.categories}>
            {["Cocktails", "Wines", "Beers"].map((cat, index) => (
              <GlassView
                key={cat}
                style={[styles.categoryPill, index === 0 && styles.activeCategory]}
                intensity={index === 0 ? 80 : 30}
              >
                <ThemedText style={[styles.categoryText, index === 0 && { color: Colors.dark.tint }]}>{cat}</ThemedText>
              </GlassView>
            ))}
          </View>
        </View>

        <FlatList
          data={filteredCocktails}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CocktailCard cocktail={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 25,
    marginBottom: 20,
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
    padding: 0, // Reset default padding
  },
  categories: {
    flexDirection: "row",
    gap: 10,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  activeCategory: {
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  categoryText: {
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // Space for LiquidTabBar
  },
});
