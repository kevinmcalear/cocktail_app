import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverSheet';
import { space } from '@/constants/tokens';
import { useSearchFrom } from '@/hooks/useSearchFrom';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { City } from '@/lib/discover';
import { eightBallLabel } from '@/lib/eightBallKey';
import { newDrinkHref } from '@/lib/itemRoutes';
import { isApplePlatform } from '@/lib/platformKeys';
import { scopeOptions, startScope, type SearchScope } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

import { ResultGroup, ResultRow } from './ResultRows';
import { KeyCap } from './SearchField';
import { SearchNavProvider, useSearchNav, useSearchPreviews } from './searchNav';
import { SearchPreview } from './SearchPreview';
import { SearchBody, SearchHead } from './SearchPanel';

/** The view holding the palette's results, which the arrow keys walk. */
const RESULTS = 'search-palette-results';

/** The open ⌘K search card; SearchPalette loads it on first open. */
export default function SearchPaletteCard() {
  return (
    <VenueBrandProvider>
      <Palette />
    </VenueBrandProvider>
  );
}

function Palette() {
  const router = useRouter();
  const setOpen = useSearchPalette((s) => s.setOpen);
  const mine = useSearchMine();
  // What the door carried in (Library's "Search everywhere for “neg”"), read as it opens.
  const [opened] = useState(() => useSearchPalette.getState().start);
  const [query, setQuery] = useState(opened.query);
  const [picked, setScope] = useState<SearchScope | null>(opened.scope);
  // Discover's area while Discover is open (hooks/useSearchFrom.ts): This area, as phones have it.
  const { from, area } = useSearchFrom();
  const start = startScope(from, mine.defaultScope, !!area?.label);
  const scope = picked === 'area' && !area?.label ? start : (picked ?? start);
  const close = () => setOpen(false);
  // The arrow, Tab and Return keys are the web's (searchNav.tsx); a native iPad gets Done and no key hints.
  const keys = Platform.OS === 'web';
  // A style or a city the search names lands on Discover, as the search tab's do.
  const toDiscover = () => (close(), router.navigate('/discover'));
  const lent = area && { ...area, onKind: (k: string) => (area.onKind(k), toDiscover()), onPlace: (c: City) => (area.onPlace(c), toDiscover()) };
  const q = query.trim();
  // The palette's own rows (nav-search-desk-preview): a new drink with what's typed (N is New's key), and the eight ball,
  // the Easter egg phones open with a shake, always in the list plus its key anywhere (WebSideNav).
  const commands = (
    <ResultGroup
      label="Commands"
      items={q && mine.canAdd ? ['new', 'pick'] : ['pick']}
      render={(c) =>
        c === 'new' ? (
          <ResultRow key="new" title={`New drink called “${capitalize(q)}”`} icon="plus" accentIcon trailing={keys ? <KeyCap label="N" /> : undefined} onPress={() => router.push(newDrinkHref(capitalize(q), mine.venueId) as never)} />
        ) : (
          <ResultRow
            key="pick"
            title="Pick for me"
            caption="A drink to make, at random"
            icon="8.circle"
            accentIcon
            trailing={keys ? <PickKeys /> : undefined}
            onPress={() => {
              close();
              useEightBallStore.getState().setOpen(true);
            }}
          />
        )
      }
    />
  );

  const pathname = usePathname();
  const fromPath = useRef(pathname);
  useEffect(() => {
    if (pathname === fromPath.current) return;
    // A /search link opens the palette as it moves to the first tab (app/(tabs)/search): that move keeps it.
    if (fromPath.current === '/search') fromPath.current = pathname;
    else setOpen(false);
  }, [pathname, setOpen]);

  // ↑↓ move the highlight (the top row leads), Return opens it, Tab moves to the next place.
  const scopes = scopeOptions(mine.label, area?.label ?? null).map((o) => o.value);
  const nav = useSearchNav(RESULTS, `${scope}|${query}`, () => setScope(scopes[(scopes.indexOf(scope) + 1) % scopes.length]));
  // The highlighted drink's spec, beside the results (nav-search-desk-preview).
  const previews = useSearchPreviews();

  return (
    <DiscoverOverlay
      label="Search"
      full
      onClose={close}
      head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} area={lent} autoFocus onDone={close} onSubmit={() => void nav.open()} keys={keys} />}
      footer={keys ? <KeyHints back={mine.venueId ? 'Back' : 'Close'} /> : undefined}
      aside={<SearchPreview item={previews.preview(nav.active)} onOpen={() => void nav.open()} />}
    >
      <SearchNavProvider active={nav.active} register={previews.register}>
        <View nativeID={RESULTS} style={styles.results}>
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={lent} onJump={close} commands={commands} palette />
        </View>
      </SearchNavProvider>
    </DiscoverOverlay>
  );
}

/** "⇧⌘8 on the web, ⌘8 in the desktop app": Pick for me's keys, at the end of its row. */
function PickKeys() {
  const apple = isApplePlatform();
  return (
    <View style={styles.hint}>
      <KeyCap label={eightBallLabel({ shift: true, apple })} />
      <Caption tone="muted">on the web,</Caption>
      <KeyCap label={eightBallLabel({ shift: false, apple })} />
      <Caption tone="muted">in the desktop app</Caption>
    </View>
  );
}

/** "↑↓ Select · ↵ Open · tab Switch place · esc Back": the palette's keys, along its foot. */
function KeyHints({ back }: { back: string }) {
  const ds = useDs();
  const gutter = useGutter();
  const hint = (key: string, words: string) => (
    <View key={key} style={styles.hint}>
      <KeyCap label={key} />
      <Caption tone="muted">{words}</Caption>
    </View>
  );
  return (
    <View
      role="note"
      accessibilityLabel="Up and down arrows select, Return opens, Tab switches place, Escape closes"
      style={[styles.hints, { marginHorizontal: -gutter, paddingHorizontal: gutter, borderTopColor: ds.c.line }]}
    >
      {hint('↑↓', 'Select')}
      {hint('↵', 'Open')}
      {hint('tab', 'Switch place')}
      <View style={styles.push} />
      {hint('esc', back)}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
  // A line across the card above the keys, as drawn.
  hints: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  push: { flex: 1 },
});
