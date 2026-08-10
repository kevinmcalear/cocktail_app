import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';
import React from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

export function ViewAsBanner() {
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();

  if (viewAsRoleLevel == null) return null;

  return (
    <XStack
      position="absolute"
      top={insets.top + 8}
      alignSelf="center"
      zIndex={9998}
      backgroundColor="rgba(30, 30, 30, 0.92)"
      borderRadius={999}
      paddingVertical="$2"
      paddingHorizontal="$3"
      alignItems="center"
      gap="$3"
      maxWidth="92%"
    >
      <Text color="white" fontSize={13} fontWeight="600" numberOfLines={1}>
        Viewing as {roleLabel(viewAsRoleLevel)}
      </Text>
      <Pressable
        onPress={() => {
          if (!isSaving) void setViewAsRoleLevel(null);
        }}
        disabled={isSaving}
        hitSlop={8}
      >
        <Text color="#FFD666" fontSize={13} fontWeight="700">
          Exit
        </Text>
      </Pressable>
    </XStack>
  );
}
