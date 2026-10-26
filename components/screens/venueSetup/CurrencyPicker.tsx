import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { currencyChoices, isCurrencyCode } from '@/lib/money';

/**
 * Where and when's Currency row, open (board w2-venue-setup, E28b): the usual
 * currencies as chips, the country's first, and Another currency by its code.
 */
export function CurrencyPicker({ value, first, onPick }: { value: string | null; first: string | null; onPick: (code: string) => void }) {
  const choices = currencyChoices(first);
  const [typed, setTyped] = useState(value && !choices.includes(value) ? value : '');
  const code = typed.trim().toUpperCase();
  const wrong = code.length === 3 && !isCurrencyCode(code);
  return (
    <View style={styles.wrap}>
      <View role="radiogroup" accessibilityLabel="Currency" style={styles.chips}>
        {choices.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={value === c}
            onPress={() => {
              setTyped('');
              onPick(c);
            }}
          />
        ))}
      </View>
      <Field
        label="Another currency"
        value={typed}
        onChangeText={(t) => {
          setTyped(t);
          const next = t.trim().toUpperCase();
          if (isCurrencyCode(next)) onPick(next);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={3}
        error={wrong ? 'Three capital letters, like CHF.' : undefined}
        hint="Three capital letters, like CHF."
      />
      <Caption tone="muted">Prices and costs show in this. Changing it later doesn’t convert prices already typed.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
