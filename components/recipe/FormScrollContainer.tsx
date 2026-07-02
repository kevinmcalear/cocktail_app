import React from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

type FormScrollContainerProps = ScrollViewProps;

export function FormScrollContainer(props: FormScrollContainerProps) {
    if (Platform.OS === 'web') {
        return <ScrollView {...props} />;
    }
    return <NestableScrollContainer {...props} />;
}

export const supportsNestableDrag = Platform.OS !== 'web';
