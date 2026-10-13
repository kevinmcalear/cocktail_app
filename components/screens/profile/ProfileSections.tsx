import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, Headline, PressableScale, RowScore, scoreWords, Spec, Title, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space, type } from '@/constants/tokens';
import { useVenueScore } from '@/hooks/useDiscover';
import { useItemScores } from '@/hooks/useFlavor';
import { useProfileAwards, useProfilePositions, type MenuCreditWithProfile, type Original, type Profile, type WorkedMenu } from '@/hooks/useProfiles';
import { heroPicture } from '@/lib/itemImages';
import { peopleCount } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';
import { versionLabel } from '@/lib/servedAt';

import { CreditTag } from '../drink/DrinkCredit';
import { BarMark } from '../home/BarMark';
import { ClassicsTheyPour, usePouredSplit } from './ClassicsTheyPour';
import { isShownPosition } from './Positions';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

/** "riffed 12×", when other drinks name it as their classic. */
export const riffed = (d: Pick<Original, 'versions'>) => {
  const n = d.versions?.[0]?.count ?? 0;
  return n ? `riffed ${n}×` : null;
};

/**
 * A profile's credited drinks; each opens the drink. Tiles on a person's page
 * ("8.4 · riffed 12×" under the name); rows on a bar's page (who made it, its
 * description) and on You ("Your original · 2026 · riffed 2×"), each with its
 * score at the end (b02). The profile's own name is left out. Their copies of
 * a classic poured as it is (the same spec, or none to tell) sit in one line,
 * "Classics they pour", instead of a tile each; a variation says what it changes.
 */
