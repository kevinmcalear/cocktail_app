import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useMenuEditions } from '@/hooks/useProfiles';
import { withAlpha } from '@/lib/color';
import { editionDates, editionDrinkLine, menuRange, timelineDates, type MenuEdition } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';

/** Past menus listed before "Show all 9 menus". */
const FIRST_PAST = 5;
/** A theme this short shows after the dates. */
const SHORT_THEME = 24;

/**
 * A bar's menus on its public page (ppl-pub-bar-desktop, -phone): the one on
 * now as a card (when it started, its drinks, Open the menu), then the past
 * ones as plain rows, the name over when it ran. Each opens the menu.
 */
export function PublicMenus({ profileId, name }: { profileId: string; name: string }) {
  const { data = [], isLoading } = useMenuEditions(profileId);
  const [all, setAll] = useState(false);
  if (isLoading) return <Caption tone="muted">Loading menus…</Caption>;
  if (!data.length) return <Body tone="muted">{`No menus from ${name} here yet.`}</Body>;
  const now = data.find((m) => m.is_current) ?? null;
  const past = data.filter((m) => m !== now);
  const shown = all ? past : past.slice(0, FIRST_PAST);
  const href = (m: MenuEdition) => `/p/${profileId}/menus/${m.id}`;
  return (
    <View style={styles.block}>
      {now ? <OnNowCard edition={now} href={href(now)} /> : null}
      {shown.length ? (
        <View role="list">
          {shown.map((m) => (
            <PastRow key={m.id} edition={m} href={href(m)} />
          ))}
        </View>
      ) : null}
      {past.length > FIRST_PAST && !all ? <Button label={`Show all ${data.length} menus`} variant="secondary" onPress={() => setAll(true)} style={styles.start} /> : null}
    </View>
  );
}

function OnNowCard({ edition: m, href }: { edition: MenuEdition; href: string }) {
  const ds = useDs();
  const router = useRouter();
  const names = m.drinks.map((d) => d.name);
  const drinks = names.length ? `${plural(names.length, 'drink')}. ${editionDrinkLine(names)}` : editionDrinkLine(names);
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: withAlpha(ds.accentText, 0.4) }]}>
      <Caption style={[styles.kicker, { color: ds.accentText }]}>{timelineDates(editionDates(m)).toUpperCase()}</Caption>
      <DsText variant="title">{m.name}</DsText>
      <Body tone="muted">{drinks}</Body>
      <Button label="Open the menu" variant="secondary" accessibilityLabel={`Open the ${m.name} menu`} onPress={() => router.push(href as Href)} style={styles.open} />
    </View>
  );
}

function PastRow({ edition: m, href }: { edition: MenuEdition; href: string }) {
  const ds = useDs();
  const router = useRouter();
  // A short note rides along ("opening menu"); a researched paragraph doesn't fit the row.
  const when = [menuRange(editionDates(m)), m.theme && m.theme.length <= SHORT_THEME ? m.theme : null].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={`${m.name}. ${when}. Open the menu`} onPress={() => router.push(href as Href)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }} numberOfLines={1}>
          {m.name}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {when}
        </Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  block: { gap: space.xs },
  start: { alignSelf: 'flex-start', marginTop: space.sm },
  card: { gap: space.xs + 2, padding: space.lg + 2, marginBottom: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  kicker: { fontFamily: fontFamilies.bodyMedium, letterSpacing: 1.2 },
  open: { alignSelf: 'flex-start', marginTop: space.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
