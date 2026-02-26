import { IconSymbol } from "@/components/ui/icon-symbol";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, YStack } from "tamagui";
import { CardCountSlider, CocktailCategory, ShakerToggle, sharedStyles, Subject } from "./_shared";

export default function ConfigScreen() {
    const router = useRouter();
    const theme = useTheme();
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
            <YStack style={sharedStyles.container} backgroundColor="$background">
                <SafeAreaView style={sharedStyles.safeArea}>
                    <Stack.Screen options={{ headerShown: false }} />
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={theme.color?.get() as string} />
                        </TouchableOpacity>
                        <Text style={[sharedStyles.title, { color: theme.color?.get() as string }]} adjustsFontSizeToFit={true} numberOfLines={1}>TESTING MODE</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.configContainer}>
                        <ShakerToggle
                            active={includeMeasurements}
                            onPress={() => setIncludeMeasurements(!includeMeasurements)}
                        />

                        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                            <View style={[styles.startButtonContent, { backgroundColor: theme.backgroundStrong?.get() as string }]}>
                                <Text style={[styles.startButtonText, { color: theme.color8?.get() as string }]}>START TEST</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <CardCountSlider
                        cardCount={cardCount}
                        onCountChange={setCardCount}
                        sliderPos={sliderPos}
                    />
                </SafeAreaView>
            </YStack>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    configContainer: { flex: 1, padding: 40, justifyContent: "center", gap: 30 },
    configTitle: { fontSize: 28, textAlign: "center", marginBottom: 10 },
    startButton: { height: 60, marginTop: 20 },
    startButtonContent: { flex: 1, borderRadius: 15, justifyContent: "center", alignItems: "center" },
    startButtonText: { fontSize: 20, fontWeight: "bold", letterSpacing: 2 },
});
