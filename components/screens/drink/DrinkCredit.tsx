import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, Tag } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useDrinkCredit } from '@/hooks/useLineage';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { creditHint, creditLabel, nameCredit, type CreditStatus } from '@/lib/lineage';

/** Credit status as a word, with what it means for screen readers. Colour is never the only signal. */
export function CreditTag({ status }: { status: CreditStatus | null }) {
  const label = creditLabel(status);
  if (!label) return null;
  return (
    <View accessible accessibilityLabel={`Credit ${label.toLowerCase()}. ${creditHint(status)}`}>
      <Tag label={label} tone={status === 'verified' ? 'success' : 'default'} />
    </View>
  );
}

/**
 * Under the drink's name: what it's a riff of, who made it, where and when,
 * with the maker's picture and how sure the credit is ("· Suggested"). Names
 * link to drinks and profiles. A bar's copy of a classic poured to the same
 * spec keeps the classic's credit (board drink-phone-barcopy): Little Rye's
 * Penicillin is still Sam Ross's. Nothing when the drink has no credit or parent.
 */
export function DrinkCredit({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { data: own } = useDrinkCredit(itemId);
  const classicId = own?.riff_of?.is_catalog ? own.riff_of.id : null;
  // The same key and ids as ClassicNote, so the page asks once.
  const { data: matches } = useSpecMatches(classicId ? itemId : undefined, classicId ? [itemId] : []);
  const same = !!classicId && matches?.[itemId]?.spec_match === 'same';
  const { data: classic } = useDrinkCredit(same ? classicId : null);
  const drink = same && classic ? classic : own;
  if (!drink) return null;
  const parts = nameCredit(drink, drink.riff_of ?? drink.lineage_parent);
  if (!parts.length) return null;
  const who = drink.creator ?? drink.origin_bar;
  const status = creditLabel(drink.credit_status);

  return (
    <View style={styles.row}>
      {who ? (
        <View aria-hidden>
          <UserAvatar uri={who.avatar_url} name={who.display_name} size={28} />
        </View>
      ) : null}
      {/* The status rides at the end of the line as a word, so a long credit keeps the full width. */}
      <Body tone="muted" style={styles.flex} accessibilityHint={creditHint(drink.credit_status) ?? undefined}>
        {parts.map((p, i) =>
          p.profileId || p.drinkId ? (
            <DsText
              key={i}
              role="link"
              style={styles.link}
              onPress={() => router.push((p.profileId ? `/p/${p.profileId}` : `/cocktail/${p.drinkId}`) as Href)}
            >
              {p.text}
            </DsText>
          ) : (
            p.text
          )
        )}
        {status ? ` · ${status}` : ''}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  link: { textDecorationLine: 'underline' },
});