export function OriginalsGrid({ originals, columns, emptyText, selfId, layout = 'tiles', mine = false, ownerName, runs }: { originals: Original[]; columns: number; emptyText: string; selfId: string; layout?: 'tiles' | 'rows'; mine?: boolean; ownerName?: string; runs?: Readonly<Record<string, string>> }) {
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const { poured, own, matches } = usePouredSplit(selfId, originals);
  const { data: scores } = useItemScores(originals.map((d) => d.id));
  if (!originals.length) return <Body tone="muted">{emptyText}</Body>;
  const others = (d: Original) => [d.creator, d.origin_bar].filter((p) => p && p.id !== selfId).map((p) => p!.display_name);
  return (
    <View style={styles.originals}>
      <ClassicsTheyPour drinks={poured} scores={scores} barName={ownerName} />
      {layout === 'rows' ? (
        <View role="list">
          {own.map((d) => {
            const hero = heroPicture(d.item_images);
            const by = others(d);
            const caption = [mine ? 'Your original' : by.length ? `by ${by.join(' and ')}` : null, mine ? d.origin_year : runs?.[d.id], versionLabel(matches?.[d.id]), riffed(d)].filter(Boolean).join(' · ') || undefined;
            const said = scoreWords(scores?.[d.id]);
            return (
              <DrinkRow
                key={d.id}
                name={d.name}
                href={`/cocktail/${d.id}`}
                itemId={d.id}
                imageUrl={hero?.url ?? null}
                glass={d.glass?.icon_key ?? null}
                caption={caption}
                note={mine ? undefined : (d.description ?? undefined)}
                trailing={<RowScore score={scores?.[d.id]} />}
                label={said ? [d.name, caption, said].filter(Boolean).join('. ') : undefined}
              />
            );
          })}
        </View>
      ) : (
        <View role="list" style={styles.grid}>
          {own.map((d) => {
            const hero = heroPicture(d.item_images);
            const score = scores?.[d.id];
            const meta = [score !== undefined ? formatScore(score) : null, riffed(d), d.origin_year, ...others(d), versionLabel(matches?.[d.id])].filter(Boolean).join(' · ');
            return (
              <PressableScale
                key={d.id}
                role="link"
                accessibilityLabel={[d.name, score !== undefined ? scoreWords(score) : null, meta].filter(Boolean).join('. ')}
                onPressIn={() => prefetch(d.id, { name: d.name, item_images: d.item_images })}
                onPress={() => router.push(`/cocktail/${d.id}` as Href)}
                style={[styles.tile, { width: `${100 / columns}%` }]}
              >
                <DrinkImage thumb source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} />
                <DsText variant="headline" numberOfLines={2}>
                  {d.name}
                </DsText>
                {meta ? (
                  <Caption tone="muted" numberOfLines={1}>
                    {meta}
                  </Caption>
                ) : null}
                <CreditTag status={d.credit_status} />
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * "On the menu at": bars carrying this profile's drinks, current menus first,
 * then the menus a person says they worked on (g460), with the drinks they
 * made for each when they listed them (b62).
 */
export function MenuCredits({ credits, names, worked = [] }: { credits: MenuCreditWithProfile[]; names: Map<string, string>; worked?: WorkedMenu[] }) {
  const ds = useDs();
  const router = useRouter();
  // A worked menu already listed as a credit (same bar and name) shows once.
  const extra = worked.filter((m) => !credits.some((c) => c.barProfileId === m.bar.id && c.menuName === m.name));
  if (!credits.length && !extra.length) return null;
  return (
    <View style={styles.menus}>
      <Headline role="heading">On the menu at</Headline>
      <View role="list">
        {credits.map((c) => {
          const drinks = c.itemIds.map((id) => names.get(id)).filter(Boolean).join(', ');
          const label = `${c.barName ?? 'A bar'}, ${c.menuName}${c.current ? '' : ' (past menu)'}: ${drinks}`;
          const row = (
            <>
              <View style={styles.flex}>
                <DsText variant="headline" numberOfLines={1}>
                  {c.barName ?? 'A bar'}
                </DsText>
                <Caption tone="muted" numberOfLines={2}>
                  {`${c.menuName} · ${drinks}`}
                </Caption>
              </View>
              <Caption tone={c.current ? 'ink' : 'muted'}>{c.current ? 'On now' : 'Past menu'}</Caption>
            </>
          );
          return c.barProfileId ? (
            <PressableScale
              key={c.menuId}
              role="link"
              accessibilityLabel={`${label}. Open the bar's profile`}
              onPress={() => router.push(`/p/${c.barProfileId}` as Href)}
              style={[styles.menu, { borderBottomColor: ds.c.line }]}
            >
              {row}
            </PressableScale>
          ) : (
            <View key={c.menuId} role="listitem" accessible accessibilityLabel={label} style={[styles.menu, { borderBottomColor: ds.c.line }]}>
              {row}
            </View>
          );
        })}
        {extra.map((m) => {
          const drinks = (m.drinks ?? []).flatMap((d) => (d.item ? [d.item.name] : [])).join(', ');
          const when = m.bar.is_closed ? 'Closed' : m.year ? String(m.year) : 'Past menu';
          return (
            <PressableScale
              key={m.id}
              role="link"
              accessibilityLabel={`${m.bar.display_name}, ${m.name}${drinks ? `: ${drinks}` : ''}, ${when}. Open the bar's profile`}
              onPress={() => router.push(`/p/${m.bar.handle}` as Href)}
              style={[styles.menu, { borderBottomColor: ds.c.line }]}
            >
              <View style={styles.flex}>
                <DsText variant="headline" numberOfLines={1}>
                  {m.bar.display_name}
                </DsText>
                <Caption tone="muted" numberOfLines={2}>
                  {[m.name, drinks].filter(Boolean).join(' · ')}
                </Caption>
              </View>
              <Caption tone="muted">{when}</Caption>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A bar's name with its score and how many people have ranked drinks there.
 * The score is its drinks' scores averaged, weighted by how many people
 * ranked each. Early (under MIN_RANKERS people) gives the count, no number.
 * The tag (Claimed) sits under the name, or with `tagInline` after the place
 * line, with how many ranked under it (Not claimed yet, ppl-bar-unclaimed).
 */
export function BarHeader({ profile, detail, tag, tagInline, neutral, size = 64 }: { profile: { id: string; display_name: string; avatar_url: string | null }; detail: string; tag?: ReactNode; tagInline?: boolean; neutral?: boolean; size?: number }) {
  const { data } = useVenueScore(profile.id);
  const score = data?.score ?? null;
  const ranked = data?.rankers ? `${peopleCount(data.rankers)} ranked` : null;
  const scoreLabel = score !== null ? `Bar score ${formatScore(score)} out of 10` : ranked ? `No bar score until ${MIN_RANKERS} people have ranked here` : null;
  // Ranked sits under the score (ppl-bar-top), on its own line with an inline tag (ppl-bar-unclaimed), else after the place.
  const underScore = score !== null && !tagInline;
  const line = tagInline || score !== null ? detail : [detail, ranked].filter(Boolean).join(' · ');
  // The mark, then the name, its tag and the place line; the score over "bar score" and "212 people ranked" (ppl-bar-top).
  return (
    <View accessible accessibilityLabel={[profile.display_name, detail, ranked, scoreLabel].filter(Boolean).join('. ')} style={styles.barHeader}>
      <BarMark name={profile.display_name} logoUrl={profile.avatar_url} profileId={profile.id} size={size} neutral={neutral} />
      <View style={[styles.flex, tagInline ? styles.barNameLoose : styles.barName]}>
        <Title>{profile.display_name}</Title>
        {tagInline ? (
          <View style={styles.inline}>
            {line ? <Caption tone="muted">{line}</Caption> : null}
            {tag}
          </View>
        ) : (
          <>
            {tag}
            {line ? <Caption tone="muted">{line}</Caption> : null}
          </>
        )}
        {tagInline && ranked ? <Caption tone="muted">{ranked}</Caption> : null}
      </View>
      {score !== null ? (
        <View style={styles.barScore}>
          <Spec tone="accent" style={type.headline}>
            {formatScore(score)}
          </Spec>
          <Caption tone="muted">bar score</Caption>
          {underScore && ranked ? <Caption tone="muted">{ranked}</Caption> : null}
        </View>
      ) : null}
    </View>
  );
}

/** The numbers under a bar's name (its score sits in BarHeader): awards, people and originals, ruled above and below (ppl-bar-top). */
export function BarStats({ profile, originals, onAwards }: { profile: Pick<Profile, 'id' | 'kind'>; originals: number; onAwards?: () => void }) {
  const { data: awards = [] } = useProfileAwards(profile.id);
  const people = (useProfilePositions(profile).data ?? []).filter(isShownPosition).length;
  const label = awards.length === 1 ? 'award' : 'awards';
  return (
    <Stats ruled>
      {/* Only the count shows on the page (ppl-bar-top); tapping it lists them, so its label is underlined. */}
      {onAwards && awards.length ? (
        <PressableScale role="button" accessibilityLabel={`${awards.length} ${label}. Open the list`} onPress={onAwards} style={styles.statCell}>
          <Stat value={awards.length} label={label} link />
        </PressableScale>
      ) : (
        <Stat value={awards.length} label={label} ruled />
      )}
      <Stat value={people} label={people === 1 ? 'person' : 'people'} ruled />
      <Stat value={originals} label={originals === 1 ? 'original' : 'originals'} ruled />
    </Stats>
  );
}

/** The numbers under a profile's name. `ruled`: three equal columns between two hairlines (a bar's page). */
export function Stats({ children, ruled }: { children: ReactNode; ruled?: boolean }) {
  const ds = useDs();
  return (
    <View role="list" style={ruled ? [styles.ruled, { borderColor: ds.c.line }] : styles.stats}>
      {children}
    </View>
  );
}

export function Stat({ value, label, link, ruled }: { value: number | string; label: string; link?: boolean; ruled?: boolean }) {
  return (
    <View role="listitem" accessible accessibilityLabel={`${value} ${label}`} style={[styles.stat, ruled ? styles.statCell : null]}>
      <Spec align="center">{value}</Spec>
      <Caption tone="muted" align="center" style={link ? styles.link : null}>
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  originals: { gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2, rowGap: space.lg },
  tile: { paddingHorizontal: space.sm / 2, gap: space.xs },
  menus: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2 },
  barName: { gap: 2 },
  barNameLoose: { gap: space.xs },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm, rowGap: space.xs },
  barScore: { alignItems: 'flex-end' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl },
  stat: { alignItems: 'center', minWidth: 72 },
  ruled: { flexDirection: 'row', paddingVertical: space.md + 2, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  statCell: { flex: 1, minWidth: 0, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
});
