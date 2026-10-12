import { StyleSheet, View } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BRAND } from '@/constants/brand';
import { radius, space } from '@/constants/tokens';
import { useBarPageCount } from '@/hooks/useVenueSetup';

import { VALUE_ROWS } from './setupCopy';

/** Before the steps: what a venue gets, and that its page may already be here (canvas make-venue-start). */
export function SetupIntro({ onStart, onLeave }: { onStart: () => void; onLeave: () => void }) {
  const ds = useDs();
  const total = useBarPageCount().data;
  return (
    <SetupPage footer={<SetupFooter label="Set up your bar" onPress={onStart} onSkip={onLeave} />}>
      <View role="list" style={styles.rows}>
        {VALUE_ROWS.map((r, i) => (
          <View key={r.title} role="listitem" style={[styles.row, i > 0 && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
              <IconSymbol name={r.icon} size={18} color={ds.accentText} />
            </View>
            <View style={styles.flex}>
              <DsText variant="headline">{r.title}</DsText>
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
  rows: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  icon: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
});
