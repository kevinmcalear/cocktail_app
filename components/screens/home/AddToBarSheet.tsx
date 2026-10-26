import { useRouter } from 'expo-router';
import { useDeferredValue, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, dragDismissesKeyboard, Field, FieldButton, GlassButton, IngredientThumb, SheetScrollView } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { MenuSheet, menuSheetBody } from '@/components/screens/menus/MenuSheet';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { space } from '@/constants/tokens';
import { useAddByName, useBarIdeas, useBarSearch, type FoundItem } from '@/hooks/useHomeBar';
import { useKit } from '@/hooks/useKit';
import { SECTIONS, type BarSection } from '@/lib/barSections';
import { itemHref } from '@/lib/itemRoutes';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { addedLine, becomesLine, dropKind, IDEAS, IDEAS_MORE, kindName, leftOutLine, NEW_SESSION, pick, shownHere, tick, type AddSession } from '@/lib/myBarAdd';
import { SHELF_SECTIONS } from '@/lib/myBarRows';
import { foundLine } from '@/lib/myBarText';

import { DoneFooter, IdeaTile, KitResults, RecipeLink, Result, SnapRow, TileLink, WaysOn } from './AddToBarParts';
import { SectionChips } from './BarSections';
import { TileGrid, useTileCols } from './BarTile';
import { WhichKind, WhichLink } from './WhichKind';

export type AddFilter = 'all' | BarSection | 'kit';

/** The line under the section filter, for each section. */
const BLURBS: Record<AddFilter, string> = {
  all: 'Tap what you keep. It goes in the right section of My Bar.',
  bottles: SECTIONS.bottles.blurb,
  fridge: 'Fruit, sugar, eggs and mixers. Most drinks need a few of these.',
  lab: SECTIONS.lab.blurb,
  preps: 'Syrups and cordials you make. Tap the ones in your fridge now, or open a recipe to make one.',
  kit: SECTIONS.kit.blurb,
};
/** The title says where it was opened. */
const TITLES: Record<AddFilter, string> = { all: 'Add to your bar', bottles: 'Add bottles', fridge: 'Add to the fridge', lab: 'Add to the lab', preps: 'Add house-made', kit: 'Add kit' };
const ORDER: BarSection[] = ['bottles', 'fridge', 'lab', 'preps'];

interface AddToBarSheetProps {
  visible: boolean;
  /** The tab it opens on, when a section's Add opened it. */
  filter: AddFilter;
  onFilter: (filter: AddFilter) => void;
  onShelf: ReadonlySet<string>;
  /** Styles you have a bottle of (Gin, for a Tanqueray): not offered either. */
  covered: ReadonlySet<string>;
  /** How much of each section is on the bar, for the tabs. */
  counts: Partial<Record<AddFilter, number>>;
  onAdd: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** Snap a bottle instead: the camera in the search field and under the results. */
  onSnap: () => void;
}

/**
 * One search for everything on your bar: bottles, fridge, lab, house preps
 * and kit. The sections are the same filter chips as My Bar's, one picked at
 * a time here; what's in them is picture tiles you tick, the same tiles as
 * My Bar. Typed results are listed under the section each goes in. Only what
 * isn't on your bar is offered, and a tick stays where it is until Done
 * (lib/myBarAdd.ts). A ticked style asks which bottle (WhichKind).
 */
