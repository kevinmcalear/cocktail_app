import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Text } from "tamagui";

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
    generateComponent?: React.ReactNode;
}

export function SortableImageList({ images, onReorder, onRemove, onAdd, generateComponent }: SortableImageListProps) {
    const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ImageItem>) => {
        const index = getIndex();
        return (
            <ScaleDecorator>
                <View
                    style={[
                        styles.imageThumbContainer,
                        isActive && styles.activeItem
                    ]}
                >
                    <TouchableOpacity 
                        onLongPress={drag}
                        disabled={isActive}
                        style={{ width: '100%', height: '100%' }}
                        activeOpacity={0.9}
                    >
                        <ExpoImage 
                            source={{ uri: item.url }} 
                            style={styles.imageThumb} 
                            contentFit="cover" 
                        />
                        {item.isNew && <View style={styles.newBadge} />}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => {
                            if (index !== undefined) {
                                onRemove(index);
                            }
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View style={styles.deleteIconBg}>
                            <IconSymbol name="xmark" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScaleDecorator>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>Photos</Text>
                <Text style={styles.hint}>Long press to reorder</Text>
            </View>
            
            <View style={styles.listContainer}>
                <DraggableFlatList
                    data={images}
                    style={{ flex: 1 }}
                    onDragEnd={({ data }) => onReorder(data)}
                    keyExtractor={(item, index) => item.id || item.url + index} 
                    renderItem={renderItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    activationDistance={10}
                    ListHeaderComponent={
                        <View style={styles.actionCard}>
                            <TouchableOpacity onPress={onAdd} style={styles.actionCardTop}>
                                <IconSymbol name="plus" size={18} color={Colors.dark.icon} />
                                <Text style={styles.actionCardText}>Add</Text>
                            </TouchableOpacity>
                            <View style={styles.actionCardDivider} />
                            <View style={styles.actionCardBottom}>
                                {generateComponent}
                            </View>
                        </View>
                    }
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
        height: 150, 
    },
    listContent: {
        gap: 12,
        paddingRight: 20
    },
    actionCard: {
        width: 100,
        height: 125,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginTop: 12.5,
        overflow: 'hidden',
    },
    actionCardTop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    actionCardBottom: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCardDivider: {
        height: 1,
        backgroundColor: '#333',
        width: '100%',
    },
    actionCardText: {
        fontSize: 13,
        color: '#888',
        fontWeight: '500',
    },
    imageThumbContainer: {
        width: 100,
        height: 125,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1A1A1A',
        marginTop: 12.5,
    },
    activeItem: {
        opacity: 0.8,
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
