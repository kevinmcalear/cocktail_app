import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverSheet';
import { useSearchMine } from '@/hooks/useSearchMine';
import { isDesktopShell } from '@/lib/desktopShell';
import { eightBallLabel } from '@/lib/eightBallKey';
import { isApplePlatform } from '@/lib/platformKeys';
import type { SearchScope } from '@/lib/searchScope';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

import { ResultRow } from './ResultRows';
import { SearchBody, SearchHead } from './SearchPanel';

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

  return (
    <DiscoverOverlay
      label="Search"
      full
      onClose={close}
      head={<SearchHead query={query} onQuery={setQuery} scope={scope} onScope={setScope} mine={mine} autoFocus onDone={close} />}
    >
      {findsPick(query) ? pick : null}
      <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} onJump={close} commands={pick} />
    </DiscoverOverlay>
  );
}
