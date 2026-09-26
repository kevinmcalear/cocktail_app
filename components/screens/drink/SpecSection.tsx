import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, LockedSection, SpecRow, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useSpecLevels } from '@/hooks/useSpecLevels';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';
import { ratio, specAccess, specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';

interface SpecSectionProps {
  itemId: string;
  barId: string | null;
  recipes: PresentationRecipe[] | null | undefined;
  /** Service mode: 1.25. */
  scale: number;
  /** /dev/drink only: a simulated role and levels instead of the real ones. */
  preview?: { role: number; levels: SpecLevels };
}

/** The spec's proportions at a glance. Decorative: the rows carry the numbers. */
function RatioBar({ shares }: { shares: { key: string; share: number }[] }) {
  const ds = useDs();
  return (
    <View style={styles.ratio} aria-hidden>
      {shares.map((s, i) => (
        <View key={s.key} style={{ flex: s.share, backgroundColor: withAlpha(ds.accentText, Math.max(0.25, 1 - i * 0.22)) }} />
      ))}
    </View>
  );
}

/**
 * The spec, showing exactly what this role can see. Anything the server
 * withheld stays on the page as a locked section that says who can open it.
 */
export function SpecSection({ itemId, barId, recipes, scale, preview }: SpecSectionProps) {
  const ds = useDs();
  const router = useRouter();
  const realRole = useEffectiveRole(barId);
  const { data: realLevels } = useSpecLevels(preview ? null : itemId, barId);
  const role = preview?.role ?? realRole;
  const levels = preview?.levels ?? realLevels;
  const lines = specLines(recipes);
  const access = specAccess(role, levels ?? null, !!barId);
  const opensAt = (level: number | undefined) => (level ? roleLabel(level) : 'a higher role');

  if (!lines.length) {
    return (
      <View style={styles.section}>
        <Headline role="heading">Spec</Headline>
        <Body tone="muted">No spec yet.</Body>
      </View>
    );
  }

  if (!access.names) {
    return (
      <LockedSection title="Spec" unlocked={false} opensAt={opensAt(levels ? Math.min(levels.generic, levels.brand) : undefined)}>
        {null}
      </LockedSection>
    );
  }

  const shares = access.amounts ? ratio(lines) : null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Spec</Headline>
      {shares ? <RatioBar shares={shares} /> : null}
      {!access.amounts ? (
        <View style={styles.lockNote}>
          <IconSymbol name="lock.fill" size={13} color={ds.c.muted} />
          <Caption tone="muted">Amounts open at {opensAt(levels?.measurement)}</Caption>
        </View>
      ) : null}
      <View>
        {lines.map((l) => (
          <SpecRow
            key={l.key}
            amount={access.amounts ? (l.amount ?? '') : ''}
            ingredient={l.ingredient ?? 'Hidden ingredient'}
            optional={l.optional}
            note={l.note ?? undefined}
            scale={scale}
            onPress={l.ingredientId && !preview ? () => router.push(`/ingredient/${l.ingredientId}` as never) : undefined}
          />
        ))}
      </View>
      {!access.prep && levels ? (
        <LockedSection title="Prep notes" unlocked={false} opensAt={opensAt(levels.prep)}>
          {null}
        </LockedSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  ratio: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
