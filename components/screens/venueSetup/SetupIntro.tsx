import { StyleSheet, View } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BRAND } from '@/constants/brand';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useBarPageCount } from '@/hooks/useVenueSetup';

import { VALUE_ROWS } from './setupCopy';

/** Before the steps: what a venue gets, and that its page may already be here (canvas make-venue-start). */
export function SetupIntro({ onStart, onLeave }: { onStart: () => void; onLeave: () => void }) {
  const ds = useDs();
  const total = useBarPageCount().data;
  return (
    <SetupPage footer={<SetupFooter label="Set up your bar" onPress={onStart} onSkip={onLeave} />}>
      <View role="list" style={[styles.rows, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        {VALUE_ROWS.map((r, i) => (
          <View key={r.title} role="listitem" style={[styles.row, i > 0 && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
              <IconSymbol name={r.icon} size={18} color={ds.accentText} />
            </View>
            <View style={styles.flex}>
              <DsText variant="body" style={styles.strong}>{r.title}</DsText>
              <Caption tone="muted">{r.line}</Caption>
            </View>
          </View>
        ))}
      </View>
      {total ? <Caption tone="muted">{`${total.toLocaleString('en')} bars are already on ${BRAND.productName}, from the 50 Best lists and city guides. Yours may be waiting for you.`}</Caption> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  // One bordered card around the four (canvas make-venue-start).
  rows: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.lg },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: space.xs / 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
