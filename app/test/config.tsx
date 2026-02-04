import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardCountSlider, CocktailCategory, ShakerToggle, sharedStyles, Subject } from "./shared";

export default function ConfigScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        subject: Subject,
        cocktailCategory?: CocktailCategory,
        cardCount: string
    }>();

    const initialCardCount = parseInt(params.cardCount || "10");
    const [cardCount, setCardCount] = useState(initialCardCount);
    const [includeMeasurements, setIncludeMeasurements] = useState(true);
    const sliderPos = useSharedValue((initialCardCount - 5) / 15);

    useEffect(() => {
        sliderPos.value = (cardCount - 5) / 15;
    }, [cardCount]);

    const startQuiz = () => {
        router.push({
            pathname: "/test/quiz",
            params: {
                subject: params.subject,
                cocktailCategory: params.cocktailCategory,
                cardCount,
                includeMeasurements: includeMeasurements ? "true" : "false"
            }
        });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <ThemedText type="title" style={sharedStyles.title} adjustsFontSizeToFit={true} numberOfLines={1}>CONFIGURE TEST</ThemedText>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.configContainer}>
                        <ThemedText type="subtitle" style={styles.configTitle}>TESTING MODE</ThemedText>
                        <ShakerToggle
                            active={includeMeasurements}
                            onPress={() => setIncludeMeasurements(!includeMeasurements)}
                        />

                        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                            <GlassView style={styles.startButtonContent} intensity={40}>
                                <ThemedText style={styles.startButtonText}>START TEST</ThemedText>
                            </GlassView>
                        </TouchableOpacity>
                    </View>

                    <CardCountSlider
                        cardCount={cardCount}
                        onCountChange={setCardCount}
                        sliderPos={sliderPos}
                    />
                </SafeAreaView>
            </ThemedView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    configContainer: { flex: 1, padding: 40, justifyContent: "center", gap: 30 },
    configTitle: { fontSize: 28, textAlign: "center", marginBottom: 10 },
    startButton: { height: 60, marginTop: 20 },
    startButtonContent: { flex: 1, borderRadius: 15, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)" },
    startButtonText: { fontSize: 20, fontWeight: "bold", letterSpacing: 2, color: Colors.dark.tint },
});
