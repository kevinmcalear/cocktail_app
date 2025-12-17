import { CocktailCard } from "@/components/CocktailCard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { categories, cocktails } from "@/data/cocktails";
import { PlatformPressable } from "@react-navigation/elements";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

export default function ExploreScreen() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredCocktails = selectedCategory === "All"
    ? cocktails
    : cocktails.filter(c => c.category === selectedCategory);

  return (
    <ThemedView style={styles.container}>
      <GlassView style={styles.header} intensity={80}>
        <ThemedText type="title" style={styles.title}>Explore</ThemedText>
        <GlassView style={styles.searchBar} intensity={50}>
          <IconSymbol name="magnifyingglass" size={20} color={Colors.dark.icon} />
          <ThemedText style={styles.placeholder}>Search for a cocktail...</ThemedText>
        </GlassView>
      </GlassView>

      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isActive = item === selectedCategory;
            return (
              <PlatformPressable onPress={() => setSelectedCategory(item)}>
                <GlassView
                  style={[styles.categoryPill, isActive && styles.activePill]}
                  intensity={isActive ? 80 : 30}
                >
                  <ThemedText style={[styles.categoryText, isActive && { color: Colors.dark.tint }]}>
                    {item}
                  </ThemedText>
                </GlassView>
              </PlatformPressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredCocktails}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CocktailCard cocktail={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 0,
  },
  title: {
    marginBottom: 15,
    fontSize: 34
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 15,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.2)"
  },
  placeholder: {
    color: Colors.dark.icon
  },
  categoriesContainer: {
    marginVertical: 20,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 10
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  activePill: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: Colors.dark.tint,
    borderWidth: 1
  },
  categoryText: {
    fontWeight: "600"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
});
