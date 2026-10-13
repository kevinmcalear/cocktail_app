import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { VenueMark } from '@/components/nav/VenueMarks';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { STEP_NAMES, VENUE_STEPS, type VenueScreen, type VenueStep } from '@/lib/venueSetup';

const WIDTH = 300;

/**
 * Wide web: the eight steps down the left (canvas make-venue-desktop), done
 * ones ticked with what they settled, the current one marked. Any step can
 * be picked; nothing has to go in order.
 */
export function SetupRail({ name, logoUrl, at, done, status, onPick, onLeave }: { name: string; logoUrl: string | null; at: VenueScreen; done: readonly VenueStep[]; status: Partial<Record<VenueStep, string>>; onPick: (s: VenueStep) => void; onLeave: () => void }) {
  const ds = useDs();
  return (
    <View role="navigation" accessibilityLabel="Venue setup steps" style={[styles.rail, { borderRightColor: ds.c.line }]}>
      <View style={styles.head}>
        {/* The venue's own mark in its brand (canvas make-venue-desktop). */}
        <VenueMark venue={{ id: name, name: name || 'Venue', logoUrl, accent: ds.accentFill.fill, displayFace: ds.displayFace, groundTint: null, roleLevel: 40 }} size={40} />
        <View style={styles.flex}>
          <Caption tone="muted" style={styles.eyebrow}>VENUE SETUP</Caption>
          <DsText variant="headline" numberOfLines={1}>{name || 'Your bar'}</DsText>
        </View>
      </View>
      <View role="list" style={styles.steps}>
        {VENUE_STEPS.map((s, i) => {
          const current = s === at;
          const ticked = done.includes(s);
          return (
            <PressableScale key={s} role="link" aria-current={current ? 'step' : undefined} accessibilityLabel={`${i + 1}. ${STEP_NAMES[s]}${ticked ? ', done' : ''}`} onPress={() => onPick(s)} style={[styles.step, current && { backgroundColor: ds.c.raised }]}>
              <View style={[styles.num, ticked ? { borderColor: 'transparent', backgroundColor: withAlpha(ds.accentText, 0.18) } : current ? { borderColor: ds.accentFill.fill, backgroundColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}>
                {ticked ? <IconSymbol name="checkmark" size={12} color={ds.accentText} /> : <Caption color={current ? ds.accentFill.text : ds.c.muted}>{String(i + 1)}</Caption>}
              </View>
              <View style={styles.flex}>
                <DsText variant="body" style={current ? styles.strong : null}>{STEP_NAMES[s]}</DsText>
                {ticked && status[s] ? <Caption tone="muted" numberOfLines={1}>{status[s]}</Caption> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.foot}>
        <Caption tone="muted">Stop at any step. What you’ve done is saved, and Tonight lists what’s left.</Caption>
        <Button label="Not now" variant="ghost" onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: WIDTH, paddingHorizontal: space.xl, paddingVertical: space.xxl, gap: space.xl, borderRightWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 1.2, fontFamily: fontFamilies.bodySemiBold },
  steps: { gap: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.control },
  num: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  foot: { gap: space.sm, marginTop: 'auto' },
});
