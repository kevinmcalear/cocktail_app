import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { KIND_LABEL, READ_KIND_ORDER, type ReadKind } from '@/lib/bringIn';
import { useBringIn } from '@/store/useBringIn';

const HINT: Record<ReadKind, string> = {
  menu: 'Drinks by name, with prices: a menu to make',
  recipes: 'Measured specs: drinks to save',
  bottles: 'Bottles to put on the shelf',
};

/**
 * "Reading as: Menu ⌄": what Bring in took it to be, and a way to say it's
 * something else. Pasted text is read again on the phone; a photo goes back
 * to the reader as the kind you chose.
 */
export function ReadingAsChip({ kind }: { kind: ReadKind | null }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const job = useBringIn((s) => s.job);
  const readAs = useBringIn((s) => s.readAs);
  const label = kind ? KIND_LABEL[kind] : 'Working it out';
  return (
    <>
      <PressableScale
        role="button"
        accessibilityLabel={`Reading as: ${label}. Change`}
        onPress={() => setOpen(true)}
        style={[styles.chip, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }]}
      >
        <DsText variant="caption" numberOfLines={1}>{`Reading as: ${label}`}</DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>
      {open ? (
        <MenuSheet visible onClose={() => setOpen(false)} title="Read it as" subtitle={job?.local ? 'Read again on your phone.' : 'Read again by AI, as what you pick.'}>
          <View>
            {READ_KIND_ORDER.map((k) => (
              <PressableScale
                key={k}
                role="radio"
                aria-checked={k === kind}
                accessibilityLabel={`${KIND_LABEL[k]}. ${HINT[k]}`}
                onPress={() => {
                  setOpen(false);
                  if (k !== kind) readAs(k);
                }}
                style={[styles.option, { borderBottomColor: ds.c.line }]}
              >
                <View style={styles.flex}>
                  <Body>{KIND_LABEL[k]}</Body>
                  <Caption tone="muted">{HINT[k]}</Caption>
                </View>
                {k === kind ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
              </PressableScale>
            ))}
          </View>
        </MenuSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, flexShrink: 1 },
  option: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
