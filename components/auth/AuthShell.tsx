import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, YStack } from 'tamagui';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <YStack flex={1} backgroundColor="$background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <YStack width="100%" maxWidth={400} alignSelf="center" gap="$5">
            <YStack gap="$2" alignItems="center">
              <Text
                fontSize={13}
                fontWeight="700"
                color="$color11"
                textTransform="uppercase"
                letterSpacing={1.2}
              >
                Cocktail
              </Text>
              <Text fontSize={28} fontWeight="700" color="$color" textAlign="center">
                {title}
              </Text>
              {subtitle ? (
                <Text fontSize={15} color="$color11" textAlign="center" lineHeight={22}>
                  {subtitle}
                </Text>
              ) : null}
            </YStack>

            <YStack
              backgroundColor="$backgroundStrong"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius={12}
              padding="$4"
              gap="$4"
            >
              {children}
            </YStack>

            {footer ? (
              <YStack alignItems="center" gap="$2">
                {footer}
              </YStack>
            ) : null}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </YStack>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$1.5">
      <Text fontSize={12} color="$color11" fontWeight="600">
        {label}
      </Text>
      {children}
    </YStack>
  );
}

export function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'info';
  children: string;
}) {
  return (
    <Text fontSize={13} color={tone === 'error' ? '#FF6B6B' : '$color11'} lineHeight={18}>
      {children}
    </Text>
  );
}
