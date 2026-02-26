import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MotiView } from "moti";
import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";

import { Step1Template } from "./components/Step1Template";
import { Step2Name } from "./components/Step2Name";
import { Step3Drinks } from "./components/Step3Drinks";
import { Step4Review } from "./components/Step4Review";

export default function CreateMenuWizard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const templates = dropdowns?.menuTemplates || [];
    const allSections = dropdowns?.templateSections || [];

    const [step, setStep] = useState(1);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [menuName, setMenuName] = useState("");
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);

    // Derived
    const activeSections = allSections
        .filter(s => s.template_id === selectedTemplateId)
        .sort((a, b) => a.sort_order - b.sort_order);

    const handleNext = () => {
        if (step === 1 && !selectedTemplateId) return;
        if (step === 2 && !menuName.trim()) return;
        
        if (step === 1) {
            // Init selections if empty
            const newSelections = { ...selections };
            activeSections.forEach(sec => {
                if (!newSelections[sec.id]) newSelections[sec.id] = [];
            });
            setSelections(newSelections);
        }
        
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        if (step === 1) {
            router.back();
        } else {
            setStep(prev => prev - 1);
        }
    };

    const isStepValid = () => {
        if (step === 1) return !!selectedTemplateId;
        if (step === 2) return !!menuName.trim();
        if (step === 3) {
            return activeSections.every(sec => {
                const count = (selections[sec.id] || []).length;
                return count >= (sec.min_items || 1);
            });
        }
        return true;
    };

    const handlePublish = async () => {
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
            
            for (const sec of activeSections) {
                const drinksInSection = selections[sec.id] || [];
                for (const drinkId of drinksInSection) {
                    let cocktail_id = null;
                    let beer_id = null;
                    let wine_id = null;

                    if (drinkId.startsWith('beer-')) {
                        beer_id = drinkId.replace('beer-', '');
                    } else if (drinkId.startsWith('wine-')) {
                        wine_id = drinkId.replace('wine-', '');
                    } else {
                        cocktail_id = drinkId;
                    }

                    drinksToInsert.push({
                        menu_id: newMenu.id,
                        cocktail_id: cocktail_id || undefined,
                        beer_id: beer_id || undefined,
                        wine_id: wine_id || undefined,
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
            router.back();
        } catch (error) {
            console.error("Save menu error", error);
            Alert.alert("Error", "Failed to publish the menu.");
        } finally {
            setSaving(false);
        }
    };

    if (loadingDropdowns) {
        return (
            <YStack flex={1} backgroundColor={Colors.dark.background} justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </YStack>
        );
    }

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1, backgroundColor: Colors.dark.background }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: 20 }]}>
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4].map((i) => (
                        <View 
                            key={i} 
                            style={[
                                styles.progressDot, 
                                { backgroundColor: i <= step ? Colors.dark.tint : "rgba(255,255,255,0.1)" }
                            ]} 
                        />
                    ))}
                </View>
            </View>

            {/* Screens (Moti transitions) */}
            <View style={styles.content}>
                {step === 1 && (
                    <MotiView
                        key="step1"
                        from={{ opacity: 0, translateX: -50 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: -50 }}
                        style={styles.stepContainer}
                    >
                        <Step1Template 
                            templates={templates} 
                            selectedId={selectedTemplateId} 
                            onSelect={setSelectedTemplateId} 
                            onNext={handleNext}
                        />
                    </MotiView>
                )}
                
                {step === 2 && (
                    <MotiView
                        key="step2"
                        from={{ opacity: 0, translateX: 50 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: -50 }}
                        style={styles.stepContainer}
                    >
                        <Step2Name 
                            name={menuName} 
                            onChange={setMenuName} 
                            onNext={handleNext}
                        />
                    </MotiView>
                )}

                {step === 3 && (
                    <MotiView
                        key="step3"
                        from={{ opacity: 0, translateX: 50 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: -50 }}
                        style={styles.stepContainer}
                    >
                        <Step3Drinks 
                            sections={activeSections} 
                            selections={selections} 
                            setSelections={setSelections} 
                            onNext={handleNext}
                        />
                    </MotiView>
                )}

                {step === 4 && (
                    <MotiView
                        key="step4"
                        from={{ opacity: 0, translateX: 50 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: -50 }}
                        style={styles.stepContainer}
                    >
                        <Step4Review 
                            template={templates.find(t => t.id === selectedTemplateId)}
                            name={menuName}
                            sections={activeSections}
                            selections={selections}
                            onPublish={handlePublish}
                            saving={saving}
                        />
                    </MotiView>
                )}
            </View>

            {/* Unified Footer */}
            <View style={[styles.unifiedFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity 
                    style={styles.footerCancelBtn} 
                    onPress={handleBack}
                    disabled={saving}
                >
                    <Text style={styles.footerCancelText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[
                        styles.footerNextBtn, 
                        (!isStepValid() || saving) && styles.disabledButton
                    ]} 
                    disabled={!isStepValid() || saving}
                    onPress={step === 4 ? handlePublish : handleNext}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <>
                            <Text style={styles.footerNextText}>{step === 4 ? 'Publish Menu' : 'Next'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: Colors.dark.background,
    },
    progressContainer: {
        flexDirection: "row",
        gap: 8,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    content: {
        flex: 1,
    },
    stepContainer: {
        flex: 1,
    },
    unifiedFooter: {
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        backgroundColor: Colors.dark.background,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
    },
    footerCancelBtn: {
        flex: 1,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    footerCancelText: {
        color: Colors.dark.icon,
        fontSize: 18,
        fontWeight: "500",
    },
    footerNextBtn: {
        flex: 2,
        flexDirection: "row",
        backgroundColor: Colors.dark.tint,
        paddingVertical: 18,
        borderRadius: 32,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    footerNextText: {
        color: "#000",
        fontSize: 18,
        fontWeight: "bold",
    },
    disabledButton: {
        opacity: 0.3,
    }
});
