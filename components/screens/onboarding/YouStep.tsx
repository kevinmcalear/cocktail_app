import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PersonResultRow } from '@/components/search/ResultRows';
import { useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMyPersonClaim, useNamesakes, useWaiting } from '@/hooks/useProfiles';
import { useClaimReturn } from '@/lib/claimReturn';

import { ClaimSent } from './ClaimSent';
import { SetupChromeProvider, SetupFooter, SetupPage, useSetupChrome } from './SetupPage';

/**
 * "Is this you?" (28 Oct 2026): straight after their name, the unclaimed
 * pages that could be them ("Matt Reisler" finds Mathew Resler), before any
 * path can make a second profile. A row opens the page, where This is me
 * claims it and comes back to "Claim sent"; Keep going, or "That's not me",
 * goes on to "What brings you here?".
 */
export function YouStep({ name, onNext }: { name: string; onNext: () => void }) {
  const ds = useDs();
  const chrome = useSetupChrome();
  const { data: claim, isSuccess: checked } = useMyPersonClaim();
  useClaimReturn(checked && !claim);
  const pages = useNamesakes(name).data ?? [];
  const { data: waiting } = useWaiting([], pages.map((p) => p.id));
  if (claim) return <ClaimSent claim={claim} onNext={onNext} />;
  const chevron = <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />;
  const page = (
    <SetupPage footer={<SetupFooter label={pages.length > 1 ? 'None of these are me' : 'That’s not me'} onPress={onNext} />}>
      <View role="list" style={styles.list}>
        {pages.map((p) => (
          <PersonResultRow key={p.id} person={p} waiting={waiting?.[p.id]} trailing={chevron} />
        ))}
      </View>
    </SetupPage>
  );
  if (!chrome) return page;
  const intro = pages.length === 1 ? `We already have a page for ${pages[0].display_name}, with the bars and drinks we found.` : 'We may already have a page for you, with the bars and drinks we found.';
  return <SetupChromeProvider value={{ ...chrome, intro }}>{page}</SetupChromeProvider>;
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
});
