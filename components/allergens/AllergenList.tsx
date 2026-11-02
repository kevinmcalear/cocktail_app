import { Platform, StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, STATUS } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { allergenFooter, allergenRows, type AllergenRead } from '@/lib/allergenWords';

interface AllergenListProps {
  read: AllergenRead;
  barName: string | null;
  /** The bar's own team: the footer says what guests read until it is checked. */
  staff?: boolean;
  /** Beside the heading: "Your allergies", to set or change them. */
  onMine?: () => void;
  /** The bar's team, with edit_drinks: the footer opens the check. */
  onCheck?: () => void;
}

/**
 * A drink's Allergens (board Loop-allergy): every allergen and the top
 * ingredients it comes through, for everyone (guest-allergen-read); what
 * isn't checked as a warning row, never folded into a clean bill; then who
 * checked it and when, or Ask your bartender. The words are lib/allergens'.
 */
export function AllergenList({ read, barName, staff = false, onMine, onCheck }: AllergenListProps) {
  const ds = useDs();
  const rows = allergenRows(read);
  const amber = ds.scheme === 'dark' ? STATUS.warning : ds.c.ink;
  const footer = allergenFooter(read, barName, undefined, staff);
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Caption tone="muted" role="heading" aria-level={2} style={styles.eyebrow}>
          ALLERGENS
        </Caption>
        {onMine ? (
          <PressableScale role="link" accessibilityLabel="Your allergies" onPress={onMine} hitSlop={8}>
            <Caption tone="accent">Your allergies</Caption>
          </PressableScale>
        ) : null}
      </View>
      {rows.length ? (
        <View role="list" style={[styles.card, { backgroundColor: ds.c.raised }]}>
          {rows.map((r, i) => (
            <View
              key={r.key}
              role="listitem"
              style={[styles.row, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line } : null, r.warn ? { backgroundColor: withAlpha(STATUS.warning, 0.12) } : null]}
            >
              {r.warn ? <IconSymbol name="exclamationmark.triangle" size={16} color={amber} /> : null}
              <View style={styles.text}>
                <DsText variant="label" color={r.warn ? amber : ds.c.ink} style={styles.label}>
                  {r.label}
                </DsText>
                {r.sub ? <Caption tone="muted">{r.sub}</Caption> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {onCheck ? (
        <PressableScale role="button" accessibilityLabel={`${footer} Check the allergens`} onPress={onCheck} style={styles.check}>
          <Caption tone="muted" style={styles.text}>
            {footer}
          </Caption>
          <Caption tone="accent">Check</Caption>
          {Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={12} color={ds.accentText} /> : null}
        </PressableScale>
      ) : (
        <Caption tone="muted">{footer}</Caption>
      )}
    </View>
  );
}

/** The read failed: never silence on a safety line. */
export function AllergensFailed() {
  return (
    <View role="alert" style={styles.block}>
      <Caption tone="muted" role="heading" aria-level={2} style={styles.eyebrow}>
        ALLERGENS
      </Caption>
      <Caption tone="accent">{"Couldn't load this drink's allergens. Ask your bartender."}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm + 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  eyebrow: { ...font.medium, letterSpacing: 1.2 },
  card: { borderRadius: radius.card - space.xs, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.md, paddingHorizontal: space.lg },
  text: { flex: 1, gap: 2 },
  label: { ...font.semiBold },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget },
});
