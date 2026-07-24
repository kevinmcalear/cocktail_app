import { AuthField } from '@/components/auth/AuthShell';
import { CustomIcon } from '@/components/ui/CustomIcons';
import type { GlasswareIconKey } from '@/lib/glasswareIcons';
import { syncGlassMask } from '@/lib/syncGlassMask';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { XStack, useTheme } from 'tamagui';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoComplete?: 'password' | 'new-password' | 'current-password';
  textContentType?: 'password' | 'newPassword';
  onSubmitEditing?: () => void;
};

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder = 'Password',
  autoComplete = 'password',
  textContentType = 'password',
  onSubmitEditing,
}: Props) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [mask, setMask] = useState<GlasswareIconKey[]>([]);

  const color = theme.color?.get() as string;
  const muted = theme.color11?.get() as string;
  const border = theme.borderColor?.get() as string;
  const bg = theme.background?.get() as string;

  const handleChange = (next: string) => {
    setMask((prev) => syncGlassMask(prev, next.length));
    onChangeText(next);
  };

  return (
    <AuthField label={label}>
      <XStack
        alignItems="center"
        height={44}
        borderWidth={1}
        borderColor={border}
        borderRadius={8}
        backgroundColor={bg}
        paddingRight={4}
      >
        <View style={{ flex: 1, height: 44, justifyContent: 'center' }}>
          {!visible && value.length > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                paddingLeft: 12,
              }}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44 }}>
                  {mask.map((key, i) => (
                    <CustomIcon key={`${i}-${key}`} name={key} size={16} color={muted} />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            value={value}
            onChangeText={handleChange}
            placeholder={placeholder}
            placeholderTextColor={muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={autoComplete}
            textContentType={textContentType}
            // real secureTextEntry uses platform bullets — we paint glassware instead
            secureTextEntry={false}
            onSubmitEditing={onSubmitEditing}
            style={{
              flex: 1,
              height: 44,
              paddingHorizontal: 12,
              fontSize: 16,
              color: visible ? color : 'transparent',
            }}
          />
        </View>

        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          style={{ padding: 8 }}
        >
          <MaterialIcons
            name={visible ? 'visibility-off' : 'visibility'}
            size={20}
            color={muted}
          />
        </Pressable>
      </XStack>
    </AuthField>
  );
}
