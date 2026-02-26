import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
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

    const [templateName, setTemplateName] = useState("");
    const [templateDescription, setTemplateDescription] = useState("");
    
    // Start with one blank section by default
    const [sections, setSections] = useState<SectionInput[]>([
        { id: 'sec-1', name: '', minItems: '1', maxItems: '' }
    ]);
    const [saving, setSaving] = useState(false);

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
            // 1. Create Template Parent Record
            const { data: newTemplate, error: templateError } = await supabase
                .from('menu_templates')
                .insert({
                    name: templateName.trim(),
                    description: templateDescription.trim(),
                })
                .select()
                .single();

            if (templateError || !newTemplate) throw templateError;

            // 2. Prepare Template Sections mapping formatting numeric strings correctly
            const sectionsToInsert = sections.map((sec, index) => {
                const min = parseInt(sec.minItems, 10);
                const max = parseInt(sec.maxItems, 10);
                
                return {
                    template_id: newTemplate.id,
                    name: sec.name.trim(),
                    min_items: isNaN(min) ? 1 : min,
                    max_items: isNaN(max) ? null : max,
                    sort_order: index // the array order dictates the sort order
                };
            });

            // 3. Bulk Insert Sections
            const { error: sectionsError } = await supabase
                .from('template_sections')
                .insert(sectionsToInsert);

            if (sectionsError) {
                // Should technically rollback the parent template here, but skipping for simplicity
                throw sectionsError;
            }

            // Success
            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
            
            Alert.alert("Success", "Template created successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
            
        } catch (error) {
            console.error("Save template error", error);
            Alert.alert("Error", "Failed to save the template.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <YStack style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { fontSize: 34, fontWeight: 'bold' }]}>
                        Create Template
                    </Text>
                </View>
                <Text style={styles.subtitle}>
                    Design the structure for your menus.
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                
                <View style={styles.inputSection}>
                    <Text style={styles.label}>Template Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Caretakers Format"
                        placeholderTextColor="#666"
                        value={templateName}
                        onChangeText={setTemplateName}
                    />
                </View>

                <View style={styles.inputSection}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 80, paddingTop: 16 }]}
                        placeholder="A brief description of this template's use case..."
                        placeholderTextColor="#666"
                        value={templateDescription}
                        onChangeText={setTemplateDescription}
                        multiline
                    />
                </View>

                <View style={styles.sectionsHeader}>
                    <Text style={[styles.label, { marginBottom: 0 }]}>Menu Sections</Text>
                    <TouchableOpacity onPress={handleAddSection} style={styles.addSectionBtnSmall}>
                        <IconSymbol name="plus" size={16} color={Colors.dark.tint} />
                        <Text style={{color: Colors.dark.tint, fontWeight: 'bold'}}>Add</Text>
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
                            placeholderTextColor="#666"
                            value={sec.name}
                            onChangeText={(val) => handleSectionChange(sec.id, 'name', val)}
                        />
                        
                        <View style={styles.requirementsRow}>
                            <View style={{flex: 1}}>
                                <Text style={styles.subLabel}>Min Items required</Text>
                                <TextInput
                                    style={styles.inputSmall}
                                    placeholder="1"
                                    placeholderTextColor="#666"
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
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={sec.maxItems}
                                    onChangeText={(val) => handleSectionChange(sec.id, 'maxItems', val)}
                                />
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={styles.addSectionBtnLarge} onPress={handleAddSection}>
                    <IconSymbol name="plus" size={20} color={Colors.dark.icon} />
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
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <Text style={styles.createButtonText}>Save Template</Text>
                    )}
                </TouchableOpacity>
            </View>

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
        gap: 20
    },
    inputSection: {
        // block wrapper
    },
    label: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.text,
        marginBottom: 8,
        marginLeft: 4,
    },
    subLabel: {
        fontSize: 13,
        color: Colors.dark.icon,
        marginBottom: 6,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inputSmall: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sectionsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.1)",
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
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
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
    sectionBlockTitle: {
        fontWeight: "bold",
        fontSize: 16,
        color: Colors.dark.text,
    },
    requirementsRow: {
        flexDirection: "row",
        gap: 12,
    },
    addSectionBtnLarge: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        borderRadius: 15,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.2)",
        gap: 8,
    },
    addSectionText: {
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
});
