import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useCatalogBottles } from '@/hooks/useCreateBeerWine';
import { useReadLabel } from '@/hooks/useReadLabel';
import { fillFromCatalog, fillFromLabel, guessStyle, type BeerWineDraft, type CatalogBottle } from '@/lib/beerWineWizard';
import type { DrinkKind } from '@/lib/drinkKinds';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';

import { BigName } from '../addDrink/TextSteps';
import { Eyebrow } from '../addDrink/WizardChrome';

interface Props {
  kind: DrinkKind;
  draft: BeerWineDraft;
  set: (change: Partial<BeerWineDraft>) => void;
  onDone: () => void;
  /** A catalog pick fills everything in: straight to the review. */
  onFilled: () => void;
  resumed: boolean;
  onStartOver: () => void;
}

/**
 * The name, and two ways to skip the typing: snap the label (read-bottle
 * reads the name, maker and strength, and the photo becomes its picture),
 * or pick it from the shared catalog as the name is typed.
 */
export function NameStep({ kind, draft, set, onDone, onFilled, resumed, onStartOver }: Props) {
  const ds = useDs();
  const found = useCatalogBottles(kind, draft.name).data ?? [];
  const read = useReadLabel();
  const camera = Platform.OS !== 'web' && Device.isDevice;

  const snap = async (get: () => Promise<BottlePhoto | null>) => {
    try {
      const photo = await get();
      if (!photo) return;
      set({ photo });
      read.mutate(photo, {
        onSuccess: ([label]) => set(fillFromLabel(kind, draft, label)),
        onError: (e) => Alert.alert('Couldn’t read the label', `${e.message} The photo is kept as its picture.`),
      });
    } catch (e) {
      Alert.alert('No photo', e instanceof Error ? e.message : 'Couldn’t open the photos.');
    }
  };

  return (
    <View style={styles.stack}>
      <BigName value={draft.name} onChange={(name) => set({ name })} onDone={onDone} resumed={resumed} onStartOver={onStartOver} placeholder={kind === 'beer' ? 'Beer' : 'Wine'} />

      {found.length ? (
        <View style={styles.stack}>
          <Eyebrow>Is it one of these?</Eyebrow>
          <View role="list">
            {found.map((c) => (
              <Found
                key={c.id}
                kind={kind}
                bottle={c}
                onPress={() => {
                  set({ name: c.name, ...fillFromCatalog(kind, draft, c) });
                  onFilled();
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Surface raised style={styles.snap}>
        {draft.photo ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: draft.photo.uri }} style={[styles.photo, { backgroundColor: ds.c.raised }]} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={styles.flex}>
              <Body>{read.isPending ? 'Reading the label…' : 'Its picture'}</Body>
              <Caption tone="muted">{read.isPending ? 'Filling in the name, maker and strength.' : 'Saved with it. Change it on its page after.'}</Caption>
            </View>
            <PressableScale onPress={() => set({ photo: null })} role="button" accessibilityLabel="Remove the photo" style={styles.remove}>
              <IconSymbol name="xmark" size={16} color={ds.c.muted} />
            </PressableScale>
          </View>
        ) : (
          <>
            <Body>Snap the label</Body>
            <Caption tone="muted">Fills in the name, maker and strength, and keeps the photo as its picture.</Caption>
          </>
        )}
        <View style={styles.buttons}>
          {camera ? <Button label="Take a photo" icon="camera.fill" variant="secondary" disabled={read.isPending} onPress={() => snap(takeBottlePhoto)} /> : null}
          <Button label={draft.photo ? 'Choose another' : 'Choose a photo'} icon="photo" variant="secondary" disabled={read.isPending} onPress={() => snap(pickBottlePhoto)} />
        </View>
      </Surface>
    </View>
  );
}

function Found({ kind, bottle, onPress }: { kind: DrinkKind; bottle: CatalogBottle; onPress: () => void }) {
  const ds = useDs();
  const style = bottle.categories.find(Boolean) ?? guessStyle(kind, bottle.description);
  const facts = [bottle.brand_maker, bottle.abv !== null ? `${bottle.abv}%` : null, style].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="button"
      onPress={onPress}
      accessibilityLabel={`${bottle.name}${facts ? `, ${facts}` : ''}`}
      accessibilityHint="Fills in the rest from it"
      style={[styles.found, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.flex}>
        <Body numberOfLines={1}>{bottle.name}</Body>
        {facts ? <Caption tone="muted">{facts}</Caption> : null}
      </View>
      <Caption tone="accent">Fill in</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  snap: { gap: space.sm, padding: space.lg },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photo: { width: 56, height: 56, borderRadius: radius.control },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 8, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
