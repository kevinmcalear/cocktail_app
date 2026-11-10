import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { ListNote } from '@/components/ds/ListGroup';
import { layout, radius, space } from '@/constants/tokens';
import { useMakingKit } from '@/hooks/useBarKit';
import { guessKind, KIND_WAYS, kitFirstKind, PREP_KINDS, shownKinds, tileOf, wayEquipment, wayOf, waysByKit, type PrepDraft, type PrepKindId, type PrepWay } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById } from '@/lib/techniques';

import { Eyebrow, WizardChip } from '../WizardChrome';
import { EveryTechnique, TechniqueRow } from './EveryTechnique';

interface PrepKindStepProps {
  name: string;
  draft: PrepDraft;
  /** Two lines just combined: says it starts as Batch, and why the name may suggest another. */
  combined?: boolean;
  onKind: (kind: PrepKindId, way?: string) => void;
  onTechnique: (id: string) => void;
  /** The venue the drink is for, whose Kit the ways are checked against; null at home. */
  bar?: { id: string; name: string } | null;
  /** A kind is picked (tapped, or the name says one): until then nothing is selected and the ways wait. */
  chosen?: boolean;
  /** One half (board Add-inside, a row's sheet): What it is's kinds, or Method's ways, your kit first. */
  only?: 'kind' | 'ways';
}

/**
 * New prep, first step (make-anything-steps-1, step 4): what kind it is
 * (each with what goes in it, the one the name suggests marked), then
 * "How?". A syrup's or a shrub's ways are recipes (cold, hot, oleo); an
 * infusion's, a wash's, a clarified juice's and a distillate's are the
 * library's techniques, your kit first and the rest dimmed with I have this
 * (step 4, more to it). Something else, or Every technique, opens the whole
 * library. A way that fills the method says so. Board Add-house draws no
 * grades and no amounts here (Kevin, 9 Nov: "Build as drawn"): what goes in
 * is the next step.
 */
