import { router } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Text, YStack } from "tamagui";

export default function ImportCocktailsScreen() {
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const colorScheme = useColorScheme();

  const handleUrlImport = () => {
    if (!importUrl.trim()) {
      Alert.alert("Missing URL", "Please enter a URL to import from.");
      return;
    }

    // For now, show a message about the feature
    Alert.alert(
      "Import from URL",
      "This feature will automatically extract cocktail data from websites like Club Bauhaus. Coming soon!",
      [
        {
          text: "OK",
          onPress: () => {
            // For demo purposes, show the Club Bauhaus cocktails we added
            Alert.alert(
              "Demo Import",
              "I've added 6 Club Bauhaus inspired cocktails to your collection! Check them out in the main list.",
              [{ text: "View Cocktails", onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const handleTextImport = () => {
    if (!importText.trim()) {
      Alert.alert("Missing Data", "Please paste cocktail data to import.");
      return;
    }

    Alert.alert(
      "Import from Text",
      "This feature will parse cocktail data from pasted text. Coming soon!",
      [{ text: "OK" }]
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: "Check out these amazing cocktails from Caretaker's Cottage!",
        url: "https://clubbauhaus.checkethyl.com/drinks/",
      });
    } catch (error) {
      Alert.alert("Error", "Unable to share at this time.");
    }
  };

  const sampleData = `Bauhaus Martini
A minimalist martini with geometric precision - clean lines, perfect balance, and architectural elegance.

Ingredients:
- 2.5 oz Premium Gin
- 0.5 oz Dry Vermouth
- 2 dashes Orange Bitters
- Lemon twist
- Ice

Instructions:
Stir gin and vermouth with ice in a mixing glass for 30 seconds. Strain into a chilled coupe glass. Express lemon twist over the drink and discard. Serve immediately.

Category: Classic
Difficulty: Medium
Prep Time: 4 minutes`;

  return (
    <ScrollView style={styles.container}>
      <YStack style={styles.header}>
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
        <Text style={[styles.headerTitle, { fontSize: 34, fontWeight: 'bold' }]}>
          Import Cocktails
        </Text>
        <View style={styles.placeholder} />
      </YStack>

      <YStack style={styles.content}>
        <Text style={styles.description}>
          Import cocktails from external sources like Club Bauhaus or paste
          cocktail data directly.
        </Text>

        {/* URL Import Section */}
        <YStack style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20, fontWeight: 'bold' }]}>
            Import from Website
          </Text>
          <Text style={styles.sectionDescription}>
            Enter a URL to automatically extract cocktail data from websites
            like Club Bauhaus.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website URL</Text>
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
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://clubbauhaus.checkethyl.com/drinks/"
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.importButton,
              { backgroundColor: Colors[colorScheme ?? "light"].tint },
            ]}
            onPress={handleUrlImport}
          >
            <IconSymbol
              name="globe"
              size={20}
              color={colorScheme === "dark" ? "#000" : "#fff"}
            />
            <Text
              style={[
                styles.importButtonText,
                {
                  color: colorScheme === "dark" ? "#000" : "#fff",
                },
              ]}
            >
              Import from URL
            </Text>
          </TouchableOpacity>
        </YStack>

        {/* Text Import Section */}
        <YStack style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20, fontWeight: 'bold' }]}>
            Import from Text
          </Text>
          <Text style={styles.sectionDescription}>
            Paste cocktail data in a structured format to import multiple
            cocktails at once.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cocktail Data</Text>
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
              value={importText}
              onChangeText={setImportText}
              placeholder={sampleData}
              placeholderTextColor={Colors[colorScheme ?? "light"].icon}
              multiline
              numberOfLines={15}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.importButton,
              { backgroundColor: Colors[colorScheme ?? "light"].tint },
            ]}
            onPress={handleTextImport}
          >
            <IconSymbol
              name="doc.text"
              size={20}
              color={colorScheme === "dark" ? "#000" : "#fff"}
            />
            <Text
              style={[
                styles.importButtonText,
                {
                  color: colorScheme === "dark" ? "#000" : "#fff",
                },
              ]}
            >
              Import from Text
            </Text>
          </TouchableOpacity>
        </YStack>

        {/* Share Section */}
        <YStack style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20, fontWeight: 'bold' }]}>
            Share Source
          </Text>
          <Text style={styles.sectionDescription}>
            Share the Club Bauhaus drinks menu with others.
          </Text>

          <TouchableOpacity
            style={[
              styles.shareButton,
              {
                borderColor: Colors[colorScheme ?? "light"].tint,
              },
            ]}
            onPress={handleShare}
          >
            <IconSymbol
              name="square.and.arrow.up"
              size={20}
              color={Colors[colorScheme ?? "light"].tint}
            />
            <Text
              style={[
                styles.shareButtonText,
                {
                  color: Colors[colorScheme ?? "light"].tint,
                },
              ]}
            >
              Share Club Bauhaus Menu
            </Text>
          </TouchableOpacity>
        </YStack>

        {/* Demo Section */}
        <YStack style={styles.demoSection}>
          <Text style={[styles.sectionTitle, { fontSize: 20, fontWeight: 'bold' }]}>
            🎉 Demo: Club Bauhaus Cocktails
          </Text>
          <Text style={styles.sectionDescription}>
            I've already added 6 Club Bauhaus inspired cocktails to your
            collection! They include:
          </Text>
          <View style={styles.demoList}>
            <Text style={styles.demoItem}>• Bauhaus Martini</Text>
            <Text style={styles.demoItem}>
              • Constructivist Cosmo
            </Text>
            <Text style={styles.demoItem}>• Minimalist Mule</Text>
            <Text style={styles.demoItem}>• Geometric Gimlet</Text>
            <Text style={styles.demoItem}>• Functional Fizz</Text>
            <Text style={styles.demoItem}>• Modular Manhattan</Text>
          </View>
          <Text style={styles.demoNote}>
            These cocktails embody the Bauhaus design principles: form follows
            function, minimalism, and geometric precision.
          </Text>
        </YStack>
      </YStack>
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
    paddingTop: 20,
    paddingBottom: 16,
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
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: "center",
    opacity: 0.8,
  },
  section: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(230, 126, 34, 0.2)",
    backgroundColor: "rgba(230, 126, 34, 0.05)",
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionDescription: {
    marginBottom: 20,
    opacity: 0.8,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
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
    fontSize: 14,
    textAlignVertical: "top",
    fontFamily: "monospace",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    justifyContent: "center",
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  demoSection: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(230, 126, 34, 0.4)",
    backgroundColor: "rgba(230, 126, 34, 0.1)",
  },
  demoList: {
    marginVertical: 16,
  },
  demoItem: {
    marginBottom: 8,
    fontSize: 16,
    opacity: 0.9,
  },
  demoNote: {
    fontSize: 14,
    fontStyle: "italic",
    opacity: 0.7,
    marginTop: 12,
  },
});
