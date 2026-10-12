import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, PressableScale, Surface, Tag, useBreakpoint, useDs } from '@/components/ds';
import { backbar, displayFaces, radius, space } from '@/constants/tokens';
import { publishedMenuDrink } from '@/hooks/useMenus';
import { useSharedMenu } from '@/hooks/useSharedMenu';
import { dayLabel } from '@/lib/collection';
import { plural } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { ReportAction } from '../safety/ReportSheet';
import { Kicker } from './PublicChrome';
import { loadFailure, PublicMissing, PublicPage } from './PublicShell';
import { SaveToMake } from './SaveToMake';

const PRIVATE = 'private:';
/** How many drawings sit across the header. */
const STRIP = 4;

/** A drink on the menu that isn't public: it holds its place, with no name. */
const privateDrink = (sectionId: string, index: number): MenuDrink => ({
  id: `${PRIVATE}${sectionId}:${index}`,
  name: 'House drink',
  kind: 'cocktail',
  line: 'Kept private',
  price: null,
  imageUrl: null,
  isSketch: false,
  glass: null,
});

/**
 * A home menu someone shared (/m/<id>), as a guest sees it (ppl-pub-menu-phone,
 * -desktop): a header on paper with a strip of the drinks' drawings, then the
 * drinks, each opening its page with a Save to make it at home, and the "Menu
 * made with Cocktail" card. Drinks that aren't public keep their place as
 * "House drink", never their names.
 */
export function SharedMenuScreen({ id }: { id: string }) {
  const router = useRouter();
  const wide = useBreakpoint() !== 'phone';
  const query = useSharedMenu(id);
  const { data, isPending } = query;
  const [now] = useState(() => Date.now());
  if (!data) return <PublicMissing loading={isPending} what="menu" failed={loadFailure(query)} />;

  const { owner } = data;
  const drinks = data.sections.flatMap((s) => s.drinks);
  const sections = data.sections.map((s) => ({
    id: s.id,
    name: s.name,
    drinks: s.drinks.map((d, i) => (d && publishedMenuDrink(d)) ?? privateDrink(s.id, i)),
  }));
  const strip = sections.flatMap((s) => s.drinks).slice(0, STRIP);
  const report = <ReportAction subject={data.name} targets={[{ label: `${owner.name}, who shared this menu`, target: { kind: 'profile', profileId: owner.profileId } }]} />;
  const made = (
    <Surface style={styles.made}>
      <View style={styles.madeText}>
        <DsText variant="headline" style={{ fontFamily: displayFaces.instrument.regular }}>
          Menu made with Cocktail
        </DsText>
        <Caption tone="muted">Make one for your own night, with the drinks drawn for you.</Caption>
      </View>
      <Button label="Make yours" onPress={() => router.push('/menus/create')} />
    </Surface>
  );

  return (
    <PublicPage title={data.name}>
      <View style={[styles.header, { backgroundColor: backbar.light.paper }]}>
        <PressableScale role="link" accessibilityLabel={`Shared by ${owner.name}, open their profile`} onPress={() => router.push(`/p/${owner.handle}`)} style={styles.start}>
          <Tag label={`Shared by ${owner.name}`} />
        </PressableScale>
        {strip.length ? (
          <View style={styles.strip} aria-hidden>
            {Array.from({ length: STRIP }, (_, i) => strip[i]).map((d, i) =>
              d ? (
                <DrinkImage
                  key={d.id}
                  source={d.imageUrl}
                  generated={d.isSketch}
                  itemId={d.id.startsWith(PRIVATE) ? null : d.id}
                  glass={d.glass}
                  accessibilityLabel={d.name}
                  aspectRatio={0.85}
                  radius="control"
                  style={styles.flex}
                  sketchDetail="thumb"
                />
              ) : (
                <View key={`blank-${i}`} style={styles.flex} />
              ),
            )}
          </View>
        ) : null}
        <DsText variant={wide ? 'display' : 'title'} role="heading" color={backbar.light.ink}>
          {data.name}
        </DsText>
        <Body color={backbar.light.muted}>{[data.menuDate ? dayLabel(data.menuDate, now) : null, plural(drinks.length, 'drink')].filter(Boolean).join(' · ')}</Body>
        {strip.length ? <Caption color={backbar.light.muted}>Drawn from each drink’s spec</Caption> : null}
      </View>
      <View style={wide ? styles.columns : styles.stack}>
        <View style={[styles.list, wide && styles.listWide]}>
          {drinks.length ? (
            sections.map((s) => (
              <View key={s.id} style={styles.section}>
                <Kicker>{s.name || 'Drinks'}</Kicker>
                <View role="list">
                  {s.drinks.map((d) => (
                    <MenuRow key={d.id} drink={d} open={d.id.startsWith(PRIVATE) ? null : () => router.push(`/d/${d.id}`)} />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Body tone="muted">No drinks on this menu yet.</Body>
          )}
          {drinks.length ? <Caption tone="muted">Tap a drink for its spec. Save it and it’s in your bar to make at home.</Caption> : null}
        </View>
        <View style={[styles.aside, wide && styles.asideWide]}>
          {made}
          <View style={styles.start}>{report}</View>
        </View>
      </View>
    </PublicPage>
  );
}

/** One drink: its picture, name and line opening its page, and Save. A private one is just its place. */
function MenuRow({ drink: d, open }: { drink: MenuDrink; open: (() => void) | null }) {
  const ds = useDs();
  const text = (
    <>
      <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }} numberOfLines={1}>
        {d.name}
      </DsText>
      {d.line ? (
        <Caption tone="muted" numberOfLines={2}>
          {d.line}
        </Caption>
      ) : null}
    </>
  );
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <DrinkImage
        source={d.imageUrl}
        generated={d.isSketch}
        itemId={open ? d.id : null}
        glass={d.glass}
        accessibilityLabel={d.name}
        aspectRatio={56 / 64}
        radius="control"
        style={styles.thumb}
        thumb
        sketchDetail="thumb"
      />
      {open ? (
        <PressableScale role="link" accessibilityLabel={[d.name, d.line].filter(Boolean).join('. ')} onPress={open} style={styles.rowText}>
          {text}
        </PressableScale>
      ) : (
        <View style={styles.rowText}>{text}</View>
      )}
      {open ? <SaveToMake itemId={d.id} name={d.name} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  header: { gap: space.sm, padding: space.xl, borderRadius: radius.card },
  strip: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.xxl + space.sm },
  stack: { gap: space.xl },
  list: { gap: space.md },
  listWide: { flexGrow: 3, flexShrink: 1, flexBasis: 480, minWidth: 0 },
  aside: { gap: space.md },
  asideWide: { flexGrow: 2, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  section: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  made: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.lg },
  madeText: { flexGrow: 1, flexBasis: 200, gap: space.xs },
});
