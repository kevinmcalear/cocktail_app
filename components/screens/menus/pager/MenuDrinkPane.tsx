import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { displayFaces, font, layout, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useMenuArrowKeys } from '@/hooks/useMenuPager';
import { printedPrice } from '@/lib/menus';
import { inMenuQuery, type PagerPlace } from '@/lib/menuPager';
import type { MenuDrink } from '@/types/menus';

import { useSignedIn } from '@/ctx/AuthContext';

import { useAgeGate } from '../../safety/AgeGate';
import { menuDrinkHref } from '../MenuSections';
import { MenuDrawing } from '../page/MenuDrawing';

// The pane itself loads lazily with the desktop's menu page (MenuScreen), so Rank it's sheets come in that chunk. A lazy import here
// split them into a chunk shared with the public drink page, adding to its first load (B13 /d/[id]).
import { RankFlow } from '../../rank/RankActions';

/**
 * The desktop's menu page (2027 canvas, Menu-desk): the chosen drink beside
 * the menu as a card, "4 of 8" and ‹ › over it (and the arrow keys) to step
 * through the menu without leaving it. Its drawing, name and line, what's in
 * it, the price and how it's served, and Rank it; the drink's own page is a
 * link away.
 */
export function MenuDrinkPane({ drink, menuId, barName, place, onPick }: { drink: MenuDrink; menuId: string; barName: string | null; place: PagerPlace | null; onPick: (id: string) => void }) {
  const ds = useDs();
  const router = useRouter();
  const query = useCocktail(drink.id, { seeded: true });
  const item = query.isPlaceholderData ? undefined : query.data;
  const signedIn = useSignedIn();
  const ageGate = useAgeGate();
  const [ranking, setRanking] = useState(false);
  // As the drink page's Rank it: a confirmed age, and signed out it asks you to sign in.
  const rank = () => (signedIn ? ageGate.gate(() => setRanking(true)) : router.push('/auth/login?step=email'));
  const prev = place?.prev ?? null;
  const next = place?.next ?? null;

  // ← and → step through the menu.
  useMenuArrowKeys(prev ? () => onPick(prev.id) : null, next ? () => onPick(next.id) : null);

  const served = [item?.glassware?.name, item?.ice?.name].filter(Boolean).join(', ');
  const price = printedPrice(drink);
  const facts = [
    { k: 'What’s in it', v: drink.line },
    { k: 'Price', v: price },
    { k: 'Served', v: served },
  ].filter((f): f is { k: string; v: string } => !!f.v);
  const eyebrow = [item?.bar_id ? barName : null, item ? (item.bar_id ? 'House spec' : 'Classic') : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.pane, { borderLeftColor: ds.c.line, backgroundColor: ds.c.ground }]}>
      {place ? (
        <View style={styles.head} role="navigation" aria-label="Drinks on this menu">
          <Caption tone="muted" style={[styles.caps, styles.grow]}>
            {`${place.index + 1} of ${place.total}`.toUpperCase()}
          </Caption>
          <Step label="‹" name={prev?.name} onPress={prev ? () => onPick(prev.id) : undefined} />
          <Step label="›" name={next?.name} onPress={next ? () => onPick(next.id) : undefined} />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.drawing} aria-hidden>
          <MenuDrawing itemId={drink.id} size="hero" ink="colour" fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
        </View>
        <View style={styles.title}>
          {eyebrow ? (
            <Caption tone="muted" style={styles.caps}>
              {eyebrow.toUpperCase()}
            </Caption>
          ) : null}
          <DsText variant="title" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
            {drink.name}
          </DsText>
          {item?.origin ? (
            <DsText variant="headline" tone="muted" style={[font.regular, { fontFamily: displayFaces[ds.displayFace].italic }]}>
              {item.origin}
            </DsText>
          ) : null}
        </View>
        {/* The drink's own words, when they say more than its ingredients (What's in it, below). */}
        {item?.description && item.description.trim() !== drink.line.trim() ? <Body>{item.description}</Body> : null}
        <View>
          {facts.map((f) => (
            <View key={f.k} style={[styles.fact, { borderTopColor: ds.c.line }]}>
              <Body tone="muted">{f.k}</Body>
              <Body style={styles.factValue}>{f.v}</Body>
            </View>
          ))}
          <View style={[styles.fact, styles.rule, { borderTopColor: ds.c.line }]} />
        </View>
        <Button label="Rank it" variant="ink" size="lg" onPress={rank} accessibilityHint={`Rank ${drink.name} against others you've had`} />
        <PressableScale role="link" accessibilityLabel={`Open ${drink.name}`} onPress={() => router.push(`${menuDrinkHref(drink)}?${inMenuQuery(menuId)}` as Href)} style={styles.open}>
          <Caption style={font.semiBold}>Open the drink ›</Caption>
        </PressableScale>
      </ScrollView>
      {ranking ? <RankFlow item={{ id: drink.id, name: drink.name, bar_id: item?.bar_id ?? null }} picture={null} onClose={() => setRanking(false)} /> : null}
      {ageGate.sheet}
    </View>
  );
}

function Step({ label, name, onPress }: { label: string; name: string | undefined; onPress?: () => void }) {
  return (
    <PressableScale role="button" accessibilityLabel={name ? `${label === '‹' ? 'Before' : 'Next'}: ${name}` : undefined} disabled={!onPress} onPress={onPress} style={[styles.step, !onPress && styles.off]}>
      <DsText variant="label" style={font.semiBold}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pane: { width: layout.menuPaneDesk, flexShrink: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xl, paddingTop: space.lg },
  caps: { letterSpacing: 1.5, ...font.medium },
  grow: { flex: 1 },
  step: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  body: { paddingHorizontal: space.xxl, paddingBottom: space.xxl, gap: space.lg },
  drawing: { alignItems: 'center', paddingTop: space.md },
  title: { gap: space.xs },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.sm + 2, borderTopWidth: StyleSheet.hairlineWidth },
  factValue: { flexShrink: 1, textAlign: 'right' },
  rule: { paddingVertical: 0 },
  open: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
