import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { TellUs } from '@/components/feedback/TellUs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useMyProfile } from '@/hooks/useMyProfile';
import { draftIceLine, finishLabel } from '@/lib/drinkWizard';
import { PUBLISH_COPY } from '@/lib/publishing';
import { readableAccent } from '@/lib/color';
import { askShort, asked } from '@/lib/whoMadeIt';

import { MenuSheet } from '../menus/MenuSheet';
import type { DrinkDeskProps } from './DrinkDesk';
import { FinishStep } from './FinishStep';
import { FoamerHint } from './FoamerHint';
import { GlassStep } from './GlassStep';
import { IceStep } from './IceStep';
import { MethodParts, PartsSwitch } from './MethodParts';
import { MethodIceLine } from './MethodStep';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { CreditsStep } from './CreditsStep';
import { credits, notesLine } from './ReviewStep';
import { NotesStep } from './TextSteps';

type Part = 'method' | 'glass' | 'ice' | 'finish' | 'credit' | 'notes' | 'publish';

const TITLES: Record<Part, string> = { method: 'Method', glass: 'Glass', ice: 'Ice', finish: 'Finish', credit: 'Credit', notes: 'Notes', publish: 'Who sees it' };

/**
 * The draft page's rows (Prod-add-flow, step 3): how it's made, the glass, the
 * credit and the rest, each a tap away in its own sheet. A gap the drink
 * needs says "Pick one" in amber. The foamer prompt sits under them once
 * the method asks for one.
 */
export function DraftRows(p: DrinkDeskProps & { onRename: () => void }) {
  const ds = useDs();
  const { draft, set, barId } = p;
  const [open, setOpen] = useState<Part | null>(null);
  const profile = useMyProfile().data;
  const hasProfile = !!profile;
  // Made with waits for a yes (#899): said under Credit, so Save isn't a surprise.
  const ask = askShort(asked(draft, profile ? { id: profile.id, name: profile.displayName } : null));
  const aliases = useDrinkLists(!!draft.riffOf).data?.find((c) => c.id === draft.riffOf?.id)?.aliases;
  const venue = barId ? p.venueName : null;
  const tellUsAbout = { drinkName: draft.name, barId, barName: venue, draftId: draft.id ?? null };
  const values: Record<Part, string> = {
    method: draft.methods.map((m) => m.name).join(', then '),
    glass: draft.glass?.name ?? '',
    ice: draftIceLine(draft),
    finish: draft.garnishes.map(finishLabel).join(', '),
    credit: [credits(draft, hasProfile, aliases), ask].filter(Boolean).join(' · '),
    notes: [draft.description.trim(), notesLine(draft, barId)].filter(Boolean).join(' · '),
    publish: draft.publish ? PUBLISH_COPY[draft.publish].label : barId ? 'Same as the venue' : 'Private',
  };
  // What a drink can't be drawn or made without: amber until it's picked.
  const needed: Part[] = ['method', 'glass'];
  const amber = readableAccent(STATUS.warning, ds.c.ground);

  const body: Record<Part, () => ReactNode> = {
    method: () => (
      <>
        {draft.parts?.length ? <MethodParts draft={draft} set={set} options={p.methods} /> : <PickStep label="Method" ownLabel="Your own method" multi compact options={p.methods} selected={draft.methods} onChange={(methods) => set({ methods })} suggested={p.guess.method} />}
        <PartsSwitch draft={draft} set={set} />
        <MethodIceLine methods={draft.methods} value={draft.methodIce ?? null} options={p.ices} barIce={p.barIce} venueName={venue} onChange={(methodIce) => set({ methodIce })} />
        <TellUs screen="Adding a drink › Method" line="We’ll add your method to the app." {...tellUsAbout} />
      </>
    ),
    glass: () => <GlassStep compact draft={draft} set={set} options={p.glasses} barId={barId} barGlasses={p.barGlasses} barVariants={p.barVariants} suggested={p.guess.glass} />,
    ice: () => <IceStep compact draft={draft} set={set} ices={p.ices} barIce={p.barIce} suggested={p.guess.ice} kit={p.venueIce} barGlasses={p.barGlasses} barVariants={p.barVariants} venueName={venue} barId={barId} tellUs={tellUsAbout} />,
    finish: () => <FinishStep draft={draft} set={set} ingredients={p.ingredients} loading={p.loading} aliases={p.aliases} coreIds={p.coreIds} />,
    credit: () => <CreditsStep draft={draft} set={set} venueName={venue} ingredients={p.ingredients} match={p.atPlace} onRename={() => (setOpen(null), p.onRename())} />,
    notes: () => <NotesStep draft={draft} set={set} barId={barId} />,
    publish: () => <PublishStep draft={draft} set={set} barId={barId} />,
  };

  return (
    <View style={styles.stack}>
      <View role="list" style={[styles.group, { backgroundColor: ds.c.surface }]}>
        {(Object.keys(TITLES) as Part[]).map((part, i) => {
          const value = values[part];
          const gap = !value && needed.includes(part);
          return (
            <PressableScale
              key={part}
              role="button"
              accessibilityLabel={`${TITLES[part]}: ${value || (gap ? 'pick one' : 'not added')}`}
              onPress={() => setOpen(part)}
              style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}
            >
              <Body style={styles.label}>{TITLES[part]}</Body>
              <Body numberOfLines={1} color={gap ? amber : ds.c.muted} style={styles.value}>
                {value || (gap ? 'Pick one' : 'Add')}
              </Body>
              <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
            </PressableScale>
          );
        })}
      </View>
      <FoamerHint draft={draft} set={set} ingredients={p.ingredients} />
      {open ? (
        <MenuSheet visible onClose={() => setOpen(null)} title={TITLES[open]} done>
          {body[open]()}
        </MenuSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.lg },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
});