export function AddToBarSheet({ visible, filter, onFilter, onShelf, covered, counts, onAdd, onRemove, onClose, onSnap }: AddToBarSheetProps) {
  const router = useRouter();
  const cols = useTileCols();
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Each opening starts fresh, titled for where it was opened.
  const [session, setSession] = useState<AddSession>(NEW_SESSION);
  const [which, setWhich] = useState<FoundItem | null>(null);
  const [from, setFrom] = useState(filter);
  // What was on the bar when it opened: what the subtitle says isn't shown.
  const [had, setHad] = useState(counts);
  const [open, setOpen] = useState(visible);
  if (visible !== open) {
    setOpen(visible);
    if (visible) {
      setSession(NEW_SESSION);
      setWhich(null);
      setFrom(filter);
      setHad(counts);
    }
  }
  const has = (id: string) => onShelf.has(id) || covered.has(id);
  const shown = (id: string) => shownHere(id, has, session);
  const byName = useAddByName();
  // On your bar now, kit included: what the footer counts.
  const kit = useKit().owned;
  const isOn = (id: string) => onShelf.has(id) || kit.includes(id);
  const typed = query.trim();
  const Name = typed.charAt(0).toUpperCase() + typed.slice(1);
  const found = useBarSearch(filter === 'kit' ? '' : query);
  const ideas = useBarIdeas(filter === 'kit' ? [] : [...IDEAS[filter], ...IDEAS_MORE[filter]]);
  // The first few you don't have; what you tick now keeps its place.
  const tiles = filter === 'kit' ? [] : (ideas.data ?? []).filter((i) => shown(i.id)).slice(0, IDEAS[filter].length);
  // Results for older text stay up while the new search runs, so only an empty list waits.
  const inTab = typed ? (found.data ?? []).filter((r) => filter === 'all' || r.section === filter) : [];
  const [rows, near] = splitNear(inTab.filter((r) => shown(r.id)));
  const left = leftOutLine(inTab.filter((r) => !shown(r.id) && !r.of).map((r) => r.name));
  // A kind typed ("gin"): the style, then its bottles by kind, then All gins.
  const kindOf = rows.find((r) => r.of)?.of;
  const kind = kindOf ? (found.data ?? []).find((r) => r.id === kindOf) : undefined;
  const groups = ORDER.flatMap((section) => {
    const items = rows.filter((r) => r.section === section && !r.of);
    return items.length || (kind && section === 'bottles') ? [{ section, items }] : [];
  });
  // The sheet answers the tap at once; its tiles render just after, in the
  // background (RAIL: a tap shows something within 100 ms).
  const filled = useDeferredValue(visible);
  // While typing, each chip counts its matches; otherwise what's on the bar.
  const all = typed && filter !== 'kit' ? (found.data ?? []).filter((r) => !r.near && shown(r.id)) : null;
  const chipCounts = all ? Object.fromEntries(ORDER.map((sec) => [sec, all.filter((r) => r.section === sec).length])) : counts;
  const total = all ? all.length : SHELF_SECTIONS.reduce((n, sec) => n + (counts[sec] ?? 0), 0);
  const here = filter === 'all' ? SHELF_SECTIONS.reduce((n, sec) => n + (had[sec] ?? 0), 0) : (had[filter] ?? 0);
  const snap = () => {
    onClose();
    onSnap();
  };
  const leave = (to: Parameters<typeof router.push>[0]) => {
    onClose();
    router.push(to);
  };
  const toggle = (item: { id: string; name: string }, on: boolean) => {
    // A style swapped for bottles, unticked: no gin after all, so they come off too.
    if (!on && session.picks[item.id]?.some((id) => onShelf.has(id))) {
      const r = dropKind(session, item.id, item.name);
      setSession(r.session);
      r.remove.filter((id) => onShelf.has(id)).forEach(onRemove);
      if (onShelf.has(item.id)) onRemove(item.id);
      return;
    }
    setSession((s) => tick(s, item.id, item.name, on));
    if (on) onAdd([item.id]);
    else onRemove(item.id);
  };
  const pickBottle = (k: FoundItem, bottle: FoundItem, on: boolean) => {
    const r = pick(session, k.id, bottle, on, onShelf.has(k.id));
    setSession(r.session);
    if (r.add.length) onAdd(r.add);
    r.remove.forEach(onRemove);
  };
  const swappedFor = (id: string) => (session.picks[id] ?? []).filter((b) => onShelf.has(b));
  const tileHas = (id: string) => onShelf.has(id) || swappedFor(id).length > 0;
  const result = (item: FoundItem) => (
    <Result
      key={item.id}
      name={item.name}
      sub={item.id === kind?.id ? `The style: any ${kindName(item.name)}` : foundLine(item)}
      query={typed}
      thumb={<IngredientThumb id={item.id} name={item.name} size={48} />}
      has={tileHas(item.id)}
      onToggle={(on) => toggle(item, on)}
      extra={item.section === 'preps' ? <RecipeLink name={item.name} onPress={() => leave(itemHref('Ingredient', item.id) as never)} /> : null}
    />
  );
  const ways = <WaysOn name={Name} adding={byName.isPending} onName={() => byName.mutate(typed, { onSuccess: (r) => setSession((s) => tick(s, r.id, r.name, true)) })} onMake={() => leave({ pathname: '/make-recipe', params: { name: Name, shelf: '1' } })} onSnap={snap} />;
  const line = (which && becomesLine(session, which, (id) => onShelf.has(id))) || addedLine(session, isOn);

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={TITLES[from]}
      subtitle={which || typed ? undefined : here ? `${here} on your bar, so they’re not shown here` : undefined}
      leading={which ? <GlassButton icon="chevron.left" accessibilityLabel="Back to the tiles" onPress={() => setWhich(null)} /> : undefined}
      footer={line ? <DoneFooter line={line} /> : undefined}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(searchRef)}
      list
    >
      {/* Its own body for Which gin?, so it opens at its top. ponytail: Back starts the tiles at their top too; keep their offset if a long grid makes that a bother. */}
      <SheetScrollView key={which?.id ?? 'tiles'} contentContainerStyle={menuSheetBody} {...dragDismissesKeyboard}>
        {which ? (
          <WhichKind kind={which} swapped={tileHas(which.id)} has={(id) => onShelf.has(id)} shown={shown} onPick={(b, on) => pickBottle(which, b, on)} />
        ) : (
          <>
            <Field
              ref={searchRef}
              label="Search everything"
              value={query}
              onChangeText={setQuery}
              placeholder="Gin, lemons, malic acid, a shaker…"
              icon="magnifyingglass"
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus={MODAL_AUTOFOCUS}
              returnKeyType="search"
              trailing={
                <>
                  {query ? <FieldButton icon="xmark.circle.fill" label="Clear search" onPress={() => setQuery('')} /> : null}
                  <FieldButton icon="camera.fill" label="Snap a bottle" onPress={snap} />
                </>
              }
            />
            <SectionChips sections={SHELF_SECTIONS} counts={chipCounts} total={total || undefined} picked={filter === 'all' ? [] : [filter]} onPick={onFilter} bleed={space.xl} />
            <View style={styles.results}>
              {typed ? null : <Body tone="muted">{BLURBS[filter]}</Body>}
              {typed && left && filter !== 'kit' ? <Body tone="muted">{left}</Body> : null}
              {!filled ? null : filter === 'kit' ? (
                <KitResults query={typed} cols={cols} shown={shown} onToggled={(id, name, on) => setSession((s) => tick(s, id, name, on))} />
              ) : !typed ? (
                <View style={styles.group}>
                  <Eyebrow>{filter === 'all' ? 'Most used in drinks' : `Common ${SECTIONS[filter].short.toLowerCase()}`}</Eyebrow>
                  <TileGrid cols={cols}>
                    {tiles.map((item) => {
                      const on = tileHas(item.id);
                      const swapped = swappedFor(item.id);
                      const tile = <IdeaTile key={item.id} item={item} has={on} meta={swapped.length ? session.ticked.filter(([id]) => swapped.includes(id)).map(([, n]) => n).join(', ') : undefined} onToggle={toggle} />;
                      const link =
                        item.section === 'preps' ? (
                          <RecipeLink name={item.name} onPress={() => leave(itemHref('Ingredient', item.id) as never)} />
                        ) : on && item.section === 'bottles' && item.role !== 'product' ? (
                          <WhichLink kind={item} onOpen={() => setWhich(item)} />
                        ) : null;
                      return link ? (
                        <View key={item.id}>
                          {tile}
                          {link}
                        </View>
                      ) : (
                        tile
                      );
                    })}
                  </TileGrid>
                </View>
              ) : found.error && !rows.length ? (
                <Body tone="muted">Couldn’t search right now. Check your connection and try again.</Body>
              ) : !rows.length && !near.length ? (
                found.isFetching || found.isPending ? (
                  <Body tone="muted">Looking…</Body>
                ) : (
                  <>
                    <Body tone="muted">{`Nothing called “${typed}” yet.${filter === 'all' ? '' : ' Try All.'}`}</Body>
                    {ways}
                    {byName.error ? <Body tone="muted">{byName.error.message || 'Couldn’t add it. Try again.'}</Body> : null}
                  </>
                )
              ) : (
                [
                  ...groups.map((g) => (
                    <View key={g.section}>
                      {filter === 'all' ? (
                        <View style={styles.heading}>
                          <Eyebrow>{SECTIONS[g.section].title}</Eyebrow>
                        </View>
                      ) : null}
                      {g.section === 'bottles' && kind ? (
                        <>
                          {shown(kind.id) ? result(kind) : null}
                          {rows.filter((r) => r.of).map(result)}
                          <TileLink label={`All ${kindName(kind.name, true)}`} a11y={`All ${kindName(kind.name, true)}: which ${kindName(kind.name)} you have`} onPress={() => setWhich(kind)} />
                        </>
                      ) : null}
                      {g.items.filter((r) => r.id !== kind?.id).map(result)}
                    </View>
                  )),
                  <NearPicks key="near" found={rows.length > 0} near={near} render={result} labelStyle={styles.heading}>
                    {rows.length ? <SnapRow onSnap={snap} /> : ways}
                  </NearPicks>,
                ]
              )}
            </View>
          </>
        )}
      </SheetScrollView>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  // Holds the sheet's height steady while results come and go.
  results: { minHeight: 320, gap: space.md },
  group: { gap: space.sm },
  heading: { paddingTop: space.md },
});
