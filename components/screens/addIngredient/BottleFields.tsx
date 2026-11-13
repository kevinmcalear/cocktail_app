import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';

import { Eyebrow } from '../addDrink/WizardChrome';

interface Props {
  maker: string;
  abv: string;
  /** A strength that isn't one, said under its field (Save waits for it). */
  abvError: string | null;
  kind: string | null;
  kindHelp: string | null;
  /** The catalog's bottle: its facts are the catalog's, shown, not typed. */
  fixed: boolean;
  onMaker: (maker: string) => void;
  onAbv: (abv: string) => void;
  onKind: () => void;
  usualAbv: number | null;
  /** The label photo: kept as a new bottle's picture, with Remove. */
  photo: { uri: string } | null;
  reading: boolean;
  onRemovePhoto: () => void;
}

/**
 * Filled in (board Add-bottle, 3): who makes it, how strong, and what it's a
 * kind of, which can be changed (it says which drinks can use it), then the
 * label photo kept with it. A pick from the catalog shows the catalog's;
 * anything else says it isn't in the catalog.
 */
export function BottleFields({ maker, abv, abvError, kind, kindHelp, fixed, onMaker, onAbv, onKind, usualAbv, photo, reading, onRemovePhoto }: Props) {
  return (
    <View style={styles.stack}>
      <Labelled label="Who makes it">
        {fixed ? <Fact value={maker} label="Who makes it" /> : <Field label="Who makes it" hideLabel placeholder="e.g. Laphroaig" value={maker} onChangeText={onMaker} returnKeyType="next" maxLength={80} />}
      </Labelled>
      <Labelled label="How strong · % ABV">
        {fixed ? (
          <Fact value={abv} label="How strong, % ABV" />
        ) : (
          <Field label="How strong, % ABV" hideLabel placeholder={`e.g. ${usualAbv ?? 40}`} value={abv} error={abvError ?? undefined} aria-invalid={!!abvError} onChangeText={(v) => onAbv(v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" maxLength={5} />
        )}
      </Labelled>
      <Labelled label="A kind of">
        {fixed ? <Fact value={kind ?? ''} label="A kind of" /> : <KindBox kind={kind} onPress={onKind} />}
        {kindHelp ? <Caption tone="muted">{kindHelp}</Caption> : null}
      </Labelled>
      {/* Said plainly either way, so a name the catalog doesn't have isn't a silent new form (walk 12 Nov). */}
      <Caption tone="muted">{fixed ? 'From the shared catalog: the same bottle every bar and shelf uses.' : 'Not in the shared catalog, so it’s a new bottle. Only its name is needed.'}</Caption>
      {photo && !fixed ? <PhotoRow uri={photo.uri} reading={reading} onRemove={onRemovePhoto} /> : null}
    </View>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}

/** A catalog fact, in a field's box, not editable. */
function Fact({ value, label }: { value: string; label: string }) {
  const ds = useDs();
  return (
    <View accessibilityLabel={`${label}: ${value || 'not known'}`} style={[styles.box, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <Body tone={value ? undefined : 'muted'}>{value || 'Not known'}</Body>
    </View>
  );
}

/** What it's a kind of, in a field's box: a tap opens the search to change it. */
function KindBox({ kind, onPress }: { kind: string | null; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={kind ? `A kind of ${kind}. Change it` : 'Pick what it’s a kind of'} onPress={onPress} style={[styles.box, styles.kind, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <Body tone={kind ? undefined : 'muted'} style={styles.flex}>
        {kind ?? 'e.g. Islay scotch, London dry gin'}
      </Body>
      <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

/** "Its label photo is saved with it." and Remove. */
function PhotoRow({ uri, reading, onRemove }: { uri: string; reading: boolean; onRemove: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.photoRow, { backgroundColor: ds.c.raised }]}>
      <Image source={{ uri }} style={[styles.photo, { backgroundColor: ds.c.surface }]} contentFit="cover" accessibilityLabel="Label photo of the bottle" />
      <Caption style={styles.flex}>{reading ? 'Reading the label…' : 'Its label photo is saved with it.'}</Caption>
      <PressableScale role="button" accessibilityLabel="Remove the label photo" onPress={onRemove} style={styles.remove}>
        <Caption tone="accent">Remove</Caption>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  group: { gap: space.sm },
  box: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, justifyContent: 'center' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.control },
  photo: { width: 40, height: 40, borderRadius: radius.control - 4 },
  remove: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
