import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

export interface ImageItem {
    id?: string;
    url: string;
    isNew?: boolean;
}

interface SortableImageListProps {
    images: ImageItem[];
    onReorder: (images: ImageItem[]) => void;
    onRemove: (index: number) => void;
    onAdd: () => void;
}

export function SortableImageList({ images, onReorder, onRemove, onAdd }: SortableImageListProps) {
    const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ImageItem>) => {
        const index = getIndex();
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    style={[
                        styles.imageThumbContainer,
                        isActive && styles.activeItem
                    ]}
                >
                    <ExpoImage 
                        source={{ uri: item.url }} 
                        style={styles.imageThumb} 
                        contentFit="cover" 
                    />
                    {item.isNew && <View style={styles.newBadge} />}
                    
                    <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => {
                            if (index !== undefined) {
                                onRemove(index);
                            }
                        }}
                    >
                        <View style={styles.deleteIconBg}>
                            <IconSymbol name="xmark" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <ThemedText style={styles.label}>Photos</ThemedText>
                <ThemedText style={styles.hint}>Long press to reorder</ThemedText>
            </View>
            
            <View style={styles.listContainer}>
                {/* Add Button - Fixed at start or separate? 
                    DraggableFlatList works best when all items are draggable. 
                    Let's keep the Add button separate outside the list for simplicity,
                    matching the design where it's to the left/start. 
                    However, vertical list usually has add at end. 
                    The existing design was horizontal scroll.
                    Let's try to mimic the existing layout: Add Button | [Draggable List]
                */}
                 <TouchableOpacity onPress={onAdd} style={styles.addImageBtn}>
                    <IconSymbol name="plus" size={24} color={Colors.dark.icon} />
                    <ThemedText style={styles.addImageText}>Add</ThemedText>
                </TouchableOpacity>

                <DraggableFlatList
                    data={images}
                    style={{ flex: 1 }}
                    onDragEnd={({ data }) => onReorder(data)}
                    keyExtractor={(item, index) => item.id || item.url + index} 
                    renderItem={renderItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    activationDistance={10} // Easier activation for horizontal
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 4
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        marginLeft: 4,
    },
    hint: {
        fontSize: 12,
        color: '#666',
    },
    listContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 125, // Fixed height to match items
    },
    listContent: {
        gap: 12,
        paddingRight: 20
    },
    addImageBtn: {
        width: 100,
        height: 125,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 8,
        marginRight: 12, // Gap between button and list
    },
    addImageText: {
        fontSize: 14,
        color: '#888'
    },
    imageThumbContainer: {
        width: 100,
        height: 125,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1A1A1A',
        marginRight: 12, // Gap between items in list
    },
    activeItem: {
        opacity: 0.8,
        transform: [{ scale: 1.05 }],
        borderColor: Colors.dark.tint,
        borderWidth: 2,
    },
    imageThumb: {
        width: '100%',
        height: '100%'
    },
    newBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.tint
    },
    deleteButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        padding: 4, // Hit slop area
    },
    deleteIconBg: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    }
});
