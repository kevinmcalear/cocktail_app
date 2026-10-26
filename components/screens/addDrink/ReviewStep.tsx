import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useBarPublishing } from '@/hooks/usePublishing';
import { amountLabel, draftIceLine, finishLabel, notesArePrivate, sketchLook, STEP_COPY, type StepProps, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { recipesToFinish } from '@/lib/prepKinds';
import { PUBLISH_COPY } from '@/lib/publishing';
import { capitalizeFirst } from '@/lib/stringUtils';
import { draftSketchInputs } from '@/lib/sketch/draft';

import { HomePhoto, ReviewPhotos } from './ReviewPhotos';

const CHANGE_LATER = 'You can change any of it on the drink’s page.';

function credits(d: WizardDraft, hasProfile: boolean): string {
  const by = d.creator === 'nobody' ? '' : typeof d.creator === 'object' && d.creator ? `By ${d.creator.name}` : hasProfile ? 'By you' : '';
  const withThem = d.coCreators.length ? `with ${d.coCreators.map((c) => c.name).join(', ')}` : '';
  const riff = d.riffOf ? `riff on ${d.riffOf.name}` : '';
  const where = [d.place ? `first made at ${d.place.name}` : '', d.originYear ? `in ${d.originYear}` : ''].filter(Boolean).join(' ');
  return capitalizeFirst([[by, withThem].filter(Boolean).join(' '), where, riff].filter(Boolean).join(', '));
}

/**
 * Everything in it (make-anything-steps-3, step 10): each line, a recipe made
 * in-house said done or to finish, then what's left to finish down through
 * the recipes inside, or that nothing is.
 */
function ingredientsText(d: WizardDraft): string {
  const lines = d.lines.map((l) => [`${amountLabel(l)} ${l.name}`.trim(), l.prep ? (l.prep.at ? 'recipe to finish' : 'recipe done') : l.later ? 'recipe to finish' : ''].filter(Boolean).join(' · '));
  if (!d.lines.some((l) => l.prep || l.later)) return lines.join('\n');
  const left = recipesToFinish(d.lines);
  return [...lines, left.length ? `Left to finish: ${left.map((t) => `${t.name}, ${t.at}`).join('; ')}` : 'Nothing left to finish'].join('\n');
}

interface ReviewStepProps extends StepProps {
  onJump: (s: WizardStep) => void;
  /** The venue it's added at, and its name ("Little Rye"); null at home. */
  barId: string | null;
  venueName: string;
  hasProfile: boolean;
  barVariants: readonly string[];
  barIce?: readonly string[];
  /** A venue's cost card, price and GP (m01): last, just above Save (E25, board w2-wizard-finish). */
  cost?: ReactNode;
}

/**
 * The photo slots, every answer on one screen (tap a row to go back and
 * change it), then a venue's cost. At home one photo, the one that leads the
 * drink's page (Q15); more angles go on the page.
 */
export function ReviewStep({ draft, set, onJump, barId, venueName, hasProfile, barVariants, barIce, cost }: ReviewStepProps) {
  const venue = useBarPublishing(barId).data;
  const caps = useCapabilities(barId).data;
  // A venue's drink takes photos from those who may add them.
  const canPhoto = !!caps?.includes('photos');
  // Not chosen: it follows the venue's default, once the venue has a public page.
  const followed = !venue ? 'Same as the venue' : venue.profile ? `${PUBLISH_COPY[venue.barDefault].label}, ${venueName}’s default` : 'Private for now';
  const rows: [WizardStep, string][] = [
    ['name', draft.name.trim()],
    ['ingredients', ingredientsText(draft)],
    ['method', draft.methods.map((m) => m.name).join(', then ')],
    ['glass', draft.glass?.name ?? ''],
    ['ice', draftIceLine(draft)],
    ['garnish', draft.garnishes.map(finishLabel).join(', ')],
    ['credits', credits(draft, hasProfile)],
    ['notes', [draft.description.trim(), draft.notes.trim() && notesArePrivate(draft, barId) ? `Just me: ${draft.notes.trim()}` : draft.notes.trim()].filter(Boolean).join('\n\n')],
    ['publish', draft.publish ? PUBLISH_COPY[draft.publish].label : barId ? followed : 'Private'],
  ];
  return (
    <View style={styles.review}>
      {!barId ? (
        <HomePhoto photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} />
      ) : canPhoto ? (
        <ReviewPhotos photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} sketch={draftSketchInputs(sketchLook(draft, barVariants, barIce))} seed={draft.id ?? 'new-drink'} />
      ) : null}
      <View>
        <ReviewList rows={rows.map(([step, value]) => ({ key: step, label: STEP_COPY[step].short, value }))} onJump={(s) => onJump(s as WizardStep)} after={cost ? undefined : CHANGE_LATER} />
        {cost ? (
          <View style={styles.cost}>
            {cost}
            <Caption tone="muted">{CHANGE_LATER}</Caption>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Every answer on one screen; tap a row to go back and change it. */
export function ReviewList({ rows, onJump, after }: { rows: { key: string; label: string; value: string }[]; onJump: (key: string) => void; after?: string }) {
  return (
    <View role="list">
      {rows.map((r) => (
        <AnswerRow key={r.key} label={r.label} value={r.value} onPress={() => onJump(r.key)} />
      ))}
      {after ? (
        <Caption tone="muted" style={styles.after}>
          {after}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * One answer on a review step: its label and value, with a pencil; a tap goes
 * back to change it. With no `onPress` it's just the answer, to read.
 */
export function AnswerRow({
  label,
  value,
  onPress,
  hint = 'Goes back to change it',
  opens = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  hint?: string;
  /** It goes somewhere rather than changing the answer: a chevron, not a pencil. */
  opens?: boolean;
}) {
  const ds = useDs();
  if (!onPress) {
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <View style={styles.text}>
          <Caption tone="muted">{label}</Caption>
          <Body selectable>{value}</Body>
        </View>
      </View>
    );
  }
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${label}: ${value || 'not added'}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.text}>
        <Caption tone="muted">{label}</Caption>
        <Body tone={value ? 'ink' : 'muted'}>{value || 'Not added'}</Body>
      </View>
      <IconSymbol name={opens ? 'chevron.right' : 'pencil'} size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  review: { gap: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  after: { marginTop: space.lg },
  cost: { marginTop: space.xl, gap: space.lg },
});
