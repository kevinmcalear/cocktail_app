import { useDeferredValue } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { layout, radius, space } from '@/constants/tokens';
import { useMakerSearch, type MakerRef } from '@/hooks/useMakers';

export type MakerPage = Pick<MakerRef, 'id' | 'display_name'>;

interface MakerFieldProps {
  label: string;
  /** The maker as typed. */
  value: string;
  /** The maker's page it links, or null. */
  page: MakerPage | null;
  /** Typing keeps the page only while the text is still its name. */
  onChange: (value: string, page: MakerPage | null) => void;
  /** Narrows the pages offered to makers that say they make this. */
  makes?: string;
  placeholder?: string;
  error?: string;
}

/**
 * Who makes something, in one field (tools-glassware-picked-phone): makers
 * with a page show under it as you type, and picking one links its page.
 * Typing something else unlinks it; what was typed is kept either way.
 */
export function MakerField({ label, value, page, onChange, makes, placeholder, error }: MakerFieldProps) {
  const ds = useDs();
  const term = useDeferredValue(page ? '' : value);
  const { data: makers = [] } = useMakerSearch(term, makes);
  const [offered, near] = splitNear(term.trim().length >= 2 ? makers : []);
  const row = (m: MakerRef, i: number) => (
    <PressableScale
      key={m.id}
      role="button"
      accessibilityLabel={`Link ${m.display_name}’s page`}
      onPress={() => onChange(m.display_name, m)}
      style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}
    >
      <Body numberOfLines={1} style={styles.flex}>
        {m.display_name}
      </Body>
      <Caption tone="muted">{`@${m.handle}`}</Caption>
    </PressableScale>
  );

  return (
    <View style={styles.stack}>
      <Field
        label={label}
        value={value}
        onChangeText={(text) => onChange(text, page && text.trim() === page.display_name ? page : null)}
        placeholder={placeholder}
        autoCorrect={false}
        maxLength={80}
        error={error}
      />
      {page ? (
        <View style={styles.linked}>
          <Caption tone="muted" style={styles.flex}>{`${page.display_name} · maker’s page`}</Caption>
          <Button label="Unlink" variant="ghost" onPress={() => onChange(value, null)} />
        </View>
      ) : offered.length || near.length ? (
        <>
          <View role="list" aria-label="Makers with a page" style={[styles.list, { backgroundColor: ds.c.surface }]}>
            {offered.map(row)}
            <NearPicks found={offered.length > 0} near={near} render={(m) => row(m, 1)} />
          </View>
          <Caption tone="muted">Pick a maker to link their page, or keep what you typed.</Caption>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs },
  linked: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { borderRadius: radius.control, borderCurve: 'continuous', paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  flex: { flex: 1, minWidth: 0 },
});
