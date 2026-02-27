import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    ImageSourcePropType,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet, useWindowDimensions,
    View,
    ViewStyle
} from 'react-native';
import { ZoomableImage } from './ZoomableImage';

interface ImageCarouselProps {
    images: (string | ImageSourcePropType)[];
    onImagePress?: () => void;
    style?: ViewStyle;
    initialIndex?: number;
    onIndexChange?: (index: number) => void;
    scrollEnabled?: boolean;
    zoomEnabled?: boolean;
}

export function ImageCarousel({
    images,
    onImagePress,
    style,
    initialIndex = 0,
    onIndexChange,
    scrollEnabled = true,
    zoomEnabled = false,
    paginationBelow = false,
}: ImageCarouselProps & { paginationBelow?: boolean }) {
    const { width } = useWindowDimensions();

    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [isZoomed, setIsZoomed] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const lastEmittedIndex = useRef<number>(-1);

    useEffect(() => {
        if (activeIndex !== initialIndex) {
            setActiveIndex(initialIndex);
        }
    }, [initialIndex]);

    useEffect(() => {
        if (scrollViewRef.current && initialIndex >= 0) {
            // Ignore updates that match what we just emitted
            if (initialIndex === lastEmittedIndex.current) {
                return;
            }
            
            // Ensure we scroll to the correct position when initialIndex updates prop-side
            // or on mount
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({
                    x: initialIndex * width,
                    y: 0,
                    animated: false
                });
            }, 0);
        }
    }, [initialIndex, width]);

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slide = Math.round(
            event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width
        );
        if (slide !== activeIndex) {
            setActiveIndex(slide);
            if (onIndexChange) {
                lastEmittedIndex.current = slide;
                onIndexChange(slide);
            }
        }
    };

    if (!images || images.length === 0) return null;

    return (
        <View style={[styles.container, style]}>
            <ScrollView
                ref={scrollViewRef}
                pagingEnabled
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ height: '100%' }}
                scrollEnabled={scrollEnabled && !isZoomed && images.length > 1}
                style={paginationBelow ? { aspectRatio: 1, flexGrow: 0 } : { flex: 1 }}
            >
                {images.map((image, index) => {
                    // ZoomableImage expects string | { uri: string }
                    // ImageCarousel accepts (string | ImageSourcePropType)[]
                    // We need to handle the case where image is a number (require) or object
                    const source = image;
                    
                    return (
                        <Pressable 
                            key={index} 
                            onPress={zoomEnabled ? undefined : onImagePress} 
                            style={{ width, height: '100%' }}
                        >
                            {zoomEnabled ? (
                                <ZoomableImage 
                                    // Cast or transform source to match ZoomableImage expectations
                                    // If source is number (require), we might need to wrap it differently or update ZoomableImage
                                    // For now, let's assume ZoomableImage can handle ImageSourcePropType if we update it, 
                                    // OR we pass it as is and fix ZoomableImage to accept it.
                                    // Let's update ZoomableImage types in next step if needed, but here let's pass it.
                                    // Actually, ZoomableImage defined source as string | { uri: string }.
                                    // Let's coerce it for now or assume simple URIs, but better to fix types.
                                    source={typeof source === 'string' ? { uri: source } : source as any} 
                                    onZoomChange={setIsZoomed}
                                />
                            ) : (
                                <Image
                                    source={typeof source === 'string' ? { uri: source } : source}
                                    style={{ width: width, height: '100%' }}
                                    resizeMode="cover"
                                />
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>

            {images.length > 1 && (
                <View style={styles.paginationContainer}>
                    {images.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                { backgroundColor: index === activeIndex ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    paginationContainer: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
});
