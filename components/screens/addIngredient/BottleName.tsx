import type { ComponentRef, ReactNode, Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, Field, IngredientDrawing, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space } from '@/constants/tokens';
import { bottleFacts, type BottleRow } from '@/lib/addBottle';

import { Prompt } from '../addDrink/Prompt';
import { Eyebrow } from '../addDrink/WizardChrome';

interface Props {
  name: string;
  onName: (name: string) => void;
  nameRef?: Ref<ComponentRef<typeof TextInput>>;
  /** "Is it this one?": bottles whose name has what's typed. */
  matches: readonly BottleRow[];
  strengths: Record<string, number | null>;
  kindOf: (row: BottleRow) => string | null;
  onPick: (row: BottleRow) => void;
  /** "No, "Laphroaig 1" is a new one": its maker and strength next. */
  onNewOne: () => void;
  /** Name taken, or the snap card: what goes under the field instead of the list. */
  children?: ReactNode;
}

/**
 * The name (board Add-bottle, 1 and 2), and under it as it's typed "Is it
 * this one?" from the shared catalog, with the way to say it's a new one.
 */
export function BottleName({ name, onName, nameRef, matches, strengths, kindOf, onPick, onNewOne, children }: Props) {
  const typed = name.trim();
  return (
    <View style={styles.stack}>
      <View style={styles.field}>
        <Eyebrow>Name</Eyebrow>
        <Field
          ref={nameRef}
          label="Name"
          hideLabel
          value={name}
          onChangeText={onName}
          placeholder="e.g. Laphroaig 10, Campari, Buffalo Trace"
          autoFocus={!name}
          returnKeyType="next"
          maxLength={80}
        />
      </View>
      {matches.length && typed ? (
        <View style={styles.stack}>
          <Eyebrow>Is it this one?</Eyebrow>
          <View role="list">
            {matches.map((r) => (
              <Match key={r.id} row={r} facts={bottleFacts(r.brand_maker, strengths[r.id], kindOf(r))} onPress={() => onPick(r)} />
            ))}
            <NewOne name={typed} onPress={onNewOne} />
          </View>
          <Caption tone="muted">From the shared catalog. Picking one fills in the maker, strength and kind.</Caption>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** One from the catalog: its drawing, its name, "Laphroaig · 40% · Islay scotch", Yes, this one. */
function Match({ row, facts, onPress }: { row: BottleRow; facts: string; onPress: () => void }) {
  const ds = useDs();
  const name = row.name ?? '';
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={`Yes, this one: ${name}${facts ? `, ${facts}` : ''}`} accessibilityHint="Fills in its maker, strength and kind" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.thumb} aria-hidden>
        <IngredientDrawing id={row.id} name={name} drawn bare />
      </View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        {facts ? <Caption tone="muted">{facts}</Caption> : null}
      </View>
      <Caption tone="accent" style={styles.use}>
        Yes, this one
      </Caption>
    </PressableScale>
  );
}

function NewOne({ name, onPress }: { name: string; onPress: () => void }) {
  const ds = useDs();
  const label = `No, “${name}” is a new one`;
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={label} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.plus, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="plus" size={16} color={ds.c.ink} />
      </View>
      <View style={styles.flex}>
        <Body numberOfLines={1}>{label}</Body>
        <Caption tone="muted">Fill in the maker and strength yourself</Caption>
      </View>
      <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

/** Kevin, 8 Nov ("Trim it"): one Snap the label button, the camera or the library. */
export function SnapCard({ reading, onSnap }: { reading: boolean; onSnap: () => void }) {
  return (
    <Prompt
      icon="camera.fill"
      title={reading ? 'Reading the label…' : 'A bottle? Snap the label'}
      body="Fills in the name, maker and strength from the photo."
      actions={[{ label: 'Snap the label', onPress: onSnap, disabled: reading }]}
    />
  );
}

/** Kevin, 8 Nov: the board's Make it card, as a quiet line ("It's something I make"). */
export function MakeLink({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale role="link" onPress={onPress} accessibilityLabel="It’s something I make: the house-made steps" style={styles.make}>
      <Body tone="muted">It’s something I make</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 44, height: 56 },
  plus: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  use: font.semiBold,
  flex: { flex: 1, gap: 2 },
  make: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
});
