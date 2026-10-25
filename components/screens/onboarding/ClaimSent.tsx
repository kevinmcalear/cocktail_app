import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { heroPicture } from '@/lib/itemImages';
import { useProfile, type MyPersonClaim, type Profile } from '@/hooks/useProfiles';

import { useMadeBy } from '../profile/MadeBy';
import { SetupChromeProvider, SetupFooter, SetupPage, useSetupChrome } from './SetupPage';

/**
 * "Claim sent" (find-yourself step 5): back in Setup after "This is me",
 * the drinks waiting for them and why the career steps are skipped. Keep
 * going carries on to taste, then units.
 */
export function ClaimSent({ claim, onNext }: { claim: MyPersonClaim; onNext: () => void }) {
  const chrome = useSetupChrome();
  const { data: profile } = useProfile(claim.profile.id);
  const page = (
    <SetupPage footer={<SetupFooter label="Keep going" onPress={onNext} />}>
      {profile ? <Waiting profile={profile} /> : null}
      <Caption tone="muted">Where you have worked comes from your page too, so we skip those steps. You can change anything later in Work.</Caption>
    </SetupPage>
  );
  if (!chrome) return page;
  return (
    <SetupChromeProvider
      value={{
        ...chrome,
        title: 'Claim sent',
        intro: 'A person checks it, usually within a day. We tell you here once it’s yours.',
        mark: <Clock />,
      }}
    >
      {page}
    </SetupChromeProvider>
  );
}

/** "Waiting for you": each drink credited to the page, and its bar. */
function Waiting({ profile }: { profile: Profile }) {
  const ds = useDs();
  const made = useMadeBy(profile);
  const rows = made.groups.flatMap((g) => g.rows.map((r) => ({ ...r, bar: g.barName })));
  if (!rows.length) return null;
  return (
    <View style={styles.list}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Waiting for you
      </Caption>
      <View role="list">
        {rows.map((r) => {
          const d = made.pictures.get(r.id);
          const hero = d ? heroPicture(d.item_images) : null;
          return (
            <View key={r.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <View style={styles.thumb}>
                <DrinkImage thumb sketchDetail="thumb" source={hero?.url} generated={hero?.isSketch} glass={d?.glass?.icon_key} itemId={r.id} accessibilityLabel={r.name} radius="control" />
              </View>
              <Body style={styles.flex} numberOfLines={1}>
                {r.name}
              </Body>
              {r.bar ? <Caption tone="muted">{r.bar}</Caption> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Clock() {
  const ds = useDs();
  return (
    <View style={[styles.clock, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="clock" size={22} color={ds.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 36 },
  flex: { flex: 1, minWidth: 0 },
  clock: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
