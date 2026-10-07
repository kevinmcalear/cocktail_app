import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { amountLabel, STEP_COPY, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { PUBLISH_COPY } from '@/lib/publishing';

function credits(d: WizardDraft, hasProfile: boolean): string {
  const by = d.creator === 'nobody' ? '' : typeof d.creator === 'object' && d.creator ? `By ${d.creator.name}` : hasProfile ? 'By you' : '';
  const withThem = d.coCreators.length ? `with ${d.coCreators.map((c) => c.name).join(', ')}` : '';
  const riff = d.riffOf ? `riff on ${d.riffOf.name}` : '';
  return [[by, withThem].filter(Boolean).join(' '), riff].filter(Boolean).join(', ');
}

/** Every answer on one screen; tap a row to go back and change it. */
export function ReviewStep({ draft, onJump, atVenue, hasProfile }: { draft: WizardDraft; onJump: (s: WizardStep) => void; atVenue: boolean; hasProfile: boolean }) {
  const rows: [WizardStep, string][] = [
    ['name', draft.name.trim()],
    ['ingredients', draft.lines.map((l) => `${amountLabel(l)} ${l.name}`.trim()).join('\n')],
    ['method', draft.methods.map((m) => m.name).join(', then ')],
    ['glass', draft.glass?.name ?? ''],
    ['ice', draft.ice?.name ?? ''],
    ['garnish', draft.garnishes.map((g) => g.name + (g.unit === 'each' ? '' : ` ${g.unit}`)).join(', ')],
    ['credits', credits(draft, hasProfile)],
    ['notes', [draft.description.trim(), draft.notes.trim()].filter(Boolean).join('\n\n')],
    ['publish', draft.publish ? PUBLISH_COPY[draft.publish].label : atVenue ? 'Same as the venue' : 'Private'],
  ];
  return (
    <View role="list">
      {rows.map(([step, value]) => (
        <Row key={step} label={STEP_COPY[step].short} value={value} onPress={() => onJump(step)} />
      ))}
      <Caption tone="muted" style={styles.after}>
        You can change any of it on the drink’s page, and add photos there.
      </Caption>
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${label}: ${value || 'not added'}`}
      accessibilityHint="Goes back to change it"
      onPress={onPress}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.text}>
        <Caption tone="muted">{label}</Caption>
        <Body tone={value ? 'ink' : 'muted'}>{value || 'Not added'}</Body>
      </View>
      <IconSymbol name="pencil" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  after: { marginTop: space.lg },
});
