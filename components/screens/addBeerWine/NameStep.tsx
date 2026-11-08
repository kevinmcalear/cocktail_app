import * as Device from '@/lib/realDevice';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Field, PressableScale, Surface, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space } from '@/constants/tokens';
import { useCatalogBottles } from '@/hooks/useCreateBeerWine';
import { useReadLabel } from '@/hooks/useReadLabel';
import { beerWineSketch, fillFromCatalog, fillFromLabel, guessStyle, STYLES, type BeerWineDraft, type CatalogBottle } from '@/lib/beerWineWizard';
import type { DrinkKind } from '@/lib/drinkKinds';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';
import { capitalizeAsYouType } from '@/lib/stringUtils';

import { Prompt } from '../addDrink/Prompt';
import { Eyebrow } from '../addDrink/WizardChrome';

interface Props {
  kind: DrinkKind;
  draft: BeerWineDraft;
  set: (change: Partial<BeerWineDraft>) => void;
  onDone: () => void;
  /** A catalog pick fills everything in: straight to the review. */
  onFilled: () => void;
  /** The name is already on the list (NameTaken): it takes the place of the choices under the field. */
  taken?: ReactNode;
}

const PLACEHOLDER: Record<DrinkKind, string> = {
  beer: 'e.g. Pilsner Urquell, Guinness, Pliny the Elder',
  wine: 'e.g. Gravner Ribolla Gialla, a Barolo, Cava',
};

/**
 * The name (boards Add-beer and Add-wine, step 1), and two ways to skip the
 * typing: "Is it this one?" from the shared catalog as it's typed (a pick
 * fills in the rest), or snap the label (read-bottle reads the name, maker
 * and strength, and the photo becomes its picture).
 */
export function NameStep({ kind, draft, set, onDone, onFilled, taken }: Props) {
  const found = useCatalogBottles(kind, draft.name).data ?? [];
  const read = useReadLabel();

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

  const list = found.length && draft.name.trim() ? (
    <View style={styles.stack}>
      <Eyebrow>Is it this one?</Eyebrow>
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
        <NewOne kind={kind} onPress={onDone} />
      </View>
      <Caption tone="muted">A catalog pick fills in the rest and goes straight to the review.</Caption>
    </View>
  ) : null;
  // A photo taken stays in sight, with its X, above any catalog matches.
  const snapCard = draft.photo || !list ? <Snap kind={kind} photo={draft.photo} reading={read.isPending} onSnap={snap} onRemove={() => set({ photo: null })} /> : null;
  const choices = taken ?? (
    <>
      {snapCard}
      {list}
    </>
  );

  return (
    <View style={styles.stack}>
      <View style={styles.field}>
        <Eyebrow>Name</Eyebrow>
        <Field
          label="Name"
          hideLabel
          value={draft.name}
          onChangeText={(name) => set({ name: capitalizeAsYouType(name) })}
          placeholder={PLACEHOLDER[kind]}
          autoFocus={!draft.name}
          returnKeyType="next"
          onSubmitEditing={onDone}
          maxLength={80}
        />
      </View>
      {choices}
    </View>
  );
}

/** "Snap the label / Fills in the name, maker and strength.", or the photo it took, with its own X. */
function Snap({ kind, photo, reading, onSnap, onRemove }: { kind: DrinkKind; photo: BottlePhoto | null; reading: boolean; onSnap: (get: () => Promise<BottlePhoto | null>) => void; onRemove: () => void }) {
  const ds = useDs();
  // A simulator has no camera to open.
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const choose = { label: photo ? 'Choose another' : 'Choose a photo', onPress: () => onSnap(pickBottlePhoto), disabled: reading };
  const actions = camera ? [{ label: 'Take a photo', onPress: () => onSnap(takeBottlePhoto), disabled: reading }, choose] : [choose];
  if (!photo) return <Prompt icon="camera.fill" title="Snap the label" body="Fills in the name, maker and strength." actions={actions} />;
  return (
    <Surface raised style={styles.snap}>
      <View style={styles.photoRow}>
        <Image source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: ds.c.raised }]} contentFit="cover" accessibilityLabel={`Label photo of the ${kind}`} />
        <View style={styles.flex}>
          <Body>{reading ? 'Reading the label…' : 'Its photo is saved with it.'}</Body>
          {reading ? <Caption tone="muted">Filling in the name, maker and strength.</Caption> : null}
        </View>
        <PressableScale onPress={onRemove} role="button" accessibilityLabel="Remove the photo" style={styles.remove}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
    </Surface>
  );
}

/** One from the shared catalog: its glass, its name, "Pilsner Urquell · Pilsner · Pilsen, Czechia", Use it. */
function Found({ kind, bottle, onPress }: { kind: DrinkKind; bottle: CatalogBottle; onPress: () => void }) {
  const ds = useDs();
  const style = STYLES[kind].find((s) => bottle.categories.includes(s.name))?.name ?? guessStyle(kind, `${bottle.name} ${bottle.description ?? ''}`);
  const facts = [bottle.brand_maker, style, bottle.origin].filter(Boolean).join(' · ');
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={`Use ${bottle.name}${facts ? `, ${facts}` : ''}`} accessibilityHint="Fills in the rest from it" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.thumb} aria-hidden>
        <SketchDrawing inputs={beerWineSketch(kind, { style, glassVariant: null })} seed={bottle.id} />
      </View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {bottle.name}
        </DsText>
        {facts ? <Caption tone="muted">{facts}</Caption> : null}
      </View>
      <Caption tone="accent" style={styles.use}>
        Use it
      </Caption>
    </PressableScale>
  );
}

/** "No, it's a new beer / One step a screen, the rest can wait": on to the next step. */
function NewOne({ kind, onPress }: { kind: DrinkKind; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={`No, it’s a new ${kind}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.plus, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="plus" size={16} color={ds.c.ink} />
      </View>
      <View style={styles.flex}>
        <Body>{`No, it’s a new ${kind}`}</Body>
        <Caption tone="muted">One step a screen, the rest can wait</Caption>
      </View>
      <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { gap: space.sm },
  snap: { gap: space.sm, padding: space.lg },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photo: { width: 56, height: 56, borderRadius: radius.control },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 44, height: 56 },
  plus: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  use: font.semiBold,
  flex: { flex: 1, gap: 2 },
});
