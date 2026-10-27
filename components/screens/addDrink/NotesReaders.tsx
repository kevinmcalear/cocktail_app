import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { withAlpha } from '@/lib/color';
import type { StepProps } from '@/lib/drinkWizard';
import { notesReaderOptions } from '@/lib/notesReaders';

import { Eyebrow } from './WizardChrome';

/**
 * "Who reads the notes?" at a venue (E29, option A): everyone who sees the
 * drink, a role and everyone above it in the venue's own role names, or just
 * you. The database keeps a note from anyone below its role.
 */
export function VenueNotesReaders({ barId, draft, set }: StepProps & { barId: string }) {
  const roles = useRoleMatrix(barId).data ?? [];
  const admins = (useBarMembers(barId).data ?? [])
    .filter((m) => m.role_level >= 40)
    .map((m) => m.display_name?.trim())
    .filter((n): n is string => !!n);
  const options = notesReaderOptions(roles, admins);
  const level = draft.notesLevel ?? null;
  return (
    <View style={styles.section}>
      <Eyebrow>Who reads the notes?</Eyebrow>
      <View role="radiogroup" aria-label="Who reads the notes">
        {options.map((o) => (
          <ReaderRow
            key={o.level ?? 'all'}
            label={o.label}
            detail={o.detail}
            selected={!draft.notesPrivate && level === o.level}
            onPress={() => set({ notesPrivate: false, notesLevel: o.level })}
          />
        ))}
        <ReaderRow label="Just me" detail="Never shared or published" selected={!!draft.notesPrivate} onPress={() => set({ notesPrivate: true })} last />
      </View>
    </View>
  );
}

/** One choice: a ring (filled when picked), the name, and who that is. */
function ReaderRow({ label, detail, selected, onPress, last }: { label: string; detail: string; selected: boolean; onPress: () => void; last?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={`${label}. ${detail}`}
      onPress={onPress}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ds.c.line }]}
    >
      <View style={[styles.ring, { borderColor: selected ? ds.c.ink : withAlpha(ds.c.ink, 0.25) }]} aria-hidden>
        {selected ? <View style={[styles.dot, { backgroundColor: ds.c.ink }]} /> : null}
      </View>
      <View style={styles.text}>
        <Body style={selected ? { fontFamily: fontFamilies.bodySemiBold } : null}>{label}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
    </PressableScale>
  );
}

const RING = 22;

const styles = StyleSheet.create({
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm + 2 },
  ring: { width: RING, height: RING, borderRadius: radius.pill, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
