import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";
import { CardCountSlider, CocktailCategory, sharedStyles, Subject, SubjectCard } from "./_shared";

export default function CocktailCategorySelection() {
    const router = useRouter();
    const params = useLocalSearchParams<{ subject: Subject, cardCount: string }>();

    const initialCardCount = parseInt(params.cardCount || "10");
    const [cardCount, setCardCount] = useState(initialCardCount);
    const sliderPos = useSharedValue((initialCardCount - 5) / 15);

    // Update slider position if cardCount changes via params (rare but good for consistency)
    useEffect(() => {
        sliderPos.value = (cardCount - 5) / 15;
    }, [cardCount]);

    const selectCategory = (c: CocktailCategory) => {
        router.push({
            pathname: "/test/config",
            params: {
                subject: params.subject,
                cocktailCategory: c,
                cardCount
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
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <Text style={[sharedStyles.title, { fontSize: 24 }]} adjustsFontSizeToFit={true} numberOfLines={1}>COCKTAIL CATEGORY</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={sharedStyles.selectionGrid}>
                            <SubjectCard icon="arrow.up.circle.fill" label="TOP 20" onPress={() => selectCategory("TOP_20")} />
                            <SubjectCard icon="star.circle.fill" label="TOP 40" onPress={() => selectCategory("TOP_40")} />
                            <SubjectCard icon="book.fill" label="STUDY PILE" onPress={() => selectCategory("STUDY_PILE")} />
                            <SubjectCard icon="dice.fill" label="RANDOM" onPress={() => selectCategory("RANDOM")} />
                        </View>
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
