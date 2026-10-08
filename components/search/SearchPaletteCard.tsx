import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DiscoverOverlay } from '@/components/screens/home/DiscoverSheet';
import { useSearchMine } from '@/hooks/useSearchMine';
import type { SearchScope } from '@/lib/searchScope';
import { useSearchPalette } from '@/store/useSearchPalette';

import { SearchBody, SearchHead } from './SearchPanel';

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
      <SearchBody query={query} scope={scope} onScope={setScope} mine={mine} onJump={close} />
    </DiscoverOverlay>
  );
}
