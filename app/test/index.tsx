import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardCountSlider, sharedStyles, Subject, SubjectCard } from "./shared";

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
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <ThemedText type="title" style={sharedStyles.title} adjustsFontSizeToFit={true} numberOfLines={1}>SELECT SUBJECT</ThemedText>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={sharedStyles.selectionGrid}>
                            <SubjectCard icon="wineglass.fill" label="COCKTAILS" onPress={() => selectSubject("COCKTAILS")} />
                            <SubjectCard icon="menucard.fill" label="MENU" onPress={() => selectSubject("MENU")} />
                            <SubjectCard icon="mug.fill" label="BEERS" onPress={() => selectSubject("BEERS")} />
                            <SubjectCard icon="wineglass" label="WINES" onPress={() => selectSubject("WINES")} />
                        </ScrollView>
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
