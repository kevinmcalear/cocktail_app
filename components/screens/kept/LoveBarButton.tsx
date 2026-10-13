import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, GlassButton, PressableScale, useDs } from '@/components/ds';
import { LineGlyph } from '@/components/ui/lineGlyphs';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';
import { withAlpha } from '@/lib/color';

import { useAgeGate } from '../safety/AgeGate';
import { LoveAlertsSheet } from './LoveAlertsSheet';

/**
 * The heart on a bar's page: keeps the bar in Collection's Bars. Loving it
 * asks what it may tell you about (week-love-alerts); tapping Loved opens the
 * same choice, with Stop loving. Signed in only; loving a bar needs a
 * confirmed age, like the rest of Collection.
 * `labelled` and loved, it's the accent-tinted "Loved" pill with a filled heart (ppl-bar-top).
 */
export function LoveBarButton({ profileId, name, labelled = false }: { profileId: string; name: string; labelled?: boolean }) {
  const ds = useDs();
  const signedIn = useSignedIn();
  const loved = useLovedBars().data?.some((b) => b.id === profileId) ?? false;
  const love = useLoveBar();
  const age = useAgeGate();
  const [asking, setAsking] = useState(false);
  if (!signedIn) return null;
  // While the change saves, show where it's going.
  const on = love.isPending && love.variables ? love.variables.love : loved;
  const label = on ? `You love ${name}: choose what it tells you, or stop loving it` : `Love ${name}: keep it in your Collection`;
  // Loving asks what it may tell you about (week-love-alerts); tapping Loved opens the same choice, with Stop loving.
  const toggle = () =>
    on
      ? setAsking(true)
      : age.gate(() => {
          love.mutate({ profileId, love: true });
          setAsking(true);
        });
  return (
    <>
      {on && labelled ? (
        <PressableScale
          role="button"
          aria-pressed
          accessibilityLabel={label}
          onPress={toggle}
          hitSlop={4}
          style={[styles.loved, { borderColor: withAlpha(ds.accentText, 0.45), backgroundColor: withAlpha(ds.accentText, 0.16) }]}
        >
          <View style={styles.row}>
            <LineGlyph name="heartFill" size={18} color={ds.accentText} />
            <Caption color={ds.accentText} style={styles.text}>
              Loved
            </Caption>
          </View>
        </PressableScale>
      ) : (
        <GlassButton accessibilityLabel={label} icon={on ? 'heart.fill' : 'heart'} label={labelled ? 'Love' : undefined} onPress={toggle} />
      )}
      {age.sheet}
      {asking ? <LoveAlertsSheet visible profileId={profileId} name={name} onClose={() => setAsking(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  loved: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontFamily: fontFamilies.bodySemiBold },
});
