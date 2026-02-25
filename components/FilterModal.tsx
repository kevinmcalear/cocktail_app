import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    selectedCategory: "All" | "Cocktails" | "Beers" | "Wines";
    onSelectCategory: (category: "All" | "Cocktails" | "Beers" | "Wines") => void;
    showFavesOnly: boolean;
    onToggleFavesOnly: () => void;
}

export function FilterModal({
    visible,
    onClose,
    selectedCategory,
    onSelectCategory,
    showFavesOnly,
    onToggleFavesOnly,
}: FilterModalProps) {
    const insets = useSafeAreaInsets();

    const handleCategorySelect = (cat: "All" | "Cocktails" | "Beers" | "Wines") => {
        Haptics.selectionAsync();
        onSelectCategory(cat);
    };

    const handleFavesToggle = () => {
        Haptics.selectionAsync();
        onToggleFavesOnly();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <GlassView style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]} intensity={80} tint="dark">
                            <View style={styles.dragIndicator} />
                            
                            <View style={styles.header}>
                                <ThemedText type="subtitle" style={styles.title}>Filters</ThemedText>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <IconSymbol name="xmark.circle.fill" size={24} color={Colors.dark.icon} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Category</ThemedText>
                                <View style={styles.categoryFiltersContainer}>
                                    {["All", "Cocktails", "Beers", "Wines"].map((cat) => {
                                        const isSelected = selectedCategory === cat;
                                        return (
                                            <TouchableOpacity 
                                                key={cat} 
                                                onPress={() => handleCategorySelect(cat as any)}
                                                style={styles.categoryPillWrapper}
                                            >
                                                <GlassView 
                                                    style={[styles.categoryPill, isSelected && styles.categoryPillSelected]} 
                                                    intensity={isSelected ? 60 : 15}
                                                >
                                                    <ThemedText style={[styles.categoryPillText, isSelected && styles.categoryPillTextSelected]}>
                                                        {cat}
                                                    </ThemedText>
                                                </GlassView>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.section}>
                                <TouchableOpacity 
                                    style={styles.toggleRow} 
                                    onPress={handleFavesToggle}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.toggleTextContainer}>
                                        <IconSymbol name="heart.fill" size={20} color={showFavesOnly ? "#FF4B4B" : Colors.dark.icon} />
                                        <ThemedText style={styles.toggleLabel}>Only show favourites</ThemedText>
                                    </View>
                                    <View style={[styles.toggleSwitch, showFavesOnly && styles.toggleSwitchActive]}>
                                        <View style={[styles.toggleKnob, showFavesOnly && styles.toggleKnobActive]} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.applyButton} onPress={onClose}>
                                <ThemedText style={styles.applyButtonText}>Show Results</ThemedText>
                            </TouchableOpacity>
                        </GlassView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        color: Colors.dark.icon,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        fontWeight: '600',
    },
    categoryFiltersContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryPillWrapper: {
        height: 40,
        minWidth: 80,
    },
    categoryPill: {
        flex: 1,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.01)",
        paddingHorizontal: 16,
    },
    categoryPillSelected: {
        backgroundColor: "rgba(255,255,255,0.2)",
        borderColor: "rgba(255,255,255,0.4)",
    },
    categoryPillText: {
        fontSize: 14,
        fontWeight: '600',
        color: "rgba(255,255,255,0.6)",
    },
    categoryPillTextSelected: {
        color: "#FFFFFF",
        fontWeight: '800',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    toggleTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    toggleSwitch: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        padding: 2,
    },
    toggleSwitchActive: {
        backgroundColor: '#4A90E2',
    },
    toggleKnob: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleKnobActive: {
        transform: [{ translateX: 20 }],
    },
    applyButton: {
        backgroundColor: '#4A90E2',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    applyButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
