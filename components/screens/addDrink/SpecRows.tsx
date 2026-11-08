import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Announcer } from '@/components/ds/DragList';
import { DragRow } from '@/components/ds/DragRow';
import { space } from '@/constants/tokens';
import type { PartEntry } from '@/lib/drinkParts';

/**
 * A spec's rows (useCombineDrop entries): each line, from `children` with its
 * index and its row, and in a drink made in parts each later part's `head`
 * (drink-edit-parts). A heading slides aside like a line while one is held,
 * but is never held itself.
 */
export function SpecRows({ entries, shift, onHeight, head, children }: { entries: readonly PartEntry[]; shift: (row: number) => number | null; onHeight: (e: PartEntry, h: number) => void; head: (part: number) => ReactNode; children: (line: number, row: number) => ReactNode }) {
  return (
    <Announcer>
      <View role="list" aria-label="In the drink">
        {entries.map((e, row) =>
          'part' in e ? (
            <DragRow key={`part:${e.part}`} index={row} onDrop={() => {}} shift={shift(row)} onHeight={(h) => onHeight(e, h)}>
              {() => <View style={styles.head}>{head(e.part)}</View>}
            </DragRow>
          ) : (
            children(e.line, row)
          )
        )}
      </View>
    </Announcer>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, paddingTop: space.sm },
});
