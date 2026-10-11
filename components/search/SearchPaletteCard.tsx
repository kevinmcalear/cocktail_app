import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverSheet';
import { useSearchMine } from '@/hooks/useSearchMine';
import { isDesktopShell } from '@/lib/desktopShell';
import { eightBallLabel } from '@/lib/eightBallKey';
import { isApplePlatform } from '@/lib/platformKeys';
import { space } from '@/constants/tokens';
import { scopeOptions, type SearchScope } from '@/lib/searchScope';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

import { ResultRow } from './ResultRows';
import { KeyCap } from './SearchField';
import { SearchNavProvider, useSearchNav } from './searchNav';
import { SearchBody, SearchHead } from './SearchPanel';

/** The view holding the palette's results, which the arrow keys walk. */
const RESULTS = 'search-palette-results';

/** What finds Pick for me when typed: the start of any of these. */
const PICK_WORDS = ['pick for me', 'eight ball', '8 ball', 'magic eight ball', 'random drink', 'surprise me'];
const findsPick = (query: string) => {
  const q = query.trim().toLowerCase();
  return q.length > 1 && PICK_WORDS.some((w) => w.startsWith(q));
};

/** The open ⌘K search card; SearchPalette loads it on first open. */
export default function SearchPaletteCard() {
  return (
    <VenueBrandProvider>
      <Palette />
    </VenueBrandProvider>
  );
}

function Palette() {
  const setOpen = useSearchPalette((s) => s.setOpen);
  const mine = useSearchMine();
  const [query, setQuery] = useState('');
  const [picked, setScope] = useState<SearchScope | null>(null);
  const scope = picked ?? mine.defaultScope;
  const close = () => setOpen(false);
  // The eight ball, the Easter egg phones open with a shake. Here it's a command, plus its key anywhere (WebSideNav).
  const pick = (
    <ResultRow
      title="Pick for me"
      caption={`The magic eight ball picks a drink · ${eightBallLabel({ shift: !isDesktopShell(), apple: isApplePlatform() })}`}
      icon="sparkles"
      onPress={() => {
        close();
        useEightBallStore.getState().setOpen(true);
      }}
    />
  );

  const pathname = usePathname();
  const from = useRef(pathname);
  useEffect(() => {
    if (pathname !== from.current) setOpen(false);
  }, [pathname, setOpen]);

  // ↑↓ move the highlight (the top row leads), Return opens it, Tab switches where it looks.
  const scopes = scopeOptions(mine.label, null).map((o) => o.value);
  const nav = useSearchNav(RESULTS, `${scope}|${query}`, () => setScope(scopes[(scopes.indexOf(scope) + 1) % scopes.length]));

  return (
    <DiscoverOverlay
      label="Search"
      full
      onClose={close}
      head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} autoFocus onDone={close} onSubmit={() => void nav.open()} keys />}
      footer={<KeyHints back={mine.venueId ? 'Back' : 'Close'} />}
    >
      <SearchNavProvider active={nav.active}>
        <View nativeID={RESULTS} style={styles.results}>
          {findsPick(query) ? pick : null}
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} onJump={close} commands={pick} />
        </View>
      </SearchNavProvider>
    </DiscoverOverlay>
  );
}

/** "↑↓ Select · ↵ Open · tab Switch scope · esc Back": the palette's keys, along its foot. */
function KeyHints({ back }: { back: string }) {
  const hint = (key: string, words: string) => (
    <View key={key} style={styles.hint}>
      <KeyCap label={key} />
      <Caption tone="muted">{words}</Caption>
    </View>
  );
  return (
    <View role="note" accessibilityLabel="Up and down arrows select, Return opens, Tab switches scope, Escape closes" style={styles.hints}>
      {hint('↑↓', 'Select')}
      {hint('↵', 'Open')}
      {hint('tab', 'Switch scope')}
      <View style={styles.push} />
      {hint('esc', back)}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
  hints: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  push: { flex: 1 },
});
