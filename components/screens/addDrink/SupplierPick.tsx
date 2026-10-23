import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { Monogram } from '@/components/screens/onboarding/SetupParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { SupplierPick as Pick } from '@/lib/suppliers';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Under a line on the desktop page (board make-create-desktop, step 7): who
 * brings it, as a chip that opens the pick under the line, and what this pour
 * costs. Without a chip (no Prep or Costs, or not a bottle), the words alone.
 */
export function LineSupplier({ line, supplier, price, open, onPress }: { line: string; supplier: string | null; price: string | null; open?: boolean; onPress?: () => void }) {
  const ds = useDs();
  if (!onPress) return supplier || price ? <Caption tone="muted" numberOfLines={1}>{[supplier, price].filter(Boolean).join(' · ')}</Caption> : null;
  return (
    <View style={styles.detail}>
      <PressableScale
        onPress={onPress}
        haptic={false}
        role="button"
        aria-expanded={!!open}
        accessibilityLabel={supplier ? `Who brings ${line}: ${supplier}. Change` : `Who brings ${line}? Pick a supplier`}
        style={[styles.chip, { borderColor: open ? ds.c.ink : ds.c.lineStrong }]}
      >
        <Caption tone={supplier ? 'ink' : 'muted'} numberOfLines={1}>{supplier ?? 'Who brings it?'}</Caption>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
      </PressableScale>
      {price ? <DsText variant="spec" color={ds.c.muted} style={styles.mono}>{price}</DsText> : null}
    </View>
  );
}

interface SupplierPickProps {
  line: string;
  venueName: string;
  pick: Pick;
  current: string | null;
  busy?: boolean;
  failed?: boolean;
  onPick: (supplier: { id: string } | { name: string }) => void;
}

/** The venue's suppliers under the line, the suggested one first; or a new one by name. Set once, every drink with it uses it. */
export function SupplierPickList({ line, venueName, pick, current, busy, failed, onPick }: SupplierPickProps) {
  const ds = useDs();
  const [adding, setAdding] = useState(!pick.choices.length);
  const [name, setName] = useState('');
  const add = () => name.trim() && onPick({ name: name.trim() });
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View role="radiogroup" aria-label={`Who brings ${line}`}>
        {pick.choices.map((c, i) => {
          const on = c.id === current;
          return (
            <PressableScale
              key={c.id}
              role="radio"
              aria-checked={on}
              disabled={busy}
              onPress={() => (on ? null : onPick({ id: c.id }))}
              accessibilityLabel={`${c.name}${c.id === pick.suggested && !on ? ', suggested' : ''}. ${c.sub}`}
              style={[styles.option, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null, on ? { backgroundColor: withAlpha(ds.accentText, 0.14) } : null]}
            >
              <Monogram name={c.name} size={30} plain />
              <View style={styles.flex}>
                <View style={styles.title}>
                  <Body numberOfLines={1}>{c.name}</Body>
                  {c.id === pick.suggested && !on ? <Tag label="suggested" tone="accent" /> : null}
                </View>
                <Caption tone="muted" numberOfLines={1}>{c.sub}</Caption>
              </View>
              {on ? <IconSymbol name="checkmark" size={16} color={ds.c.ink} /> : null}
            </PressableScale>
          );
        })}
      </View>
      <View style={[styles.foot, pick.choices.length ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
        {adding ? (
          <View style={styles.newRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={add}
              placeholder="A new supplier’s name"
              placeholderTextColor={ds.c.muted}
              aria-label="A new supplier’s name"
              autoFocus={!!pick.choices.length}
              maxLength={80}
              returnKeyType="done"
              style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink, borderColor: ds.c.lineStrong }, NO_OUTLINE]}
            />
            <Button label="Add" size="sm" disabled={!name.trim() || busy} onPress={add} accessibilityLabel={`Add ${name.trim() || 'the supplier'} as who brings ${line}`} />
          </View>
        ) : (
          <PressableScale onPress={() => setAdding(true)} role="button" accessibilityLabel="Add a new supplier" style={styles.link}>
            <Caption tone="accent">+ New supplier</Caption>
          </PressableScale>
        )}
        {pick.why && pick.suggested !== current ? <Caption tone="muted">{`Suggested because ${pick.why}.`}</Caption> : null}
        {failed ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : <Caption tone="muted">{`Set once for ${venueName}. Every drink with ${line} uses it.`}</Caption>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 28, maxWidth: 240, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.mono },
  card: { marginLeft: 40 + space.md, marginBottom: space.sm, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.md, paddingVertical: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  foot: { gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, minHeight: layout.minTapTarget, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md },
});
