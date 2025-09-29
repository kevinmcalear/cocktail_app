import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function AddCocktailScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState("Classic");
  const [difficulty, setDifficulty] = useState("Easy");
  const [prepTime, setPrepTime] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  const categories = ["Classic", "Garden Fresh", "Tropical", "Seasonal"];
  const difficulties = ["Easy", "Medium", "Hard"];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Sorry, we need camera roll permissions to add photos!"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Sorry, we need camera permissions to take photos!"
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      "Add Photo",
      "Choose how you'd like to add a photo of your cocktail",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleSave = () => {
    if (
      !name.trim() ||
      !description.trim() ||
      !ingredients.trim() ||
      !instructions.trim()
    ) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }

    // Here you would typically save to your data store
    // For now, we'll just show a success message
    Alert.alert(
      "Cocktail Added!",
      "Your new cocktail has been added to the collection.",
      [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol
            name="chevron.left"
            size={24}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Add New Cocktail
        </ThemedText>
        <View style={styles.placeholder} />
      </ThemedView>

      <ThemedView style={styles.content}>
        {/* Photo Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Photo
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.imageButton,
              { borderColor: Colors[colorScheme ?? "light"].tint },
            ]}
            onPress={showImageOptions}
          >
            {imageUri ? (
              <ExpoImage
                source={{ uri: imageUri }}
                style={styles.previewImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <IconSymbol
                  name="camera"
                  size={40}
                  color={Colors[colorScheme ?? "light"].icon}
                />
                <ThemedText style={styles.imagePlaceholderText}>
                  Tap to add photo
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </ThemedView>

        {/* Basic Information */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Basic Information
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Name *</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Enter cocktail name"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Description *</ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your cocktail"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <ThemedText style={styles.label}>Category</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryContainer}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor:
                            category === cat
                              ? Colors[colorScheme ?? "light"].tint
                              : "transparent",
                          borderColor: Colors[colorScheme ?? "light"].tint,
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <ThemedText
                        style={[
                          styles.categoryText,
                          {
                            color:
                              category === cat
                                ? colorScheme === "dark"
                                  ? "#000"
                                  : "#fff"
                                : Colors[colorScheme ?? "light"].text,
                          },
                        ]}
                      >
                        {cat}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <ThemedText style={styles.label}>Difficulty</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.difficultyContainer}>
                  {difficulties.map(diff => (
                    <TouchableOpacity
                      key={diff}
                      style={[
                        styles.difficultyButton,
                        {
                          backgroundColor:
                            difficulty === diff
                              ? Colors[colorScheme ?? "light"].tint
                              : "transparent",
                          borderColor: Colors[colorScheme ?? "light"].tint,
                        },
                      ]}
                      onPress={() => setDifficulty(diff)}
                    >
                      <ThemedText
                        style={[
                          styles.difficultyText,
                          {
                            color:
                              difficulty === diff
                                ? colorScheme === "dark"
                                  ? "#000"
                                  : "#fff"
                                : Colors[colorScheme ?? "light"].text,
                          },
                        ]}
                      >
                        {diff}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Prep Time</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder="e.g., 5 minutes"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
            />
          </View>
        </ThemedView>

        {/* Recipe Details */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recipe Details
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Ingredients *</ThemedText>
            <ThemedText style={styles.helperText}>
              Enter each ingredient on a new line
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="2 oz Bourbon&#10;1/2 oz Simple Syrup&#10;2 dashes Bitters"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
              multiline
              numberOfLines={6}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Instructions *</ThemedText>
            <ThemedText style={styles.helperText}>
              Step-by-step instructions for making the cocktail
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2A2A2A" : "#F5F5F5",
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tint,
                },
              ]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="1. Add ingredients to shaker&#10;2. Shake with ice&#10;3. Strain into glass&#10;4. Garnish and serve"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
              multiline
              numberOfLines={6}
            />
          </View>
        </ThemedView>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: Colors[colorScheme ?? "light"].tint },
          ]}
          onPress={handleSave}
        >
          <ThemedText
            style={[
              styles.saveButtonText,
              {
                color: colorScheme === "dark" ? "#000" : "#fff",
              },
            ]}
          >
            Save Cocktail
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(230, 126, 34, 0.2)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
  categoryContainer: {
    flexDirection: "row",
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  difficultyContainer: {
    flexDirection: "row",
    gap: 8,
  },
  difficultyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  imageButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    alignItems: "center",
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 16,
    opacity: 0.7,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
