import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';
import { NOTE_KINDS, noteKind, noteWord } from '@/lib/flavor';

import { DiscoverOverlay } from './DiscoverOverlay';

export { DiscoverOverlay } from './DiscoverOverlay';

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));
const GROUPS = [
  { title: 'Style', items: STYLES },
  { title: 'Spirit', items: SPIRITS },
  { title: 'Tastes', items: NOTES },
] as const;

export interface FiltersSheetProps {
  kinds: readonly string[];
  onChange: (kinds: string[]) => void;
  /** Bars with matching drinks, null while loading. */
  bars: number | null;
  /** Closed bars in the area, and whether they're shown. */
  closed: { count: number; shown: boolean; onShow: (on: boolean) => void };
  /** Drinks from past menus: off, the list is only what's on a menu now. */
  past: { shown: boolean; onShow: (on: boolean) => void };
  /** "Not had yet": hide the drinks you've had or ranked. Signed in only. */
  notHad?: { shown: boolean; onShow: (on: boolean) => void };
  onClose: () => void;
}

/** Styles, spirits and tastes, several at once, past menus and closed bars, and what you haven't had: the filters, wherever they're shown. */
export function FilterGroups({ kinds, onChange, closed, past, notHad }: Pick<FiltersSheetProps, 'kinds' | 'onChange' | 'closed' | 'past' | 'notHad'>) {
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  return (
    <>
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Caption tone="muted">{g.title}</Caption>
          <View role="group" accessibilityLabel={g.title} style={styles.chips}>
            {g.items.map((k) => (
              <Chip key={k.id} multi quiet label={k.label} selected={kinds.includes(k.id)} onPress={() => toggle(k.id)} />
            ))}
          </View>
        </View>
      ))}
      <Caption tone="muted">Drinks match any pick within a group and every group you pick from.</Caption>
      <View style={styles.group}>
        <Caption tone="muted">History</Caption>
        <View style={styles.chips}>
          <Chip multi quiet label="Past menus" selected={past.shown} onPress={() => past.onShow(!past.shown)} />
          <Chip multi quiet label={closed.count ? `Closed bars · ${closed.count}` : 'Closed bars'} selected={closed.shown} onPress={() => closed.onShow(!closed.shown)} />
        </View>
        <Caption tone="muted">Drinks bars no longer pour, and bars that have shut, kept for their history. Search finds them either way.</Caption>
      </View>
      {notHad ? (
        <View style={styles.group}>
          <Caption tone="muted">You</Caption>
          <View style={styles.chips}>
            <Chip multi quiet label="Not had yet" selected={notHad.shown} onPress={() => notHad.onShow(!notHad.shown)} />
          </View>
          <Caption tone="muted">Hides the drinks you’ve had or ranked. Catch them all.</Caption>
        </View>
      ) : null}
    </>
  );
}

/** The filters on their own, from the Filters button. The list and map behind update as you tap; Clear, and "Show 12 bars" to close. */
export function FiltersSheet(props: FiltersSheetProps) {
  const { onChange, closed, past, notHad, bars, onClose } = props;
  return (
    <DiscoverOverlay
      label="Filters"
      onClose={onClose}
      action={<Button label="Clear" variant="ghost" onPress={() => (onChange([]), closed.onShow(false), past.onShow(false), notHad?.onShow(false))} />}
      footer={<Button label={bars === null ? 'Show bars' : `Show ${bars} ${bars === 1 ? 'bar' : 'bars'}`} onPress={onClose} />}
    >
      <FilterGroups {...props} />
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
