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
import { Keyboard, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    if (searchQuery.trim().length > 0) {
      router.push(`/drinks?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push("/drinks");
    }
  };

  return (
    <ThemedView style={styles.container}>
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

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { }}>
              <ThemedText type="title" style={styles.title}>Caretaker's Cottage</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <GlassView style={styles.searchContainer} intensity={40}>
              <IconSymbol name="magnifyingglass" size={20} color={"#FFFFFF"} />
              <TextInput
                style={styles.searchInput}
                placeholder="Find a drink..."
                placeholderTextColor={"rgba(255,255,255,0.6)"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <IconSymbol name="xmark.circle.fill" size={20} color={"rgba(255,255,255,0.6)"} />
                </TouchableOpacity>
              )}
            </GlassView>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
    height: 500,
    zIndex: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
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
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  content: {
    paddingHorizontal: 20,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 25,
    width: "100%",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 18,
    padding: 0,
    height: 24,
  },
});
