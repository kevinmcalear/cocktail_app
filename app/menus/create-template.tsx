import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";
import { capitalize, capitalizeAsYouType, handleCapitalizedChange } from "@/lib/stringUtils";

interface SectionInput {
    id: string; // temporary for UI key mapping
    name: string;
    minItems: string;
    maxItems: string;
}

export default function CreateTemplateScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEditing = !!id;

    const [templateName, setTemplateName] = useState("");
    const [templateDescription, setTemplateDescription] = useState("");
    
    // Start with one blank section by default
    const [sections, setSections] = useState<SectionInput[]>([
        { id: `sec-${Date.now()}`, name: '', minItems: '1', maxItems: '' }
    ]);
    const [saving, setSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditing);

    useEffect(() => {
        if (!isEditing || !id) return;
        
        async function loadTemplate() {
            try {
                const { data: template } = await supabase.from('menu_templates').select('*').eq('id', id).single();
                if (template) {
                    setTemplateName(template.name);
                    setTemplateDescription(template.description || "");
                }

                const { data: sectionsData } = await supabase.from('template_sections').select('*').eq('template_id', id).order('sort_order', { ascending: true });
                if (sectionsData && sectionsData.length > 0) {
                    setSections(sectionsData.map((s: any) => ({
                        id: s.id, // real UUID
                        name: s.name,
                        minItems: s.min_items ? s.min_items.toString() : '1',
                        maxItems: s.max_items ? s.max_items.toString() : ''
                    })));
                } else {
                    setSections([{ id: `sec-${Date.now()}`, name: '', minItems: '1', maxItems: '' }]);
                }
            } catch (err) {
                console.error("Error loading template", err);
                Alert.alert("Error", "Could not load the template.");
            } finally {
                setIsLoading(false);
            }
        }
        
        loadTemplate();
    }, [id, isEditing]);

    const handleAddSection = () => {
        setSections(prev => [
            ...prev,
            { id: `sec-${Date.now()}`, name: '', minItems: '1', maxItems: '' }
        ]);
    };

    const handleRemoveSection = (idToRemove: string) => {
        if (sections.length <= 1) {
            Alert.alert("Required", "A template must have at least one section.");
            return;
        }
        setSections(prev => prev.filter(s => s.id !== idToRemove));
    };

    const handleSectionChange = (id: string, field: keyof SectionInput, value: string) => {
        setSections(prev => prev.map(s => 
            s.id === id ? { ...s, [field]: value } : s
        ));
    };

    const handleSave = async () => {
        if (!templateName.trim()) {
            Alert.alert("Missing Name", "Please enter a name for your template.");
            return;
        }
        
        const invalidSections = sections.filter(s => !s.name.trim());
        if (invalidSections.length > 0) {
            Alert.alert("Missing Section Names", "Please ensure all sections have a name.");
            return;
        }

        setSaving(true);
        try {
            let templateId = id;

            // 1. Create or Update Template Parent Record
            if (isEditing && id) {
                const { error: templateError } = await supabase
                    .from('menu_templates')
                    .update({
                        name: capitalize(templateName.trim()),
                        description: templateDescription.trim(),
                    })
                    .eq('id', id);

                if (templateError) throw templateError;
            } else {
                const { data: newTemplate, error: templateError } = await supabase
                    .from('menu_templates')
                    .insert({
                        name: capitalize(templateName.trim()),
                        description: templateDescription.trim(),
                    })
                    .select()
                    .single();

                if (templateError || !newTemplate) throw templateError;
                templateId = newTemplate.id;
            }

            // 2. Prepare Template Sections mapping formatting numeric strings correctly
            const sectionsToUpsert = sections.map((sec, index) => {
                const min = parseInt(sec.minItems, 10);
                const max = parseInt(sec.maxItems, 10);
                
                const payload: any = {
                    template_id: templateId,
                    name: capitalize(sec.name.trim()),
                    min_items: isNaN(min) ? 1 : min,
                    max_items: isNaN(max) ? null : max,
                    sort_order: index
                };
                
                if (!sec.id.startsWith('sec-')) {
                    payload.id = sec.id;
                }
                
                return payload;
            });

            // 3. Handle Deletions if Editing
            if (isEditing && id) {
                const { data: existingSections } = await supabase.from('template_sections').select('id').eq('template_id', id);
                if (existingSections) {
                    const currentIds = sectionsToUpsert.filter(s => s.id).map(s => s.id);
                    const idsToDelete = existingSections.map(s => s.id).filter(sId => !currentIds.includes(sId));
                    if (idsToDelete.length > 0) {
                        await supabase.from('template_sections').delete().in('id', idsToDelete);
                    }
                }
            }

            // 4. Bulk Upsert Sections
            const sectionsToUpdate = sectionsToUpsert.filter(s => s.id);
            const sectionsToInsert = sectionsToUpsert.filter(s => !s.id);
            
            if (sectionsToUpdate.length > 0) {
                const { error: updateError } = await supabase.from('template_sections').upsert(sectionsToUpdate);
                if (updateError) throw updateError;
            }
            if (sectionsToInsert.length > 0) {
                const { error: insertError } = await supabase.from('template_sections').insert(sectionsToInsert);
                if (insertError) throw insertError;
            }

            // Success
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            
            Alert.alert("Success", `Template ${isEditing ? 'updated' : 'created'} successfully!`, [
                { text: "OK", onPress: () => router.back() }
            ]);
            
        } catch (error) {
            console.error("Save template error", error);
            Alert.alert("Error", `Failed to ${isEditing ? 'update' : 'create'} the template.`);
        } finally {
            setSaving(false);
        }
    };

    const styles = useMemo(
        () =>
            StyleSheet.create({
                container: { flex: 1, backgroundColor: colors.background },
                header: {
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                    borderBottomLeftRadius: 30,
                    borderBottomRightRadius: 30,
                    marginBottom: 10,
                },
                headerRow: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 8 },
                backButton: { padding: 5 },
                title: { fontSize: 34, color: colors.text },
                subtitle: { fontSize: 16, color: colors.icon, marginLeft: 4 },
                content: { padding: 20, gap: 20 },
                inputSection: {},
                label: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 8, marginLeft: 4 },
                subLabel: { fontSize: 13, color: colors.icon, marginBottom: 6, marginLeft: 4 },
                input: {
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    borderRadius: 15,
                    padding: 16,
                    color: colors.text,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                },
                inputSmall: {
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    borderRadius: 12,
                    padding: 14,
                    color: colors.text,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                },
                sectionsHeader: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                    paddingBottom: 10,
                },
                addSectionBtnSmall: {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    padding: 6,
                    paddingHorizontal: 12,
                    backgroundColor: "rgba(230, 126, 34, 0.15)",
                    borderRadius: 12,
                },
                sectionBlock: {
                    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    borderRadius: 20,
                    padding: 16,
                },
                sectionBlockHeader: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    paddingHorizontal: 4,
                },
                sectionBlockTitle: { fontWeight: "bold", fontSize: 16, color: colors.text },
                requirementsRow: { flexDirection: "row", gap: 12 },
                addSectionBtnLarge: {
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)",
                    gap: 8,
                },
                addSectionText: { color: colors.icon, fontSize: 16, fontWeight: "600" },
                footerSpacer: { height: 60 },
                footer: {
                    paddingHorizontal: 20,
                    paddingTop: 10,
                    backgroundColor: colors.background,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
                },
                createButton: { backgroundColor: colors.tint, padding: 18, borderRadius: 15, alignItems: "center" },
                disabledButton: { opacity: 0.5 },
                createButtonText: { color: isDark ? "#000" : "#fff", fontWeight: "bold", fontSize: 18 },
            }),
        [colors, isDark],
    );

    if (isLoading) {
        return (
            <YStack style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color={colors.tint} />
            </YStack>
        );
    }

    return (
        <YStack style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { fontSize: 34, fontWeight: 'bold' }]}>
                        {isEditing ? 'Edit Template' : 'Create Template'}
                    </Text>
                </View>
                <Text style={styles.subtitle}>
                    {isEditing ? 'Modify your template structure.' : 'Design the structure for your menus.'}
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                
                <View style={styles.inputSection}>
                    <Text style={styles.label}>Template Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Caretakers Format"
                        placeholderTextColor={colors.icon}
                        value={templateName}
                        onChangeText={(val) => handleCapitalizedChange(val, templateName, setTemplateName)}
                        onBlur={() => setTemplateName(capitalize(templateName))}
                    />
                </View>

                <View style={styles.inputSection}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 80, paddingTop: 16 }]}
                        placeholder="A brief description of this template's use case..."
                        placeholderTextColor={colors.icon}
                        value={templateDescription}
                        onChangeText={setTemplateDescription}
                        multiline
                    />
                </View>

                <View style={styles.sectionsHeader}>
                    <Text style={[styles.label, { marginBottom: 0 }]}>Menu Sections</Text>
                    <TouchableOpacity onPress={handleAddSection} style={styles.addSectionBtnSmall}>
                        <IconSymbol name="plus" size={16} color={colors.tint} />
                        <Text style={{ color: colors.tint, fontWeight: "bold" }}>Add</Text>
                    </TouchableOpacity>
                </View>

                {sections.map((sec, index) => (
                    <View key={sec.id} style={styles.sectionBlock}>
                        <View style={styles.sectionBlockHeader}>
                            <Text style={styles.sectionBlockTitle}>Section {index + 1}</Text>
                            <TouchableOpacity onPress={() => handleRemoveSection(sec.id)}>
                                <IconSymbol name="trash" size={20} color="#ff4444" />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput
                            style={[styles.input, { marginBottom: 12 }]}
                            placeholder="Section Name (e.g. Starters)"
                            placeholderTextColor={colors.icon}
                            value={sec.name}
                            onChangeText={(val) => {
                                const prevVal = sec.name || "";
                                handleCapitalizedChange(val, prevVal, (newVal) => {
                                    handleSectionChange(sec.id, 'name', newVal);
                                });
                            }}
                            onBlur={() => handleSectionChange(sec.id, 'name', capitalize(sec.name))}
                        />
                        
                        <View style={styles.requirementsRow}>
                            <View style={{flex: 1}}>
                                <Text style={styles.subLabel}>Min Items required</Text>
                                <TextInput
                                    style={styles.inputSmall}
                                    placeholder="1"
                                    placeholderTextColor={colors.icon}
                                    keyboardType="numeric"
                                    value={sec.minItems}
                                    onChangeText={(val) => handleSectionChange(sec.id, 'minItems', val)}
                                />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={styles.subLabel}>Max Items allowed</Text>
                                <TextInput
                                    style={styles.inputSmall}
                                    placeholder="No limit"
                                    placeholderTextColor={colors.icon}
                                    keyboardType="numeric"
                                    value={sec.maxItems}
                                    onChangeText={(val) => handleSectionChange(sec.id, 'maxItems', val)}
                                />
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={styles.addSectionBtnLarge} onPress={handleAddSection}>
                    <IconSymbol name="plus" size={20} color={colors.icon} />
                    <Text style={styles.addSectionText}>Add Another Section</Text>
                </TouchableOpacity>

                <View style={styles.footerSpacer} />
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity
                    style={[styles.createButton, (saving || !templateName.trim()) && styles.disabledButton]}
                    disabled={saving || !templateName.trim()}
                    onPress={handleSave}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={isDark ? "#000" : "#fff"} />
                    ) : (
                        <Text style={styles.createButtonText}>Save Template</Text>
                    )}
                </TouchableOpacity>
            </View>

        </YStack>
    );
}
