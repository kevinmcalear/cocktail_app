import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, RowScore, scoreWords, useDs } from '@/components/ds';
import { displayFaces, space } from '@/constants/tokens';
import { useWhereToDrink, type PublicVenue } from '@/hooks/usePublicDrink';
import { whereCaption } from '@/lib/publicDrink';

import { Kicker } from './PublicChrome';

/** How many bars the section lists. */
const SHOWN = 3;

/**
 * Where to drink it: the top bars for the drink's list in its bar's city (or
 * everywhere), with each bar's score and how many ranked it, and where this
 * drink's bar stands. Scores show signed out too (n198).
 */
export function PublicWhereToDrink({ rankedAs, venue }: { rankedAs: { id: string; name: string }; venue: PublicVenue | null }) {
  const ds = useDs();
  const router = useRouter();
  const city = venue?.city ?? null;
  const { data: rows, isPending } = useWhereToDrink(rankedAs.id, venue);
  if (isPending) return null;
  const caption = whereCaption(rows ?? [], rankedAs.name, city, venue?.id ?? null);
  const face = displayFaces[ds.displayFace].regular;

  return (
    <View style={styles.section} role="region" aria-label="Where to drink it">
      <Kicker>{city ? `Where to drink it · ${city}` : 'Where to drink it'}</Kicker>
      <Caption tone="muted">{caption ?? `No bar’s ${rankedAs.name} has enough ranks ${city ? `near ${city} ` : ''}to list yet.`}</Caption>
      {(rows ?? []).slice(0, SHOWN).map((r) => {
        const place = r.locality ?? r.city;
        const detail = `${r.rankers} ranked`;
        return (
          <PressableScale
            key={r.venue_profile_id}
            role="link"
            accessibilityLabel={[`${r.position}. ${r.display_name}`, place, scoreWords(r.score, detail)].filter(Boolean).join(', ')}
            onPress={() => router.push(`/p/${r.handle}`)}
            style={[styles.row, { borderBottomColor: ds.c.line }]}
          >
            <DsText variant="headline" style={[styles.position, { fontFamily: face }]} color={r.position === 1 ? ds.accentText : ds.c.muted}>
              {String(r.position)}
            </DsText>
            <View style={styles.name}>
              <DsText variant="headline" style={{ fontFamily: face }} numberOfLines={1}>
                {r.display_name}
              </DsText>
              {place ? (
                <Caption tone="muted" numberOfLines={1}>
                  {place}
                </Caption>
              ) : null}
            </View>
            <RowScore score={r.score} detail={detail} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position: { width: 24 },
  name: { flex: 1, minWidth: 0 },
});
