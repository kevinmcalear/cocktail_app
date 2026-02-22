import { ThemedView } from "@/components/themed-view";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardCountSlider, sharedStyles, Subject, SubjectCard } from "../test/_shared";

export default function SubjectSelection() {
    const router = useRouter();
    const [cardCount, setCardCount] = useState(10);
    const sliderPos = useSharedValue((10 - 5) / 15);

    const selectSubject = (s: Subject) => {
        if (s === "COCKTAILS") {
            router.push({
                pathname: "/test/category",
                params: { subject: s, cardCount }
            });
        } else {
            router.push({
                pathname: "/test/config",
                params: { subject: s, cardCount }
            });
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <Stack.Screen options={{ headerShown: false }} />
                    <View style={{ paddingTop: 20 }} />

                    <View style={{ flex: 1 }}>
                        <View style={sharedStyles.selectionGrid}>
                            <SubjectCard icon="wineglass.fill" label="COCKTAILS" onPress={() => selectSubject("COCKTAILS")} />
                            <SubjectCard icon="menucard.fill" label="MENU" onPress={() => selectSubject("MENU")} />
                            <SubjectCard icon="mug.fill" label="BEERS" onPress={() => selectSubject("BEERS")} />
                            <SubjectCard icon="wineglass" label="WINES" onPress={() => selectSubject("WINES")} />
                        </View>
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
