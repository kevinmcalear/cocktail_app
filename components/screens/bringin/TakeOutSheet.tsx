import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, Sheet, Title, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

import { amountShown } from './RecipeSpec';

interface TakeOutSheetProps {
  /** The drink that isn't one, while the sheet is open. */
  recipe: RecipeReading | null;
  name: string;
  usual: string;
  onClose: () => void;
  /** Saves its recipe as house-made; throws to say why it couldn't. */
  onKeep: () => Promise<void>;
  onTakeOut: () => void;
}

/**
 * "House Sweet Vermouth isn't a drink?" (board w2-import-review, E20 B): keep
 * its recipe as a house-made ingredient, so the drinks can use it, or take it
 * out of the import. Either way it leaves the review.
 */
export function TakeOutSheet({ recipe, name, usual, onClose, onKeep, onTakeOut }: TakeOutSheetProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    if (saving) return;
    setError(null);
    onClose();
  };
  const keep = async () => {
    setSaving(true);
    setError(null);
    try {
      await onKeep();
      onClose();
    } catch (e) {
      setError(`Couldn’t keep it. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setSaving(false);
    }
  };
  const title = `${name} isn’t a drink?`;

  return (
    <Sheet visible={!!recipe} onClose={close} accessibilityLabel={title}>
      <View style={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <Title>{title}</Title>
        <Body tone="muted">Keep its recipe as a house-made ingredient, so your drinks can use it. Or take it out of this import.</Body>
        {recipe?.lines.length ? (
          <View style={[styles.card, { backgroundColor: ds.c.raised }]}>
            {recipe.lines.map((line, i) => (
              <View key={i} style={[styles.line, i < recipe.lines.length - 1 ? { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
                <DsText variant="body" color={ds.c.ink} style={styles.flex}>
                  {line.ingredient}
                </DsText>
                <DsText variant="body" color={ds.c.muted} style={styles.mono}>
                  {amountShown(line, line.unit ?? usual)}
                </DsText>
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
        <Button label={saving ? 'Keeping…' : 'Keep it as house-made'} size="lg" disabled={saving} onPress={() => void keep()} />
        <Button
          label="Take it out"
          size="lg"
          variant="secondary"
          disabled={saving}
          onPress={() => {
            onTakeOut();
            onClose();
          }}
        />
        <Button label="Cancel" size="lg" variant="ghost" disabled={saving} onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl - 4, paddingTop: space.md, gap: space.lg },
  card: { borderRadius: radius.control, paddingHorizontal: space.md + 2, paddingVertical: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  flex: { flex: 1 },
  mono: { fontFamily: fontFamilies.mono },
});
