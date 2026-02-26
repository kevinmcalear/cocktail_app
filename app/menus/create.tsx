import { BottomSearchBar } from "@/components/BottomSearchBar";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack, useTheme } from "tamagui";

interface Cocktail {
    id: string;
    name: string;
}

export default function CreateMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const templates = dropdowns?.menuTemplates || [];
    const allSections = dropdowns?.templateSections || [];

    const [cocktails, setCocktails] = useState<Cocktail[]>([]);
    const [loadingCocktails, setLoadingCocktails] = useState(true);

    const [step, setStep] = useState<1 | 2>(1);
    const [menuName, setMenuName] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    // activeSections for the selected template
    const activeSections = allSections.filter(s => s.template_id === selectedTemplateId).sort((a, b) => a.sort_order - b.sort_order);

    // selections: { [sectionId]: cocktailId[] }
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    
    // Modal State
    const [showPicker, setShowPicker] = useState(false);
    const [pickingForSection, setPickingForSection] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);

    const theme = useTheme();
    const pickerSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    useEffect(() => {
        if (showPicker) {
            pickerSheetRef.current?.present();
        } else {
            pickerSheetRef.current?.dismiss();
            setSearchQuery("");
        }
    }, [showPicker]);

    useEffect(() => {
        const fetchCocktails = async () => {
            const { data, error } = await supabase
                .from('cocktails')
                .select('id, name')
                .order('name');
            if (data) setCocktails(data);
            setLoadingCocktails(false);
        };
        fetchCocktails();
    }, []);

    const handleNextStep = () => {
        if (!menuName.trim()) {
            Alert.alert("Missing Name", "Please enter a name for the menu.");
            return;
        }
        if (!selectedTemplateId) {
            Alert.alert("Missing Template", "Please select a template.");
            return;
        }
        // Initialize selections based on sections if going to step 2 for the first time
        const newSelections = { ...selections };
        activeSections.forEach(sec => {
            if (!newSelections[sec.id]) newSelections[sec.id] = [];
        });
        setSelections(newSelections);
        setStep(2);
    };

    const handleAddCocktail = (cocktailId: string) => {
        if (!pickingForSection) return;
        
        const currentSelected = selections[pickingForSection] || [];
        const sectionDef = activeSections.find(s => s.id === pickingForSection);
        
        if (sectionDef && sectionDef.max_items && currentSelected.length >= sectionDef.max_items) {
            Alert.alert("Section Full", `You cannot add more than ${sectionDef.max_items} drinks to this section.`);
            return;
        }

        if (currentSelected.includes(cocktailId)) {
            Alert.alert("Already Added", "This cocktail is already in this section.");
            return;
        }

        setSelections(prev => ({
            ...prev,
            [pickingForSection]: [...currentSelected, cocktailId]
        }));
        
        setShowPicker(false);
        setSearchQuery("");
        setPickingForSection(null);
    };

    const handleRemoveCocktail = (sectionId: string, cocktailId: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: (prev[sectionId] || []).filter(id => id !== cocktailId)
        }));
    };

    const isMenuValid = () => {
        return activeSections.every(sec => {
            const count = (selections[sec.id] || []).length;
            return count >= (sec.min_items || 1);
        });
    };

    const handleSaveMenu = async () => {
        if (!isMenuValid()) {
            Alert.alert("Incomplete", "Please fulfill all section requirements before saving.");
            return;
        }

        setSaving(true);
        try {
            // 1. Create Menu
            const { data: newMenu, error: menuError } = await supabase
                .from('menus')
                .insert({
                    name: menuName,
                    template_id: selectedTemplateId,
                    is_active: true
                })
                .select()
                .single();

            if (menuError || !newMenu) throw menuError;

            // 2. Add Drinks
            let globalSortOrder = 0;
            const drinksToInsert = [];
            
            // Loop through sections in order
            for (const sec of activeSections) {
                const drinksInSection = selections[sec.id] || [];
                for (const cocktailId of drinksInSection) {
                    drinksToInsert.push({
                        menu_id: newMenu.id,
                        cocktail_id: cocktailId,
                        template_section_id: sec.id,
                        sort_order: globalSortOrder++
                    });
                }
            }

            if (drinksToInsert.length > 0) {
                const { error: drinksError } = await supabase
                    .from('menu_drinks')
                    .insert(drinksToInsert);
                if (drinksError) throw drinksError;
            }

            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
            
            Alert.alert("Success", "Menu created successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Save menu error", error);
            Alert.alert("Error", "Failed to save the menu.");
        } finally {
            setSaving(false);
        }
    };

    if (loadingDropdowns || loadingCocktails) {
        return (
            <YStack style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </YStack>
        );
    }

    return (
        <YStack style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { fontSize: 34, fontWeight: 'bold' }]}>
                        {step === 1 ? "Create Menu" : "Build Menu"}
                    </Text>
                </View>
                <Text style={styles.subtitle}>
                    {step === 1 ? "Select a template to get started" : menuName}
                </Text>
            </View>

            {step === 1 ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.inputSection}>
                        <Text style={styles.label}>Menu Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Winter 2025"
                            placeholderTextColor="#666"
                            value={menuName}
                            onChangeText={setMenuName}
                        />
                    </View>

                    <Text style={[styles.label, { marginTop: 10 }]}>Select Template</Text>
                    {templates.map((template) => {
                        const isSelected = selectedTemplateId === template.id;
                        return (
                            <TouchableOpacity
                                key={template.id}
                                onPress={() => setSelectedTemplateId(template.id)}
                            >
                                <GlassView
                                    style={[styles.card, isSelected && styles.selectedCard]}
                                    intensity={isSelected ? 60 : 30}
                                >
                                    <View style={styles.cardHeader}>
                                        <Text style={[styles.cardTitle, { fontSize: 20, fontWeight: 'bold' }]}>{template.name}</Text>
                                        {isSelected && <IconSymbol name="checkmark.circle.fill" size={24} color={Colors.dark.tint} />}
                                    </View>
                                    <Text style={styles.cardDesc}>{template.description}</Text>
                                </GlassView>
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity 
                        style={styles.createNewTemplateBtn}
                        onPress={() => router.push("/menus/create-template")}
                    >
                        <IconSymbol name="plus.circle" size={24} color={Colors.dark.icon} />
                        <Text style={styles.createNewTemplateText}>Create New Template</Text>
                    </TouchableOpacity>

                    <View style={styles.footerSpacer} />
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {activeSections.map((sec) => {
                        const count = (selections[sec.id] || []).length;
                        const isFulfilled = count >= (sec.min_items || 1);
                        const isFull = sec.max_items ? count >= sec.max_items : false;

                        return (
                            <View key={sec.id} style={styles.sectionContainer}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={[styles.sectionTitle, { fontSize: 20, fontWeight: 'bold' }]}>{sec.name}</Text>
                                    <Text style={[styles.sectionCount, isFulfilled && { color: Colors.dark.tint }]}>
                                        {count} / {sec.max_items || '∞'} 
                                        {sec.min_items && sec.min_items > 0 ? ` (Min ${sec.min_items})` : ''}
                                    </Text>
                                </View>

                                {selections[sec.id]?.map((cocktailId) => {
                                    const c = cocktails.find(x => x.id === cocktailId);
                                    return (
                                        <View key={cocktailId} style={styles.cocktailRow}>
                                            <Text style={styles.cocktailName}>{c?.name}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveCocktail(sec.id, cocktailId)}>
                                                <IconSymbol name="minus.circle.fill" size={24} color="#ff4444" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}

                                {!isFull && (
                                    <TouchableOpacity 
                                        style={styles.addDrinkBtn}
                                        onPress={() => {
                                            setPickingForSection(sec.id);
                                            setShowPicker(true);
                                        }}
                                    >
                                        <IconSymbol name="plus" size={20} color={Colors.dark.icon} />
                                        <Text style={styles.addDrinkText}>Add Drink</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                    <View style={styles.footerSpacer} />
                </ScrollView>
            )}

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {step === 1 ? (
                    <TouchableOpacity
                        style={[styles.createButton, (!selectedTemplateId || !menuName.trim()) && styles.disabledButton]}
                        disabled={!selectedTemplateId || !menuName.trim()}
                        onPress={handleNextStep}
                    >
                        <Text style={styles.createButtonText}>Next: Add Drinks</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.createButton, (!isMenuValid() || saving) && styles.disabledButton]}
                        disabled={!isMenuValid() || saving}
                        onPress={handleSaveMenu}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <Text style={styles.createButtonText}>Save Menu</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Cocktail Selection Bottom Sheet */}
            <BottomSheetModal
                ref={pickerSheetRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: theme.background?.get() as string }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
                onDismiss={() => setShowPicker(false)}
            >
                <BottomSheetView style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.color?.get() as string }]}>Select Cocktail</Text>
                        <TouchableOpacity onPress={() => setShowPicker(false)}>
                            <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                        </TouchableOpacity>
                    </View>
                    <BottomSearchBar
                        placeholder="Search cocktails..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ marginBottom: 15 }}
                    />
                    <FlatList
                        data={cocktails.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.modalOption}
                                onPress={() => handleAddCocktail(item.id)}
                            >
                                <Text style={styles.modalOptionText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </BottomSheetView>
            </BottomSheetModal>
        </YStack>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 10,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 15,
        marginBottom: 8
    },
    backButton: {
        padding: 5
    },
    title: {
        fontSize: 34,
        color: Colors.dark.text
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
        marginLeft: 4,
    },
    content: {
        padding: 20,
        gap: 15
    },
    inputSection: {
        marginBottom: 10,
    },
    label: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.text,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 18,
        color: '#fff',
        fontSize: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    card: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "transparent"
    },
    selectedCard: {
        borderColor: Colors.dark.tint,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
    },
    cardTitle: {
        fontSize: 20,
        color: Colors.dark.text,
    },
    cardDesc: {
        color: Colors.dark.icon,
        fontSize: 16
    },
    createNewTemplateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 15,
        padding: 16,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.2)"
    },
    createNewTemplateText: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: "600"
    },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 22,
        color: Colors.dark.text,
    },
    sectionCount: {
        fontSize: 14,
        color: Colors.dark.icon,
        marginBottom: 4,
    },
    cocktailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 16,
        borderRadius: 15,
        marginBottom: 8,
    },
    cocktailName: {
        fontSize: 18,
        color: Colors.dark.text,
    },
    addDrinkBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        borderRadius: 15,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.2)",
        gap: 8,
        marginTop: 4,
    },
    addDrinkText: {
        color: Colors.dark.icon,
        fontSize: 16,
        fontWeight: "600",
    },
    footerSpacer: {
        height: 60,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        backgroundColor: Colors.dark.background,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
    },
    createButton: {
        backgroundColor: Colors.dark.tint,
        padding: 18,
        borderRadius: 15,
        alignItems: "center"
    },
    disabledButton: {
        opacity: 0.5
    },
    createButtonText: {
        color: "#000",
        fontWeight: "bold",
        fontSize: 18
    },
    modalContent: {
        flex: 1,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff'
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 15,
        color: '#fff',
        fontSize: 16,
        marginBottom: 15
    },
    modalOption: {
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    modalOptionText: {
        color: '#fff',
        fontSize: 18
    }
});
