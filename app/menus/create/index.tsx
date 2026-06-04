import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import React, { useState, useRef, useEffect } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack, XStack, Button } from "tamagui";
import { useDrafts } from "@/hooks/useDrafts";
import { resolveCocktailId, resolveBeerId, resolveWineId, updateMenuDraftsWithPublishedId } from "@/lib/drafts";
import { capitalize, capitalizeAsYouType, handleCapitalizedChange } from "@/lib/stringUtils";

import { Step1Venue } from "./_components/Step1Venue";
import { Step2Template } from "./_components/Step2Template";
import { Step3Name } from "./_components/Step3Name";
import { Step4Drinks } from "./_components/Step4Drinks";
import { Step5Review } from "./_components/Step5Review";

export default function CreateMenuWizard() {
    const router = useRouter();
    const navigation = useNavigation();
    const { draftId, barId: initialBarId } = useLocalSearchParams<{ draftId?: string, barId?: string }>();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const templates = dropdowns?.menuTemplates || [];
    const allSections = dropdowns?.templateSections || [];

    const [step, setStep] = useState(1);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [menuName, setMenuName] = useState("");
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);
    const [barId, setBarId] = useState<string | null>(initialBarId || null);

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);

    const [draftLoaded, setDraftLoaded] = useState(!draftId);
    const [furthestStep, setFurthestStep] = useState(1);
    const currentStateStr = JSON.stringify({ step, selectedTemplateId, menuName, selections, barId });
    const cleanStateStrRef = useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    useEffect(() => {
        setFurthestStep(prev => Math.max(prev, step));
    }, [step]);

    useEffect(() => {
        if (currentDraftId && !draftLoaded && drafts.length > 0) {
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                const data = draft.draft_data;
                const loadedStep = data.furthestStep || data.step || 1;
                
                // Old draft migration
                let targetStep = 1;
                if (data.hasVenueStep) {
                    targetStep = loadedStep;
                } else {
                    if (!data.barId && !initialBarId) {
                        targetStep = 1; // Must select venue first
                    } else {
                        targetStep = loadedStep + 1; // Shift step numbers by 1
                    }
                }

                setStep(targetStep);
                setFurthestStep(targetStep);
                setSelectedTemplateId(data.selectedTemplateId || null);
                setMenuName(data.menuName || data.name || "");
                setSelections(data.selections || {});
                setBarId(data.barId || initialBarId || null);
                setDraftLoaded(true);
                setNeedsCleanMark(true);
            }
        }
    }, [currentDraftId, drafts, draftLoaded, initialBarId]);

    useEffect(() => {
        if (!draftLoaded) return;
        const isDirty = currentStateStr !== cleanStateStrRef.current;
        if (!isDirty) return;

        const timer = setTimeout(() => {
            const autoSave = async () => {
                try {
                    const draftData = {
                        step,
                        furthestStep: Math.max(furthestStep, step),
                        selectedTemplateId,
                        menuName,
                        name: menuName,
                        selections,
                        barId,
                        hasVenueStep: true
                    };
                    const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'menu', draftData });
                    if (!currentDraftId && result && result.id) {
                        setCurrentDraftId(result.id);
                        router.setParams({ draftId: result.id });
                    }
                    cleanStateStrRef.current = currentStateStr;
                } catch (error) {
                    console.error("Auto-save menu draft error:", error);
                }
            };
            autoSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentStateStr, currentDraftId, draftLoaded, furthestStep, step, selectedTemplateId, menuName, selections, barId, saveDraft, router]);

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            const draftData = { 
                step, 
                furthestStep: Math.max(furthestStep, step), 
                selectedTemplateId, 
                menuName, 
                name: menuName, 
                selections, 
                barId,
                hasVenueStep: true
            };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'menu', draftData });
            
            if (!currentDraftId && result && result.id) {
                setCurrentDraftId(result.id);
                router.setParams({ draftId: result.id });
            }
            
            if (Platform.OS === 'web') {
                window.alert("Draft saved successfully!");
            } else {
                Alert.alert("Success", "Draft saved successfully!");
            }
            setNeedsCleanMark(true);
        } catch (error) {
            console.error("Draft error:", error);
            if (Platform.OS === 'web') {
                window.alert("Failed to save draft.");
            } else {
                Alert.alert("Error", "Failed to save draft.");
            }
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const isDirty = currentStateStr !== cleanStateStrRef.current;
            if (!isDirty) {
                return;
            }
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (pendingNavigationActionRef.current) {
            navigation.dispatch(pendingNavigationActionRef.current);
        }
    };

    // Derived
    const activeSections = allSections
        .filter(s => s.template_id === selectedTemplateId)
        .sort((a, b) => a.sort_order - b.sort_order);

    const handleNext = () => {
        if (step === 1 && !barId) return;
        if (step === 2 && !selectedTemplateId) return;
        if (step === 3 && !menuName.trim()) return;
        
        if (step === 2) {
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
        if (step === 1) return !!barId;
        if (step === 2) return !!selectedTemplateId;
        if (step === 3) return !!menuName.trim();
        if (step === 4) {
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
                    name: capitalize(menuName),
                    template_id: selectedTemplateId,
                    is_active: true,
                    bar_id: barId || null
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
                        const draftIdPart = drinkId.replace('beer-', '');
                        const isDraftBeer = drafts.some(d => d.id === draftIdPart && d.entity_type === 'beer');
                        if (isDraftBeer) {
                            const resolvedId = await resolveBeerId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('beer-' + draftIdPart, 'beer-' + resolvedId, drafts, saveDraft);
                            beer_id = resolvedId;
                        } else {
                            beer_id = draftIdPart;
                        }
                    } else if (drinkId.startsWith('wine-')) {
                        const draftIdPart = drinkId.replace('wine-', '');
                        const isDraftWine = drafts.some(d => d.id === draftIdPart && d.entity_type === 'wine');
                        if (isDraftWine) {
                            const resolvedId = await resolveWineId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('wine-' + draftIdPart, 'wine-' + resolvedId, drafts, saveDraft);
                            wine_id = resolvedId;
                        } else {
                            wine_id = draftIdPart;
                        }
                    } else {
                        const isDraftCocktail = drafts.some(d => d.id === drinkId && d.entity_type === 'cocktail');
                        if (isDraftCocktail) {
                            const resolvedId = await resolveCocktailId(drinkId, drafts);
                            await updateMenuDraftsWithPublishedId(drinkId, resolvedId, drafts, saveDraft);
                            cocktail_id = resolvedId;
                        } else {
                            cocktail_id = drinkId;
                        }
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

            if (currentDraftId) {
                await deleteDraft(currentDraftId);
            }

            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            cleanStateStrRef.current = currentStateStr;
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
            <View style={[styles.header, { paddingTop: 20, justifyContent: 'space-between' }]}>
                <TouchableOpacity onPress={handleSaveDraft} disabled={saving} style={{ width: 80 }}>
                    <Text color={Colors.dark.tint} fontWeight="bold">Save Draft</Text>
                </TouchableOpacity>
                
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <View 
                            key={i} 
                            style={[
                                styles.progressDot, 
                                { backgroundColor: i <= step ? Colors.dark.tint : "rgba(255,255,255,0.1)" }
                            ]} 
                        />
                    ))}
                </View>
                
                <View style={{ width: 80 }} />
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
                        <Step1Venue 
                            selectedId={barId} 
                            onSelect={setBarId} 
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
                        <Step2Template 
                            templates={templates} 
                            selectedId={selectedTemplateId} 
                            onSelect={setSelectedTemplateId} 
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
                        <Step3Name 
                            name={menuName} 
                            onChange={(val) => handleCapitalizedChange(val, menuName, setMenuName)} 
                            onBlur={() => setMenuName(capitalize(menuName))}
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
                        <Step4Drinks 
                            sections={activeSections} 
                            selections={selections} 
                            setSelections={setSelections} 
                            onNext={handleNext}
                            barId={barId}
                            menuDraftId={currentDraftId}
                        />
                    </MotiView>
                )}

                {step === 5 && (
                    <MotiView
                        key="step5"
                        from={{ opacity: 0, translateX: 50 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: -50 }}
                        style={styles.stepContainer}
                    >
                        <Step5Review 
                            template={templates.find(t => t.id === selectedTemplateId)}
                            name={menuName}
                            sections={activeSections}
                            selections={selections}
                            onPublish={handlePublish}
                            saving={saving}
                            barId={barId}
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
                    onPress={step === 5 ? handlePublish : handleNext}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <>
                            <Text style={styles.footerNextText}>{step === 5 ? 'Publish Menu' : 'Next'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
            {/* Custom Exit Modal */}
            <Modal
                visible={showExitModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowExitModal(false)}
            >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                    <YStack 
                        backgroundColor="$backgroundStrong" 
                        padding="$5" 
                        borderRadius="$4" 
                        width="85%" 
                        maxWidth={400}
                        borderWidth={1}
                        borderColor="$borderColor"
                        gap="$4"
                    >
                        <Text fontSize="$6" fontWeight="bold" color="$color">Unsaved Changes</Text>
                        <Text fontSize="$4" color="$color11">You have unsaved changes. Do you want to save your draft before leaving?</Text>
                        
                        <XStack justifyContent="flex-end" gap="$3" marginTop="$2">
                            <Button size="$3" chromeless onPress={() => setShowExitModal(false)}>
                                <Text color="$color11">Cancel</Text>
                            </Button>
                            <Button size="$3" backgroundColor="#ff4444" onPress={() => confirmExit(false)}>
                                <Text color="white" fontWeight="bold">Discard</Text>
                            </Button>
                            <Button size="$3" backgroundColor={Colors.dark.tint} onPress={() => confirmExit(true)}>
                                <Text color="#000" fontWeight="bold">Save</Text>
                            </Button>
                        </XStack>
                    </YStack>
                </View>
            </Modal>
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
