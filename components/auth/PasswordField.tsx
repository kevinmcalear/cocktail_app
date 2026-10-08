import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { GlasswareIconKey } from '@/lib/glasswareIcons';
import { syncGlassMask } from '@/lib/syncGlassMask';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoComplete?: 'password' | 'new-password' | 'current-password';
  textContentType?: 'password' | 'newPassword';
  onSubmitEditing?: () => void;
};

/**
 * A labelled password input that hides what's typed behind a row of little
 * glasses instead of bullets, with a show/hide toggle. Matches ds `Field`.
 */
export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder = 'Password',
  autoComplete = 'current-password',
  textContentType = 'password',
  onSubmitEditing,
}: Props) {
  const ds = useDs();
  const [visible, setVisible] = useState(false);
  const [mask, setMask] = useState<GlasswareIconKey[]>([]);

  const handleChange = (next: string) => {
    setMask((prev) => syncGlassMask(prev, next.length));
    onChangeText(next);
  };

  return (
    <View style={styles.field}>
      <Caption tone="muted">{label}</Caption>
      <View style={[styles.box, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
        <View style={styles.inputWrap}>
          {!visible && value.length > 0 ? (
            <View pointerEvents="none" style={styles.mask}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.maskRow}>
                  {mask.map((key, i) => (
                    <CustomIcon key={`${i}-${key}`} name={key} size={16} color={ds.c.muted} />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            value={value}
            onChangeText={handleChange}
            placeholder={placeholder}
            placeholderTextColor={ds.c.faint}
            aria-label={label}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={autoComplete}
            textContentType={textContentType}
            // Keep real secure entry (screen readers, keyboards and password managers
            // depend on it); the platform bullets are painted transparent and the
            // glassware mask is drawn on top instead.
            secureTextEntry={!visible}
            onSubmitEditing={onSubmitEditing}
            style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: visible ? ds.c.ink : 'transparent' }]}
          />
        </View>

        <Pressable
          onPress={() => setVisible((v) => !v)}
          role="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={styles.toggle}
        >
          <IconSymbol name={visible ? 'eye.slash' : 'eye'} size={20} color={ds.c.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTapTarget,
    borderWidth: 1,
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
  inputWrap: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  mask: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', paddingLeft: space.md },
  maskRow: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: layout.minTapTarget },
  input: { flex: 1, minHeight: layout.minTapTarget, paddingHorizontal: space.md },
  toggle: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