export function PrepKindStep({ name, draft, combined, onKind, onTechnique, bar = null, chosen = true, only }: PrepKindStepProps) {
  const { kit, where, add } = useMakingKit(bar);
  const guess = guessKind(name);
  const named = guess ? tileOf(guess) : null;
  // A technique the kinds don't list (a foam) is Something else.
  const picked = tileOf(draft.kind);
  const kindWays = KIND_WAYS[picked];
  // An infusion's, a wash's, a clarified juice's, a syrup's ways: kit first.
  const byKit = kitFirstKind(picked) ? waysByKit(picked, kit) : null;
  // Every technique opens under ways that are the library's own (a syrup's three are all there is).
  const techniques = !!kindWays?.every((w) => w.fills);
  // Every technique, opened from under a kind's ways; Something else always shows it.
  const [every, setEvery] = useState(false);
  const all = picked === 'other' || every;
  const way = wayOf(draft);
  const kitRow = (w: PrepWay) => {
    const t = techniqueById(w.technique);
    // Board Add-house: its name and how it's made; one that needs kit you haven't added says so, dimmed.
    const equipment = wayEquipment(w);
    const missing = kit ? equipment.some((id) => !kit.has(id)) : false;
    const sub = missing ? 'Needs kit you haven’t added' : capitalizeFirst(w.note ?? w.fills ?? '');
    return t ? <TechniqueRow key={w.id} t={t} label={w.label ?? (w.equipment ? w.name : undefined)} equipment={equipment} sub={sub} kit={kit} on={way?.id === w.id} onPress={() => onKind(picked, w.id)} onAdd={add} /> : null;
  };

  const [more, setMore] = useState(false);
  const kindName = (id: PrepKindId) => PREP_KINDS.find((x) => x.id === id)!;
  const shown = PREP_KINDS.find((k) => k.id === draft.kind) ?? kindName(picked);
  const hint = !chosen ? 'Pick what it is, or name it and we’ll suggest one.' : combined ? null : `${shown.name}: ${shown.ratio.charAt(0).toLowerCase()}${shown.ratio.slice(1)}.${picked === named ? ' Picked from the name; tap another to change it.' : ''}`;

  const kinds = only !== 'ways';
  const ways = only !== 'kind';
  return (
    <View style={styles.stack}>
      {kinds ? (
        <>
          <View style={styles.label}>
            <Eyebrow>What it is</Eyebrow>
            {chosen && named && picked === named ? <Caption tone="accent">From the name</Caption> : null}
          </View>
          {/* Five kinds and More (Kevin, 8 Nov: "Five + More"); the one picked and the one the name says always show. */}
          <View role="radiogroup" accessibilityLabel="What it is" style={styles.chips}>
            {shownKinds(chosen ? picked : null, named, more).map((id) => {
              const k = kindName(id);
              return (
                <WizardChip
                  key={id}
                  label={k.name}
                  selected={chosen && id === picked}
                  // A name that says another kind marks it, so "Naming it changes the suggestion; you pick" holds.
                  suggested={id === named && !(chosen && id === picked)}
                  onPress={() => {
                    setEvery(false);
                    onKind(id);
                  }}
                />
              );
            })}
            {more ? null : <WizardChip label="More" kind="button" dashed onPress={() => setMore(true)} />}
          </View>
          {hint ? <Caption tone="muted">{hint}</Caption> : null}
        </>
      ) : null}
      {/* The kit question waits for a kind (Kevin, 8 Nov). */}
      {chosen || !ways ? null : <ListNote icon="flask" text="Ways to make it show once you pick what it is, your kit first." />}

      {ways && chosen && kindWays && picked !== 'other' ? (
        <View style={styles.stack}>
          <Eyebrow>{byKit ? 'How? Your kit first' : 'How?'}</Eyebrow>
          <View role="radiogroup" accessibilityLabel="Way to make it" style={styles.stack}>
            {byKit
              ? byKit.have.map(kitRow)
              : kindWays.map((w) => (
                  <WayRow
                    key={w.id}
                    name={w.name}
                    sub={[w.time, w.kit.join(', '), w.note].filter(Boolean).join(' · ')}
                    tip={w.tip}
                    on={way?.id === w.id}
                    onPress={() => onKind(picked, w.id)}
                  />
                ))}
            {byKit?.need.map(kitRow)}
          </View>
          {/* A bar's kit is in its Settings (board Add-house); at home it's on My Bar. */}
          {byKit ? <Caption tone="muted">{`Your kit is in ${bar ? 'Settings › Kit' : where}. The rest stay here, dimmed, in case you have it.`}</Caption> : null}
          {way?.fills ? <Caption tone="muted">{`${way.name} fills in the method: ${way.fills}.`}</Caption> : null}
          {byKit && techniques && !every ? (
            <PressableScale role="button" onPress={() => setEvery(true)} accessibilityLabel="Every technique" style={styles.all}>
              <Body tone="accent">Every technique</Body>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {ways && chosen && all ? (
        <View style={styles.stack}>
          <Caption tone="muted">{picked === 'other' ? 'Something else: every technique' : 'Every technique'}</Caption>
          <EveryTechnique name={name} selected={draft.technique ?? null} kit={kit} onPick={onTechnique} onAdd={add} onWrite={() => onKind('other')} />
        </View>
      ) : null}
      {combined && kinds ? <Caption tone="muted">Dropping two lines together starts as Batch. Naming it changes the suggestion; you pick.</Caption> : null}
    </View>
  );
}

/** One way to make it: its name, then time · kit · what it's like, and when to pick it. */
function WayRow({ name, sub, tip, label, on, onPress }: { name: string; sub: string; tip?: string; label?: string; on: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={on}
      accessibilityLabel={label ?? [name, sub, tip].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.way, { backgroundColor: ds.c.raised, borderColor: on ? ds.accentText : 'transparent' }]}
    >
      <Body>{name}</Body>
      {sub ? <Caption tone="muted">{sub}</Caption> : null}
      {tip ? <Caption tone="accent">{tip}</Caption> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  way: { gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.control, borderWidth: 2 },
  all: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
});
