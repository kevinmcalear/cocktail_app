import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
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
        progress: { at: 3, of: 4, label: 'Step 3 of 4' },
        mark: <Clock />,
      }}
    >
      {page}
    </SetupChromeProvider>
  );
}

/** "Waiting for you": each drink credited to the page, and its bar. */
function Waiting({ profile }: { profile: Profile }) {
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
          return <DrinkRow key={r.id} name={r.name} itemId={r.id} imageUrl={null} glass={d?.glass?.icon_key ?? null} trailing={r.bar ? <Caption tone="muted">{r.bar}</Caption> : null} />;
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
  clock: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
