import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, View } from "react-native";

interface MenuItem {
    cocktail_id: string;
    name: string;
    description: string;
    price: string;
    image_url: string | null;
    ingredients: string;
}

interface Menu {
    id: string;
    name: string;
    description: string;
}

interface DatabaseMenuDrink {
    cocktail_id: string;
    // joined data
    cocktails: {
        name: string;
        description: string | null;
        recipes: {
            ingredients: {
                name: string;
            } | null;
        }[];
        cocktail_images: {
            sort_order: number;
            images: {
                url: string;
            } | null;
        }[];
    } | null;
}

export default function MenuScreen() {
    const colorScheme = useColorScheme();
    const [loading, setLoading] = useState(true);
    const [activeMenu, setActiveMenu] = useState<Menu | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    
    // Switch between menus if multiple active (for now just pick first active or allow simple toggle)
    // Detailed menu management could be a separate admin screen.
    // Here we just want to VIEW the menu.

    useFocusEffect(
        useCallback(() => {
            fetchMenu();
        }, [])
    );

    const fetchMenu = async () => {
        try {
            setLoading(true);
            
            // 1. Get the primary active menu
            const { data: menuData, error: menuError } = await supabase
                .from('menus')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (menuError) {
                if (menuError.code !== 'PGRST116') { // Ignore "Row not found"
                    console.error("Error fetching menu:", menuError);
                }
                setActiveMenu(null);
                setMenuItems([]);
            } else if (menuData) {
                setActiveMenu(menuData);
                
                // 2. Fetch drinks for this menu
                const { data: drinksData, error: drinksError } = await supabase
                    .from('menu_drinks')
                    .select(`
                        cocktail_id,
                        sort_order,
                        cocktails (
                            name,
                            description,
                            recipes (
                                ingredients!recipes_ingredient_id_fkey ( name )
                            ),
                            cocktail_images (
                                sort_order,
                                images ( url )
                            )
                        )
                    `)
                    .eq('menu_id', menuData.id)
                    .order('sort_order');

                if (drinksError) throw drinksError;

                if (drinksData) {
                    // Cast deeply nested data safely or use the interface
                    const typedData = drinksData as unknown as DatabaseMenuDrink[];
                    
                    const parsedItems: MenuItem[] = typedData
                        .filter(item => item.cocktails) // Ensure cocktail exists
                        .map((item) => {
                            const c = item.cocktails!;
                            
                            // Get primary image
                            const images = c.cocktail_images || [];
                            const sortedImages = images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                            const imageUrl = sortedImages.length > 0 ? sortedImages[0].images?.url || null : null;

                            // Format ingredients
                            const ingNames = c.recipes?.map(r => r.ingredients?.name).filter(Boolean).join(", ") || "";

                            return {
                                cocktail_id: item.cocktail_id,
                                name: c.name,
                                description: c.description || "",
                                ingredients: ingNames,
                                price: "", // Price not yet in schema, leaving blank or simulated
                                image_url: imageUrl
                            };
                        });
                    setMenuItems(parsedItems);
                }
            }
        } catch (e) {
            console.error("Menu fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </ThemedView>
        );
    }

    if (!activeMenu) {
         return (
            <ThemedView style={styles.container}>
                <GlassView style={styles.header} intensity={80}>
                    <ThemedText type="title" style={styles.title}>Menu</ThemedText>
                    <ThemedText style={styles.subtitle}>No Active Menu</ThemedText>
                </GlassView>
                <View style={[styles.loadingContainer, { justifyContent: 'flex-start', paddingTop: 100 }]}>
                    <IconSymbol name="wineglass" size={64} color="#333" />
                    <ThemedText style={{ color: '#666', marginTop: 20 }}>Create a menu in "Add Cocktail" to get started.</ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <GlassView style={styles.header} intensity={80}>
                <ThemedText type="title" style={styles.title}>{activeMenu.name}</ThemedText>
                <ThemedText style={styles.subtitle}>Current Selections</ThemedText>
            </GlassView>

            <FlatList
                data={menuItems}
                keyExtractor={(item) => item.cocktail_id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <GlassView style={styles.menuItem} intensity={40}>
                        {item.image_url ? (
                            <Image
                                source={{ uri: item.image_url }}
                                style={styles.image}
                            />
                        ) : (
                            <View style={[styles.image, { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }]}>
                                <IconSymbol name="wineglass" size={32} color="rgba(255,255,255,0.2)" />
                            </View>
                        )}
                        
                        <View style={styles.details}>
                            <View style={styles.row}>
                                <ThemedText type="subtitle" style={styles.name}>{item.name}</ThemedText>
                                {/* Price removed per user request */}
                                {/* <ThemedText style={styles.price}>{item.price}</ThemedText> */}
                            </View>
                            <ThemedText style={styles.description}>{item.description}</ThemedText>
                            <ThemedText style={styles.ingredients}>{item.ingredients}</ThemedText>
                        </View>
                    </GlassView>
                )}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        marginBottom: 10
    },
    title: {
        fontSize: 34,
        color: Colors.dark.text
    },
    subtitle: {
        color: Colors.dark.icon,
        fontSize: 16
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 15
    },
    menuItem: {
        flexDirection: "row",
        padding: 12,
        borderRadius: 20,
        gap: 12,
        alignItems: "center"
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    details: {
        flex: 1,
        gap: 4
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    name: {
        fontSize: 18,
        flex: 1
    },
    price: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.tint
    },
    description: {
        fontSize: 14,
        color: Colors.dark.text,
        opacity: 0.9
    },
    ingredients: {
        fontSize: 12,
        color: Colors.dark.icon,
        fontStyle: "italic"
    }
});

