import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, dragDismissesKeyboard, DrinkImage, Field, Headline, PressableScale, SheetScrollView, useDs } from '@/components/ds';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { withAlpha } from '@/lib/color';
import { cannotAdd, filterLibrary, groupLibrary, libraryNote, nameToMake, nearLibrary, type EditSection } from '@/lib/menuLayout';
import { sectionRule } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MakeFromSearch, useMakeDrink } from './MakeFromSearch';
import { Choice, MenuSheet, menuSheetBody } from './MenuSheet';
import { MonoLabel } from './ReviewParts';

interface AddDrinkSheetProps {
  section: EditSection | null;
  /** The menu's venue, so a drink made from here is the venue's (null: a personal menu). */
  barId: string | null;
  onClose: () => void;
  library: MenuDrink[];
  /** What your shelf makes, by drink id: "You can make these" (none at a venue). */
  canMake: readonly string[];
  /** Which other menu each drink is on (on now or coming up), by drink id. */
  elsewhere: Record<string, string>;
  onAdd: (drink: MenuDrink) => void;
}

/** One drink in the library, with what adding it would do. */
export function LibraryRow({ drink, note, added, onAdd }: { drink: MenuDrink; note: string; added: boolean; onAdd?: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.thumb}>
        <DrinkImage thumb sketchDetail="thumb" source={drink.imageUrl} generated={drink.isSketch} glass={drink.glass} itemId={drink.id} accessibilityLabel={drink.name} radius="control" />
      </View>
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{drink.name}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {note}
        </Caption>
      </View>
      {added ? (
        <View accessible role="img" accessibilityLabel="Added" style={[styles.add, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
          <IconSymbol name="checkmark" size={18} color={ds.accentText} />
        </View>
      ) : onAdd ? (
        <PressableScale accessibilityLabel={`Add ${drink.name}`} onPress={onAdd} style={[styles.add, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="plus" size={18} color={ds.c.ink} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A group's name over its drinks in the library. */
export function LibraryGroupHead({ title }: { title: string }) {
  return title ? (
    <View role="heading" style={styles.groupHead}>
      <MonoLabel>{title}</MonoLabel>
    </View>
  ) : null;
}

export function AddDrinkSheet({ section, barId, onClose, library, canMake, elsewhere, onAdd }: AddDrinkSheetProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  // All, only what's already in this section (to look back over what's picked), or only drinks on no other menu.
  const [show, setShow] = useState<'all' | 'in' | 'free'>('all');
  const make = useMakeDrink(section, barId);
  const where = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? null;
  if (!section) return null;
  // The filter only means something when another menu has drinks on it (Q13, 26 Oct 2026).
  const shared = Object.keys(elsewhere).length > 0;
  const picked = section.drinks.length;
  const inOnly = show === 'in' && picked > 0;
  const found = filterLibrary(inOnly ? section.drinks : library, section, query, show === 'free' && shared, elsewhere);
  // Not there? Make it from the same search, close names under it (dm-decided).
  const missing = inOnly ? null : nameToMake(library, query);
  const drinks = found.length || inOnly ? found : nearLibrary(library, section, query);
  const makeIt = (name: string | null) => {
    onClose();
    make(name);
  };
  const kind = section.allowedTypes[0] ?? 'cocktail';

  return (
    <MenuSheet
      visible
      list
      onClose={onClose}
      title={`Add to ${section.name}`}
      subtitle={sectionRule(section)}
      // Picks land as they're tapped, so closing keeps them: a tick, not an X (tf-075).
      done
    >
      {/* Only the rows in view are drawn: a library can be hundreds of sketched drinks. */}
      <SectionList
        sections={groupLibrary(drinks, canMake, query)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: g }) => <LibraryGroupHead title={g.title} />}
        keyExtractor={(d) => d.id}
        extraData={section}
        renderScrollComponent={(p) => <SheetScrollView {...p} />}
        {...dragDismissesKeyboard}
        contentContainerStyle={menuSheetBody}
        initialNumToRender={12}
        windowSize={DRAWN_LIST_WINDOW}
        ListHeaderComponent={
          <View style={styles.head}>
            <Field label="Search" hideLabel value={query} onChangeText={setQuery} placeholder="Search drinks, or type a new name" autoCapitalize="none" onSubmitEditing={() => (missing ? makeIt(missing) : undefined)} />
            {/* How many are picked, and a tap to see just those again (tf-073). */}
            {shared || picked ? (
              <View role="radiogroup" accessibilityLabel="Show" style={styles.filters}>
                <Choice label="All" pill="accent" selected={show === 'all' || (show === 'in' && !picked)} onPress={() => setShow('all')} />
                {picked ? <Choice label={`In ${section.name} · ${picked}`} pill="accent" selected={inOnly} onPress={() => setShow('in')} /> : null}
                {shared ? <Choice label="Not on another menu" pill="accent" selected={show === 'free'} onPress={() => setShow('free')} /> : null}
              </View>
            ) : null}
            {missing ? (
              <MakeFromSearch
                phone
                name={missing}
                section={section}
                where={where}
                onMake={() => makeIt(missing)}
                onBringIn={() => {
                  onClose();
                  router.push('/bring-in' as Href);
                }}
              />
            ) : null}
            {missing && drinks.length ? <Caption tone="muted">CLOSE</Caption> : null}
          </View>
        }
        ListEmptyComponent={missing ? undefined : <Body tone="muted">{query ? `Nothing called “${query}” ${inOnly ? `in ${section.name}` : `that fits ${section.name}`}.` : `No drinks that fit ${section.name} yet.`}</Body>}
        // At the end of the list, not pinned under it, so the results get the room (tf-072). A typed name has its own Make above.
        ListFooterComponent={
          missing ? undefined : (
            <View style={styles.make}>
              {/* The editor puts it in this section once it's saved (useLayoutEditor). */}
              <Button label={`Create a new ${kind === 'cocktail' ? 'drink' : kind}`} icon="plus" variant="secondary" onPress={() => makeIt(null)} />
              <Caption tone="muted" align="center">
                Once it’s saved, it goes in {section.name}.
              </Caption>
            </View>
          )
        }
        renderItem={({ item: d }) => <LibraryRow drink={d} note={libraryNote(d, section, elsewhere)} added={!!cannotAdd(section, d)} onAdd={() => onAdd(d)} />}
      />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md },
  groupHead: { paddingTop: space.lg, paddingBottom: space.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  make: { gap: space.sm, paddingTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 48 },
  flex: { flex: 1, gap: 2 },
  add: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
