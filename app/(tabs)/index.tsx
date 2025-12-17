import { CocktailCard } from "@/components/CocktailCard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { cocktails } from "@/data/cocktails";
import { Image } from "expo-image";
import { FlatList, SafeAreaView, StyleSheet, View } from "react-native";

export default function HomeScreen() {
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
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80" }}
              style={styles.avatar}
            />
          </View>

          <GlassView style={styles.searchContainer} intensity={40}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.dark.icon} />
            <ThemedText style={styles.searchText}>Find your drink...</ThemedText>
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
          data={cocktails}
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
  searchText: {
    color: Colors.dark.icon,
    fontSize: 16
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
