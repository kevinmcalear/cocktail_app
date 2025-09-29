import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { categories, Cocktail, cocktails } from "@/data/cocktails";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Image mapping for different cocktails
const getCocktailImage = (imageKey: string) => {
  const imageMap: { [key: string]: string } = {
    "old-fashioned":
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=200&fit=crop&crop=center",
    "gin-fizz":
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=200&fit=crop&crop=center",
    manhattan:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=200&fit=crop&crop=center",
    margarita:
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=200&fit=crop&crop=center",
    "whiskey-sour":
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=200&fit=crop&crop=center",
    spritz:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=200&fit=crop&crop=center",
    "bourbon-smash":
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=200&fit=crop&crop=center",
    negroni:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=200&fit=crop&crop=center",
  };
  return imageMap[imageKey] || imageMap["old-fashioned"];
};

export default function CocktailsScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const colorScheme = useColorScheme();

  const filteredCocktails = useMemo(() => {
    return cocktails.filter(cocktail => {
      const matchesSearch =
        cocktail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cocktail.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        cocktail.ingredients.some(ingredient =>
          ingredient.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesCategory =
        selectedCategory === "All" || cocktail.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const renderCocktailCard = (cocktail: Cocktail) => (
    <ThemedView key={cocktail.id} style={styles.cocktailCard}>
      {/* Cocktail Image */}
      {cocktail.image && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getCocktailImage(cocktail.image) }}
            style={styles.cocktailImage}
            contentFit="cover"
          />
        </View>
      )}

      <View style={styles.cocktailHeader}>
        <ThemedText type="subtitle" style={styles.cocktailName}>
          {cocktail.name}
        </ThemedText>
        <View style={styles.difficultyBadge}>
          <ThemedText
            style={[
              styles.difficultyText,
              {
                color:
                  cocktail.difficulty === "Easy"
                    ? "#27AE60"
                    : cocktail.difficulty === "Medium"
                    ? "#F39C12"
                    : "#E74C3C",
              },
            ]}
          >
            {cocktail.difficulty}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.cocktailDescription}>
        {cocktail.description}
      </ThemedText>

      <View style={styles.cocktailMeta}>
        <View style={styles.metaItem}>
          <IconSymbol
            name="clock"
            size={16}
            color={Colors[colorScheme ?? "light"].icon}
          />
          <ThemedText style={styles.metaText}>{cocktail.prepTime}</ThemedText>
        </View>
        <View style={styles.metaItem}>
          <IconSymbol
            name="tag"
            size={16}
            color={Colors[colorScheme ?? "light"].icon}
          />
          <ThemedText style={styles.metaText}>{cocktail.category}</ThemedText>
        </View>
      </View>

      <View style={styles.ingredientsSection}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          Ingredients:
        </ThemedText>
        {cocktail.ingredients.map((ingredient, index) => (
          <ThemedText key={index} style={styles.ingredient}>
            • {ingredient}
          </ThemedText>
        ))}
      </View>

      <View style={styles.instructionsSection}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          Instructions:
        </ThemedText>
        <ThemedText style={styles.instructions}>
          {cocktail.instructions}
        </ThemedText>
      </View>
    </ThemedView>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#E67E22", dark: "#1A1A1A" }}
      headerImage={
        <IconSymbol
          size={310}
          color={Colors[colorScheme ?? "light"].tint}
          name="wineglass.fill"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <View style={styles.titleTextContainer}>
            <ThemedText type="title" style={styles.title}>
              Caretaker&apos;s Cocktails
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Discover our signature cocktails crafted with care
            </ThemedText>
          </View>
          <Link href="/add-cocktail" asChild>
            <TouchableOpacity
              style={[
                styles.addButton,
                {
                  backgroundColor: Colors[colorScheme ?? "light"].tint,
                  shadowColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <IconSymbol
                  name="plus"
                  size={18}
                  color={colorScheme === "dark" ? "#000" : "#fff"}
                />
              </View>
              <ThemedText
                style={[
                  styles.addButtonText,
                  {
                    color: colorScheme === "dark" ? "#000" : "#fff",
                  },
                ]}
              >
                Add New
              </ThemedText>
            </TouchableOpacity>
          </Link>
        </View>
      </ThemedView>

      {/* Search Bar */}
      <ThemedView style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
              borderColor: Colors[colorScheme ?? "light"].tint,
            },
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={Colors[colorScheme ?? "light"].icon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
            placeholder="Search cocktails, ingredients..."
            placeholderTextColor={Colors[colorScheme ?? "light"].icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </ThemedView>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              {
                backgroundColor:
                  selectedCategory === category
                    ? Colors[colorScheme ?? "light"].tint
                    : "transparent",
                borderColor: Colors[colorScheme ?? "light"].tint,
              },
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <ThemedText
              style={[
                styles.categoryText,
                {
                  color:
                    selectedCategory === category
                      ? colorScheme === "dark"
                        ? "#000"
                        : "#fff"
                      : Colors[colorScheme ?? "light"].text,
                },
              ]}
            >
              {category}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <ThemedText style={styles.resultsCount}>
        {filteredCocktails.length} cocktail
        {filteredCocktails.length !== 1 ? "s" : ""} found
      </ThemedText>

      {/* Cocktail List */}
      <View style={styles.cocktailList}>
        {filteredCocktails.map(renderCocktailCard)}
      </View>

      {filteredCocktails.length === 0 && (
        <ThemedView style={styles.emptyState}>
          <IconSymbol
            name="wineglass"
            size={64}
            color={Colors[colorScheme ?? "light"].icon}
          />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No cocktails found
          </ThemedText>
          <ThemedText style={styles.emptyDescription}>
            Try adjusting your search or category filter
          </ThemedText>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    textAlign: "left",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "left",
    opacity: 0.8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    minWidth: 120,
    shadowColor: "#E67E22",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  categoryScroll: {
    marginBottom: 20,
  },
  categoryContainer: {
    paddingHorizontal: 4,
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultsCount: {
    textAlign: "center",
    marginBottom: 20,
    opacity: 0.7,
  },
  cocktailList: {
    gap: 16,
  },
  cocktailCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(230, 126, 34, 0.2)",
    backgroundColor: "rgba(230, 126, 34, 0.05)",
    overflow: "hidden",
  },
  imageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  cocktailImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  cocktailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cocktailName: {
    flex: 1,
    marginRight: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cocktailDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  cocktailMeta: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    opacity: 0.8,
  },
  ingredientsSection: {
    marginBottom: 16,
  },
  instructionsSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 16,
  },
  ingredient: {
    marginBottom: 4,
    paddingLeft: 8,
  },
  instructions: {
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: "center",
    opacity: 0.7,
  },
});
