import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverSheet';
import { useSearchMine } from '@/hooks/useSearchMine';
import { eightBallLabel } from '@/lib/eightBallKey';
import { isApplePlatform } from '@/lib/platformKeys';
import { space } from '@/constants/tokens';
import { scopeOptions, type SearchScope } from '@/lib/searchScope';
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
  const setOpen = useSearchPalette((s) => s.setOpen);
  const mine = useSearchMine();
  const [query, setQuery] = useState('');
  const [picked, setScope] = useState<SearchScope | null>(null);
  const scope = picked ?? mine.defaultScope;
  const close = () => setOpen(false);
  // The arrow, Tab and Return keys are the web's (searchNav.tsx); a native iPad gets Done and no key hints.
  const keys = Platform.OS === 'web';
  // The eight ball, the Easter egg phones open with a shake. Here it's a command, always in the list (as the
  // palette board draws it, typed or not), plus its key anywhere (WebSideNav).
  const pick = (
    <ResultGroup
      label="Commands"
      items={[0]}
      render={() => (
        <ResultRow
          key="pick"
          title="Pick for me"
          caption="A drink to make, at random"
          icon="8.circle"
          trailing={keys ? <PickKeys /> : undefined}
          onPress={() => {
            close();
            useEightBallStore.getState().setOpen(true);
          }}
        />
      )}
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
  // The highlighted drink's spec, beside the results (nav-search-desk-preview).
  const previews = useSearchPreviews();

  return (
    <DiscoverOverlay
      label="Search"
      full
      onClose={close}
      head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} autoFocus onDone={close} onSubmit={() => void nav.open()} keys={keys} />}
      footer={keys ? <KeyHints back={mine.venueId ? 'Back' : 'Close'} /> : undefined}
      aside={<SearchPreview item={previews.preview(nav.active)} onOpen={() => void nav.open()} />}
    >
      <SearchNavProvider active={nav.active} register={previews.register}>
        <View nativeID={RESULTS} style={styles.results}>
          <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} onJump={close} commands={pick} palette />
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

/** "↑↓ Select · ↵ Open · tab Switch scope · esc Back": the palette's keys, along its foot. */
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
      accessibilityLabel="Up and down arrows select, Return opens, Tab switches scope, Escape closes"
      style={[styles.hints, { marginHorizontal: -gutter, paddingHorizontal: gutter, borderTopColor: ds.c.line }]}
    >
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
  // A line across the card above the keys, as drawn.
  hints: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  push: { flex: 1 },
});
