import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { pickDrinkPhotos } from '@/components/drink/drinkImages';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { showMessage } from '@/lib/dialogs';
import { SWAP_LIMIT, SWAP_NAME_LIMIT, type Swap } from '@/lib/madeIt';

/**
 * What you changed, as drawn (board drink-sheet-made): each swap as a chip,
 * "Cynar → Amaro Montenegro", and "+ Add a change", which asks what you
 * changed and then what you used instead. Tap a chip to take it off.
 */
export function SwapChips({ names, swaps, onChange }: { names: string[]; swaps: Swap[]; onChange: (swaps: Swap[]) => void }) {
  const ds = useDs();
  const [adding, setAdding] = useState(false);
  const open = swaps.find((s) => !s.to.trim()) ?? null;
  const left = names.filter((n) => !swaps.some((s) => s.from === n));
  const setTo = (from: string, to: string) => onChange(swaps.map((x) => (x.from === from ? { ...x, to: to.slice(0, SWAP_NAME_LIMIT) } : x)));
  return (
    <View style={styles.block}>
      <View role="group" accessibilityLabel="What you changed" style={styles.wrap}>
        {swaps.map((s) => (
          <PressableScale key={s.from} role="button" accessibilityLabel={`${s.from} to ${s.to || 'something else'}. Remove this change`} onPress={() => onChange(swaps.filter((x) => x.from !== s.from))} style={[styles.swap, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
            <DsText color={ds.accentText}>{s.from}</DsText>
            <IconSymbol name="arrow.right" size={14} color={ds.accentText} />
            <DsText color={ds.accentText} style={styles.medium}>
              {s.to || '…'}
            </DsText>
          </PressableScale>
        ))}
        {swaps.length < SWAP_LIMIT && left.length && !adding && !open ? (
          <PressableScale role="button" accessibilityLabel="Add a change" onPress={() => setAdding(true)} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
            <IconSymbol name="plus" size={14} color={ds.c.ink} />
            <DsText style={styles.medium}>Add a change</DsText>
          </PressableScale>
        ) : null}
      </View>
      {adding ? (
        <View role="radiogroup" accessibilityLabel="What did you change?" style={styles.wrap}>
          {left.map((n) => (
            <Choice
              key={n}
              label={n}
              selected={false}
              onPress={() => {
                onChange([...swaps, { from: n, to: '' }]);
                setAdding(false);
              }}
            />
          ))}
        </View>
      ) : null}
      {open ? <Field label={`Instead of ${open.from}`} value={open.to} onChangeText={(t) => setTo(open.from, t)} placeholder="What you used" autoFocus /> : null}
    </View>
  );
}

/** When: Today, Yesterday, or Pick a day (which opens the date field). */
export function WhenChips({ date, today, yesterday, onDate, picking, onPick }: { date: string; today: string; yesterday: string; onDate: (d: string) => void; picking: boolean; onPick: () => void }) {
  return (
    <View style={styles.when}>
      <DsText style={styles.strong}>When</DsText>
      <View role="radiogroup" accessibilityLabel="When you made it" style={styles.wrap}>
        <Choice label="Today" selected={!picking && date === today} onPress={() => onDate(today)} />
        <Choice label="Yesterday" selected={!picking && date === yesterday} onPress={() => onDate(yesterday)} />
        <Choice label="Pick a day" selected={picking} onPress={onPick} />
      </View>
    </View>
  );
}

/** The dashed Photo tile beside the note; a picked photo fills it. */
export function PhotoTile({ uri, onUri }: { uri: string | null; onUri: (uri: string | null) => void }) {
  const ds = useDs();
  const pick = async () => {
    try {
      const [picked] = await pickDrinkPhotos();
      if (picked) onUri(picked);
    } catch {
      showMessage("Couldn't open your photos", 'Try again.');
    }
  };
  return (
    <PressableScale role="button" accessibilityLabel={uri ? 'Your photo. Tap to take it off' : 'Add a photo'} onPress={uri ? () => onUri(null) : () => void pick()} style={[styles.tile, { borderColor: ds.c.lineStrong }]}>
      {uri ? (
        <DrinkImage source={uri} accessibilityLabel="Your photo" aspectRatio={1} radius="control" />
      ) : (
        <>
          <IconSymbol name="camera" size={20} color={ds.c.muted} />
          <Caption tone="muted">Photo</Caption>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  swap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.md, borderRadius: radius.pill },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  medium: { fontFamily: fontFamilies.bodyMedium },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  when: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  tile: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', gap: space.xs, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden' },
});
