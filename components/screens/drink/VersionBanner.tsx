import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useLineage } from '@/hooks/useLineage';
import { useSpecMatches, useSpecSource } from '@/hooks/useSpecMatches';
import { specNoteText } from '@/lib/servedAt';

import { useVersionGroups } from './ServedAt';

/**
 * Right under the score, on a bar's version of a catalog classic: what it is,
 * and the way up to the classic (boards drink-phone-venue and -barcopy).
 * "Little Rye pours the classic spec. See the classic and 7 other bars ›".
 * A variation says what it changes; a spec filled in from the classic says
 * so, so it never reads as the bar's own. Nothing for a riff with its own
 * spec (its family row says so) or before the verdict loads.
 */
export function VersionBanner({ itemId, inline = false, venueName = null }: { itemId: string; inline?: boolean; venueName?: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useLineage(itemId);
  const drink = data?.drink;
  const classic = drink?.riff_of_id ? data?.ancestors.find((a) => a.id === drink.riff_of_id) : undefined;
  const { data: matches } = useSpecMatches(itemId, classic?.is_catalog ? [itemId] : []);
  const { data: source } = useSpecSource(itemId);
  // The classic's other bars, for "and 7 other bars".
  const { data: family } = useLineage(classic?.is_catalog ? classic.id : null);
  const served = useVersionGroups(classic?.is_catalog ? classic.id : null, family?.riffs ?? []).served;
  const match = matches?.[itemId];
  const filled = source?.spec_source === 'classic';
  if (!drink || !classic?.is_catalog || !match || (match.spec_match === 'riff' && !filled)) return null;
  const bar = drink.origin_bar;
  // A venue's own drink has no origin bar: the venue it belongs to names it, and its tile leads (board drink-phone-venue).
  const barName = bar?.display_name ?? venueName ?? 'This bar';
  const note = specNoteText(match.notes);
  const others = served.filter((v) => v.id !== itemId && v.origin_bar?.id !== bar?.id).length;
  const text = filled
    ? match.spec_match === 'riff'
      ? `Spec filled in from the ${classic.name}, with what its name adds. ${barName} hasn't published its own.`
      : `From the classic ${classic.name}. ${barName} hasn't published its own spec.`
    : match.spec_match === 'variation'
      ? `A variation of the ${classic.name}${note ? `: ${note}` : ''}.`
      : match.spec_match === 'same'
        ? `${barName} pours the classic spec.`
        : `${barName} pours the ${classic.name}. Its own spec isn't listed here.`;
  const link = others ? `See the classic and ${others} other bar${others === 1 ? '' : 's'} ›` : `See the ${classic.name} ›`;
  // Desktop: one accent line under the score, no card (board drink-desktop).
  if (inline) {
    return (
      <PressableScale role="link" accessibilityLabel={`${text} ${link.replace(' ›', '')}`} onPress={() => router.push(`/cocktail/${classic.id}` as Href)} style={styles.inline}>
        <DsText variant="body" color={ds.accentText}>{`${text} ${link}`}</DsText>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${text} ${link.replace(' ›', '')}`}
      onPress={() => router.push(`/cocktail/${classic.id}` as Href)}
      style={[styles.banner, { backgroundColor: ds.c.raised }]}
    >
      {bar || venueName ? (
        <View aria-hidden>
          <UserAvatar uri={bar?.avatar_url ?? null} name={bar?.display_name ?? venueName ?? ''} size={32} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Body>{text}</Body>
        <DsText variant="body" color={ds.accentText}>
          {link}
        </DsText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md + 2, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  text: { flex: 1, minWidth: 0, gap: space.xs },
  inline: { alignSelf: 'flex-start' },
});
