import { useRouter, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, TextLink, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import type { PublicDrinkMore, TreeDrink } from '@/hooks/usePublicDrink';
import { drinkPageHref } from '@/lib/itemRoutes';
import { ancestorCaption, makerLabel } from '@/lib/publicDrink';
import { formatScore } from '@/lib/ranking';

/** How many riffs show before "All N riffs, ranked". */
const SHOWN_RIFFS = 3;

function Node({ name, caption, score, current, onPress }: { name: string; caption: string | null; score?: number | null; current?: boolean; onPress?: () => void }) {
  const ds = useDs();
  const ink = current ? ds.accentFill.text : ds.c.ink;
  const words = [name, caption, score != null ? `score ${formatScore(score)}` : null].filter(Boolean).join(', ');
  const frame = [styles.node, current ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.glassBorder }];
  const content = (
    <>
      <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }} color={ink} numberOfLines={1}>
        {name}
      </DsText>
      {caption || score != null ? (
        <Caption color={current ? ink : ds.c.muted} numberOfLines={1}>
          {caption}
          {caption && score != null ? ' · ' : ''}
          {score != null ? <Text style={[styles.score, { color: ds.accentText }]}>{formatScore(score)}</Text> : null}
        </Caption>
      ) : null}
    </>
  );
  if (current) {
    return (
      <View accessible accessibilityLabel={`${words}, this drink`} style={frame}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale role="link" accessibilityLabel={words} onPress={onPress} style={frame}>
      {content}
    </PressableScale>
  );
}

function Joint() {
  const ds = useDs();
  return <View aria-hidden style={[styles.joint, { backgroundColor: ds.c.lineStrong }]} />;
}

/**
 * The family tree, left to right: where the drink comes from and the drink
 * (lit); its best scored riffs with who made them hang below, on a rule
 * (ppl-pub-drink-desktop). Nothing when it has neither parents nor riffs.
 */
export function PublicFamilyTree({ drink, more }: { drink: { id: string; name: string; originYear: number | null }; more: PublicDrinkMore }) {
  const ds = useDs();
  const router = useRouter();
  const signedIn = useSignedIn();
  const [all, setAll] = useState(false);
  const row = useRef<ComponentRef<typeof ScrollView>>(null);
  const { ancestors, riffs, profiles } = more;
  if (!ancestors.length && !riffs.length) return null;
  const maker = (d: TreeDrink) => makerLabel(d.makerId ? (profiles[d.makerId] ?? null) : null);
  const open = (id: string) => router.push(drinkPageHref(id, signedIn) as Href);
  const shown = all ? riffs : riffs.slice(0, SHOWN_RIFFS);

  return (
    <View style={styles.section}>
      <Headline role="heading">Family tree</Headline>
      {/* One row, never wrapped (a wrapped joint led nowhere): on a phone it scrolls, opened at the lit drink. */}
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => row.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.tree}
      >
        {ancestors.map((a) => (
          <View key={a.id} style={styles.step}>
            <Node name={a.name} caption={ancestorCaption(a, maker(a))} onPress={() => open(a.id)} />
            <Joint />
          </View>
        ))}
        <Node name={drink.name} caption={drink.originYear ? String(drink.originYear) : null} current />
      </ScrollView>
      {shown.length ? (
        <View style={[styles.riffs, { borderLeftColor: ds.c.lineStrong }]}>
          {shown.map((r) => (
            <Node key={r.id} name={r.name} caption={maker(r)} score={r.score} onPress={() => open(r.id)} />
          ))}
        </View>
      ) : null}
      {riffs.length > SHOWN_RIFFS ? <TextLink label={all ? 'Show the top three' : `All ${riffs.length} riffs, ranked`} onPress={() => setAll((a) => !a)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  tree: { flexDirection: 'row', alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center' },
  node: {
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    maxWidth: 280,
  },
  joint: { width: 18, height: 1.5 },
  riffs: { alignSelf: 'flex-start', gap: space.xs + 2, paddingLeft: space.md, borderLeftWidth: 1.5, marginTop: -space.xs },
  score: { fontFamily: fontFamilies.mono },
});
