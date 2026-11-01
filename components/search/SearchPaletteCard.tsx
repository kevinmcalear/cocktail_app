import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverOverlay';
import { space } from '@/constants/tokens';
import { useSearchFrom } from '@/hooks/useSearchFrom';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { City } from '@/lib/discover';
import { eightBallLabel } from '@/lib/eightBallKey';
import { isApplePlatform } from '@/lib/platformKeys';
import { startScope, type SearchScope } from '@/lib/searchScope';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

import { LEAD, PaletteDo, PaletteResults, PaletteRow } from './PaletteResults';
import { KeyCap } from './SearchField';
import { SearchNavProvider, useSearchNav } from './searchNav';
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
  // The arrow and Return keys are the web's (searchNav.tsx); a native iPad gets Done and no key caps.
  const keys = Platform.OS === 'web';
  // A style or a city the search names lands on Discover, as the search tab's do.
  const toDiscover = () => (close(), router.navigate('/discover'));
  const lent = area && { ...area, onKind: (k: string) => (area.onKind(k), toDiscover()), onPlace: (c: City) => (area.onPlace(c), toDiscover()) };
  const q = query.trim();
  // Before typing: Pick for me, the Easter egg phones open with a shake, with its keys (WebSideNav).
  const pick = (
    <View role="list">
      <PaletteRow
        icon="8.circle"
        title="Pick for me"
        aside="A drink to make, at random"
        onPress={() => {
          close();
          useEightBallStore.getState().setOpen(true);
        }}
      />
      {keys ? <PickKeys /> : null}
    </View>
  );

  const pathname = usePathname();
  const fromPath = useRef(pathname);
  useEffect(() => {
    if (pathname === fromPath.current) return;
    // A /search link opens the palette as it steps back off the /search page (SearchScreen.tsx HandOff): that move keeps it.
    if (fromPath.current === '/search') fromPath.current = pathname;
    else setOpen(false);
  }, [pathname, setOpen]);

  // ↑↓ move the highlight (Log a batch or Go to leads), Return opens it.
  const nav = useSearchNav(RESULTS, `${scope}|${query}`, LEAD);

  return (
    <DiscoverOverlay
      label="Search or add"
      full
      onClose={close}
      head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} area={lent} autoFocus onDone={close} onSubmit={() => void nav.open()} keys={keys} />}
    >
      <SearchNavProvider active={nav.active}>
        <View nativeID={RESULTS} style={styles.results}>
          {q && scope === 'mine' ? (
            <PaletteResults query={query} mine={mine} onEverywhere={() => setScope('everywhere')} />
          ) : (
            <>
              <PaletteDo query={query} mine={mine} />
              <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} area={lent} onJump={close} commands={q ? undefined : pick} palette />
            </>
          )}
        </View>
      </SearchNavProvider>
    </DiscoverOverlay>
  );
}

/** "⇧⌘8 on the web, ⌘8 in the desktop app": Pick for me's keys, under its row. */
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

const styles = StyleSheet.create({
  results: { gap: space.lg },
  hint: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingLeft: space.xl + space.xs },
});
