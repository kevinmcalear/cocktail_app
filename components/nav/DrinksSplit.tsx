import { StyleSheet, View } from 'react-native';

import { BreakpointOverride, useDs } from '@/components/ds';
import { layout } from '@/constants/tokens';

import { MountOnFocus } from './MountOnFocus';
import { LibraryBeside } from './RootLazy';

/**
 * Drinks' list on a desktop (hooks/useDrinksSplit.ts): a column beside the
 * Drinks stack, laid out as the tablet's list pane, so it keeps its scroll,
 * filters and search while drinks open beside it. `shown` is false while a
 * page other than a drink (Prep, Study) has the stack: that page takes the
 * width, and the list waits, hidden, for Back.
 */
export function DrinksList({ shown }: { shown: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.column, { borderRightColor: ds.c.line }, shown ? null : styles.hidden]}>
      <BreakpointOverride value="tablet">
        <MountOnFocus>
          <LibraryBeside />
        </MountOnFocus>
      </BreakpointOverride>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: layout.listPaneDesk, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth },
  hidden: { display: 'none' },
});
