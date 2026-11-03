import React, { type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

export { dragGripStyle, gripOnly, supportsNestableDrag } from './dragGrip';

/** A page that may hold a nested drag list: on a phone the list needs this container. Web: FormScrollContainer.web.tsx. */
export function FormScrollContainer({ ref, ...props }: ComponentProps<typeof ScrollView>) {
    return <NestableScrollContainer {...props} ref={ref as ComponentProps<typeof NestableScrollContainer>['ref']} />;
}
