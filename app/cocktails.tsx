import { CocktailList, CocktailListItem } from "@/components/CocktailList";
import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function CocktailsScreen() {
    const router = useRouter();
    const [cocktails, setCocktails] = useState<CocktailListItem[]>([]);

    useEffect(() => {
        fetchCocktails();
    }, []);

    const fetchCocktails = async () => {
        try {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    id,
                    name,
                    description,
                    recipes (
                        ingredients!recipes_ingredient_id_fkey (
                            name
                        )
                    ),
                    cocktail_images (
                        images (
                            url
                        )
                    )
                `)
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) setCocktails(data as unknown as CocktailListItem[]);
        } catch (error) {
            console.error('Error fetching cocktails:', error);
        }
    };

    const headerButtons = (
        <View style={styles.filterButtonsContainer}>
            {[
                { id: "top20", label: "TOP\n20", route: "/top20" },
                { id: "top40", label: "TOP\n40", route: "/top40" },
                { id: "favs", label: "MY\nFAVOURITES", route: "/favorites" }
            ].map((item) => (
                <TouchableOpacity
                    key={item.id}
                    style={styles.filterButtonWrapper}
                    onPress={() => router.push(item.route as any)}
                >
                    <GlassView style={styles.filterButton} intensity={15}>
                        <View style={styles.filterButtonShine} />
                        <ThemedText style={styles.filterButtonLabel}>{item.label}</ThemedText>
                    </GlassView>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <CocktailList
                title="Cocktails"
                cocktails={cocktails}
                headerButtons={headerButtons}
            />
        </>
    );
}

const styles = StyleSheet.create({
    filterButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        marginTop: 20,
        gap: 8,
    },
    filterButtonWrapper: {
        flex: 1,
        height: 64,
    },
    filterButton: {
        flex: 1,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.01)",
        overflow: 'hidden',
    },
    filterButtonShine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '45%',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    filterButtonLabel: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 2,
        color: Colors.dark.text,
        textAlign: "center",
        lineHeight: 16,
    }
});
