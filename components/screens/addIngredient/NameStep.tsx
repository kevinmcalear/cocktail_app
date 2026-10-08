import * as Device from 'expo-device';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, IngredientThumb, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useReadLabel } from '@/hooks/useReadLabel';
import { nearIngredient, sameIngredient, type IngredientAlias } from '@/lib/ingredientNames';
import { kindGuesses, type IngredientDraft } from '@/lib/ingredientWizard';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';

import type { CatalogIngredient } from '../addDrink/IngredientSearch';
import { BigName } from '../addDrink/TextSteps';

interface Props {
  draft: IngredientDraft;
  set: (change: Partial<IngredientDraft>) => void;
  ingredients: readonly CatalogIngredient[];
  aliases: readonly IngredientAlias[];
  core: readonly CatalogIngredient[];
  onDone: () => void;
  /** It's already here: use that one instead (open it, or hand it to whoever asked). */
  onUseExisting: (row: { id: string; name: string }) => void;
  resumed: boolean;
  onStartOver: () => void;
}

/**
 * The name, checked as it's typed against what's already here (by any
 * spelling or alias), so nobody makes a second Simple Syrup; and a bottle's
 * label can be snapped instead of typed.
 */
export function NameStep({ draft, set, ingredients, aliases, core, onDone, onUseExisting, resumed, onStartOver }: Props) {
  const read = useReadLabel();
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const same = draft.name.trim() ? sameIngredient(draft.name, ingredients, aliases) : null;
  const near = same ? null : nearIngredient(draft.name, ingredients, aliases);
  const hit = same ?? near;

  const snap = async (get: () => Promise<BottlePhoto | null>) => {
    try {
      const photo = await get();
      if (!photo) return;
      set({ photo });
      read.mutate(photo, {
        onSuccess: ([label]) => {
          const kind = label.kind ? kindGuesses(label.kind, core)[0] ?? core.find((c) => (c.name ?? '').toLowerCase() === label.kind?.toLowerCase()) : null;
          set({
            name: draft.name.trim() || label.name,
            maker: draft.maker || label.brand || '',
            abv: draft.abv || (label.abv !== null ? String(label.abv) : ''),
            role: draft.role ?? 'product',
            generic: draft.generic ?? (kind ? { id: kind.id, name: kind.name ?? '' } : null),
          });
        },
        onError: (e) => Alert.alert('Couldn’t read the label', e.message),
      });
    } catch (e) {
      Alert.alert('No photo', e instanceof Error ? e.message : 'Couldn’t open the photos.');
    }
  };

  return (
    <View style={styles.stack}>
      <BigName value={draft.name} onChange={(name) => set({ name })} onDone={onDone} resumed={resumed} onStartOver={onStartOver} placeholder="e.g. Rich Demerara Syrup" />

      {hit ? (
        <Surface raised style={styles.card}>
          <View style={styles.row}>
            <IngredientThumb id={hit.id} name={hit.name ?? ''} size={40} />
            <View style={styles.flex}>
              <Body>{same ? `${hit.name} is already here` : `Did you mean ${hit.name}?`}</Body>
              <Caption tone="muted">{same ? 'Use it, so specs and searches find one of it.' : 'It’s already here.'}</Caption>
            </View>
          </View>
          <Button label={`Use ${hit.name}`} variant="secondary" onPress={() => onUseExisting({ id: hit.id, name: hit.name ?? draft.name })} style={styles.button} />
        </Surface>
      ) : null}

      <Surface raised style={styles.card}>
        <Body>{read.isPending ? 'Reading the label…' : 'A bottle? Snap the label'}</Body>
        <Caption tone="muted">Fills in its name, maker, strength and what it’s a kind of.</Caption>
        <View style={styles.buttons}>
          {camera ? <Button label="Take a photo" icon="camera.fill" variant="secondary" disabled={read.isPending} onPress={() => snap(takeBottlePhoto)} /> : null}
          <Button label="Choose a photo" icon="photo" variant="secondary" disabled={read.isPending} onPress={() => snap(pickBottlePhoto)} />
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  card: { gap: space.sm, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  button: { alignSelf: 'flex-start' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
