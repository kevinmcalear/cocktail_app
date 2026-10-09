import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, Tag } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useDrinkCredit } from '@/hooks/useLineage';
import { creditHint, creditLabel, creditSentence, type CreditPart, type CreditStatus, type LineageDrink } from '@/lib/lineage';

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
 * The credit sentence as it reads under a name: a classic comes "From the
 * Whiskey Cocktail" (it isn't a riff), and a bar credited on its own has its
 * neighbourhood after it ("at Temple Bar, NoHo").
 */
function underName(parts: CreditPart[], drink: LineageDrink): CreditPart[] {
  const place = !drink.creator && drink.origin_bar?.locality ? drink.origin_bar : null;
  return parts.flatMap((p, i) => {
    if (i === 0 && drink.is_catalog && p.text === 'Riff of ') return [{ text: 'From the ' }];
    return place && p.profileId === place.id ? [p, { text: `, ${place.locality}` }] : [p];
  });
}

/**
 * Under the drink's name: what it's a riff of, who made it, where and when,
 * with the maker's picture and how sure the credit is ("· Suggested"). Names link to drinks
 * and profiles. Nothing when the drink has no credit or parent.
 */
export function DrinkCredit({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { data: drink } = useDrinkCredit(itemId);
  if (!drink) return null;
  const parts = underName(creditSentence(drink, drink.riff_of ?? drink.lineage_parent), drink);
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
