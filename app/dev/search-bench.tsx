import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { runSearchBench, type BenchResult } from '@/lib/specSearchBench';

/**
 * Times the spec book search (lib/specSearch.ts) on this device's JS engine:
 * a 1,000 and a 3,000 drink venue typed letter by letter. The budget is 8 ms
 * per letter at p95 (Quality bar B6). Results also go to the log. Hidden,
 * like /dev/gallery.
 */
export default function SearchBench() {
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<BenchResult[] | null>(null);
  useEffect(() => {
    // After the first paint, so the screen shows before the run holds the thread.
    const id = setTimeout(() => {
      const runs = [runSearchBench(1000, () => performance.now()), runSearchBench(3000, () => performance.now())];
      console.log('search-bench', JSON.stringify(runs));
      setResults(runs);
    }, 500);
    return () => clearTimeout(id);
  }, []);
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Caption>{results ? 'Search timings, ms' : 'Timing search…'}</Caption>
      {results?.map((r) => (
        <Caption key={r.docs} testID={`bench-${r.docs}`}>
          {`${r.docs} items: build ${r.buildMs}; per letter p50 ${r.keystroke.p50}, p95 ${r.keystroke.p95}, max ${r.keystroke.max}; near p50 ${r.near.p50}, p95 ${r.near.p95}, max ${r.near.max}`}
        </Caption>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.md } });
