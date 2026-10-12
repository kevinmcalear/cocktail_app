import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { displayFaces, radius, space } from '@/constants/tokens';
import { useSavedMenus } from '@/hooks/useKept';
import { menuState } from '@/lib/menuEditions';

import { CardGrid } from './CardGrid';

/**
 * Bar menus you saved (Save menu on a bar's menu page), on Collection's
 * Menus, as cards (b08): a cover with the bar and the menu's name, whether
 * its specs are open, and how much of it your shelf makes. Nothing when
 * there are none.
 * ponytail: the cover is in the app's accent and face; a bar's own colours
 * need a public read of its brand (see BarMark).
 */
export function CollectionSavedMenus({ canMakeIds }: { canMakeIds: Set<string> }) {
  const ds = useDs();
  const router = useRouter();
  const menus = useSavedMenus().data ?? [];
  if (!menus.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Saved from bars</Headline>
      <Caption tone="muted" style={styles.note}>
        Menus you loved. They stay here after the bar changes its menu.
      </Caption>
      <CardGrid min={360}>
        {menus.map((m) => {
          const ready = m.drinkIds.filter((id) => canMakeIds.has(id)).length;
          const when = m.dates.isCurrent ? 'On now' : menuState(m.dates) === 'past' ? 'Past menu' : null;
          const access = m.openSpecs ? 'Open specs' : 'Names only';
          const make = !m.openSpecs ? 'Names and what’s in them' : m.drinkIds.length ? `${ready} of ${m.drinkIds.length} ready to make` : null;
          return (
            <PressableScale
              key={m.editionId}
              role="link"
              accessibilityLabel={[`${m.name}, ${m.barName}`, when, access, make].filter(Boolean).join('. ')}
              onPress={() => router.push(`/p/${m.barId}/menus/${m.editionId}` as Href)}
              style={[styles.card, { backgroundColor: ds.c.surface }]}
            >
              <View style={[styles.cover, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]} aria-hidden>
                <Caption color={ds.accentText} style={styles.short} numberOfLines={2}>
                  {m.barName.toUpperCase()}
                </Caption>
                <DsText variant="body" numberOfLines={3} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                  {m.name}
                </DsText>
              </View>
              <View style={styles.text}>
                <Caption tone="muted">{[m.barName, when].filter(Boolean).join(' · ')}</Caption>
                <Headline numberOfLines={2}>{m.name}</Headline>
                <Tag label={access} tone="outline" icon={m.openSpecs ? 'lock.open.fill' : 'lock.fill'} />
                {make ? <Caption style={styles.make}>{make}</Caption> : null}
              </View>
            </PressableScale>
          );
        })}
      </CardGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  note: { marginBottom: space.sm },
  card: { flexDirection: 'row', gap: space.md, padding: space.sm + 2, borderRadius: radius.card },
  cover: { width: 96, height: 116, borderRadius: radius.control, borderWidth: 1, padding: space.sm, justifyContent: 'space-between' },
  short: { letterSpacing: 1 },
  text: { flex: 1, minWidth: 0, gap: space.xs, paddingVertical: space.xs },
  make: { marginTop: 'auto' },
});
