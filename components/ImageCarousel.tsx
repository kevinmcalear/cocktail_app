import { Colors } from '@/constants/theme';
import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    ImageSourcePropType,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
    ViewStyle
} from 'react-native';

interface ImageCarouselProps {
    images: (string | ImageSourcePropType)[];
    onImagePress?: () => void;
    style?: ViewStyle;
    initialIndex?: number;
    onIndexChange?: (index: number) => void;
    scrollEnabled?: boolean;
}

export function ImageCarousel({
    images,
    onImagePress,
    style,
    initialIndex = 0,
    onIndexChange,
    scrollEnabled = true
}: ImageCarouselProps) {
    const { width } = useWindowDimensions();
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (activeIndex !== initialIndex) {
            setActiveIndex(initialIndex);
        }
    }, [initialIndex]);

    useEffect(() => {
        if (scrollViewRef.current && initialIndex >= 0) {
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
                scrollEnabled={scrollEnabled}
            >
                {images.map((image, index) => {
                    const source = typeof image === 'string' ? { uri: image } : image;
                    return (
                        <Pressable key={index} onPress={onImagePress} style={{ width, height: '100%' }}>
                            <Image
                                source={source}
                                style={{ width: width, height: '100%' }}
                                resizeMode="cover"
                            />
                        </Pressable>
                    );
                })}
            </ScrollView>

            {images.length > 1 && (
                <View style={styles.pagination}>
                    {images.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                { opacity: index === activeIndex ? 1 : 0.5 }
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
    pagination: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        zIndex: 1,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.text,
        marginHorizontal: 4,
    }
});
