import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useHistoryStory } from '@/hooks/useHistoryStory';
import { FAMILIES, type TreeNode } from '@/lib/drinkTree';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import { shortYear, thread } from '@/lib/timeline';
import { TIER_LABEL, tierOf } from '@/lib/timeTree';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;
const bookHref = (key: string) => `/book/${key}` as Href;
const TILE = 72;

/** "en.wikipedia.org/wiki/Boulevardier_(cocktail)": a source link as the board prints it. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** A label and its links, one fact in the story. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.fact, { borderTopColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.label}>
        {label}
      </Caption>
      {children}
    </View>
  );
}

function Links({ items }: { items: { key: string; label: string; aria?: string; onPress: () => void }[] }) {
  const ds = useDs();
  return (
    <View style={styles.links}>
      {items.map((it) => (
        <PressableScale key={it.key} role="link" accessibilityLabel={it.aria ?? it.label} onPress={it.onPress} style={[styles.link, { borderColor: ds.c.lineStrong }]}>
          <Caption numberOfLines={1}>{it.label}</Caption>
        </PressableScale>
      ))}
    </View>
  );
}

/**
 * A drink's whole story from History's tree: family and tier, its drawing,
 * name and aliases, who made it where, the line it descends from, what
 * changed, its spec, the riffs on it, bars' versions and sources. The phone's
 * sheet and the desktop side panel both show it.
 * ponytail: no "Also borrows from" (the tree keeps one parent per drink) and
 * no scores on bar versions (score plumbing is the search and scores work).
 */
export function DrinkStory({ node, nodes, onSelect, onTimeline }: { node: TreeNode; nodes: readonly TreeNode[]; onSelect: (key: string) => void; onTimeline?: () => void }) {
  const router = useRouter();
  const drink = node.kind === 'drink';
  const { data: story } = useHistoryStory(drink ? node.id : null);
  const { data: item } = useCocktail(drink ? node.id : undefined);
  const family = FAMILIES.find((f) => f.key === node.family)?.name ?? (node.family === 'trunk' ? 'The trunk' : null);
  const line = thread(nodes, node.key).slice(0, -1);
  const riffs = nodes.filter((n) => n.parentKey === node.key);
  const spec = specLines((item?.recipes ?? null) as PresentationRecipe[] | null)
    .filter((l) => l.ingredient)
    .map((l) => [l.amount, l.ingredient].filter(Boolean).join(' '))
    .join(', ');
  const meta = [shortYear(node) || null, node.creator, node.city, drink ? (node.bar ? `${node.bar}${node.barClosed ? ' (closed)' : ''}` : 'no bar on record') : null]
    .filter(Boolean)
    .join(' · ');
  const aliases = story?.aliases ?? [];
  const more = node.versions - (story?.versions.length ?? 0);

  return (
    <View style={styles.story}>
      <Caption tone="muted" style={styles.label}>
        {[family, TIER_LABEL[tierOf(node)]].filter(Boolean).join(' · ')}
      </Caption>
      <View style={styles.head}>
        {drink ? <DrinkImage itemId={node.id} accessibilityLabel={`${node.name}, drawn`} radius="control" sketchDetail="thumb" style={styles.tile} /> : null}
        <View style={styles.flex}>
          <DsText variant="headline" style={styles.name}>
            {node.name}
          </DsText>
          {aliases.length ? <Caption tone="muted">{`Also ${aliases.map((a) => a.alias).join(', ')}`}</Caption> : null}
        </View>
      </View>
      {meta ? <Body tone="muted">{meta}</Body> : null}
      {drink ? <Button label={`Open ${node.name}`} onPress={() => router.push(drinkHref(node.id))} /> : null}

      {line.length ? (
        <Fact label="Descends from">
          <Links items={line.map((n) => ({ key: n.key, label: [n.name, shortYear(n)].filter(Boolean).join(' · '), onPress: () => onSelect(n.key) }))} />
        </Fact>
      ) : null}
      {node.note ? (
        <Fact label="What changed">
          <Body>{node.note}</Body>
        </Fact>
      ) : null}
      {spec ? (
        <Fact label="Spec">
          <Body>{spec}</Body>
        </Fact>
      ) : null}
      {riffs.length ? (
        <Fact label={`Riffs on it · ${riffs.length}`}>
          <Links items={riffs.map((n) => ({ key: n.key, label: n.name, onPress: () => onSelect(n.key) }))} />
        </Fact>
      ) : null}
      {node.versions ? (
        <Fact label={`Bar versions · ${node.versions}`}>
          <Links
            items={[
              ...(story?.versions ?? []).map((v) => ({ key: v.id, label: [v.name, v.bar].filter(Boolean).join(' · '), onPress: () => router.push(drinkHref(v.id)) })),
              ...(more > 0 ? [{ key: 'more', label: `${more} more version${more === 1 ? '' : 's'}`, aria: `See all ${node.versions} on ${node.name}'s page`, onPress: () => router.push(drinkHref(node.id)) }] : []),
            ]}
          />
        </Fact>
      ) : null}
      {aliases.length || story?.books.length ? (
        <Fact label="Sources">
          <Links
            items={[
              ...[...new Set(aliases.map((a) => a.source))].map((url) => ({ key: url, label: shortUrl(url), onPress: () => void Linking.openURL(url) })),
              ...(story?.books ?? []).map((b) => ({ key: b.key, label: [b.title, b.year, b.author].filter(Boolean).join(', '), onPress: () => router.push(bookHref(b.key)) })),
            ]}
          />
        </Fact>
      ) : null}
      {onTimeline ? <Button label="See it on the timeline" variant="secondary" onPress={onTimeline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  story: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { width: TILE, height: TILE },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamilies.instrument },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  fact: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  link: { minHeight: layout.minTapTarget - space.sm, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
});
