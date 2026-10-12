import { Fragment, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, useDs, useGutter } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { fontFamilies, radius, space, type as typeScale } from '@/constants/tokens';
import type { DrinkToMake, MenuRowToSave } from '@/hooks/useBringInSave';
import { isPrepName } from '@/lib/bringIn';
import { menuDrinkDraft } from '@/lib/bringInDraft';
import { menuRows, type MatchData } from '@/lib/bringInMatch';
import { withAlpha } from '@/lib/color';
import type { AnythingReading, ReadFile } from '@/lib/readAnything';

import { CheckFooter, CheckTop, MonoLabel } from './CheckParts';
import { MenuLine, SkippedMenuLine } from './MenuCheckRows';

function Pill({ label, tone }: { label: string; tone: 'have' | 'new' | 'pick' }) {
  const ds = useDs();
  const look =
    tone === 'new'
      ? { backgroundColor: withAlpha(ds.accentText, 0.1), borderColor: withAlpha(ds.accentText, 0.6), borderStyle: 'dashed' as const }
      : { backgroundColor: tone === 'pick' ? ds.c.raised : ds.c.surface, borderColor: tone === 'pick' ? ds.c.lineStrong : ds.c.line };
  return (
    <View style={[styles.pill, look]}>
      <Caption tone={tone === 'new' ? 'accent' : 'ink'}>{label}</Caption>
    </View>
  );
}

interface MenuCheckProps {
  reading: AnythingReading;
  files: ReadFile[];
  data: MatchData;
  /** A name given before reading (New menu); else the one printed. */
  name: string | null;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: { name: string; rows: MenuRowToSave[]; prices: { id: string; price: string }[] }) => void;
}

/**
 * The menu check (canvas make-bringin-menu): an editable name, counts by
 * state, the drinks in their printed sections with the printed line beside
 * each and the price at the end. New drinks are made with the menu, their
 * printed ingredients matched; food is kept as skipped, with Bring back.
 */
export function MenuCheck({ reading, files, data, name: given, saving, error, onCancel, onSave }: MenuCheckProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(() => given || reading.menu?.title || 'New menu');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<Record<string, boolean>>({});
  const [back, setBack] = useState<number[]>([]);
  const [matchOf, setMatchOf] = useState<string | null>(null);

  // Lines brought back join the last section, as a drink to match like any other.
  const withBack = useMemo<AnythingReading>(() => {
    const sections = reading.menu?.sections ?? [];
    const extra = back.map((i) => reading.skipped![i]).map((l) => ({ name: l.name, price: l.price, ingredients: [], at: l.at }));
    if (!extra.length) return reading;
    const lastIndex = Math.max(0, sections.length - 1);
    const next = sections.length ? sections.map((s, i) => (i === lastIndex ? { ...s, lines: [...s.lines, ...extra] } : s)) : [{ name: null, lines: extra }];
    return { ...reading, menu: { title: reading.menu?.title ?? null, sections: next } };
  }, [reading, back]);
  const rows = menuRows(withBack, data.library, picks);
  const isNew = (r: (typeof rows)[number]) => r.status === 'missing' || (r.status === 'add' && fresh[r.key]);
  const have = rows.filter((r) => r.status === 'add' && !fresh[r.key]).length;
  const made = rows.filter(isNew).length;
  const open = rows.filter((r) => r.status === 'pick');
  const skipped = (reading.skipped ?? []).map((line, i) => ({ line, i })).filter(({ i }) => !back.includes(i));

  const save = () => {
    const out: MenuRowToSave[] = [];
    for (const r of rows) {
      if (isNew(r)) {
        const drinkName = r.status === 'add' ? r.drink.name : r.status === 'missing' ? r.name : '';
        const make: DrinkToMake = { draft: menuDrinkDraft(drinkName, r.ingredients, data), prepNames: r.ingredients.filter(isPrepName) };
        out.push({ section: r.section, make, price: r.printed });
      } else if (r.status === 'add') out.push({ section: r.section, drink: r.drink });
    }
    const prices = rows.flatMap((r) => (r.status === 'add' && !fresh[r.key] && r.price ? [{ id: r.drink.id, price: r.price }] : []));
    onSave({ name: name.trim() || 'New menu', rows: out, prices });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <CheckTop kind="menu" onCancel={onCancel} />
        <View>
          <MonoLabel>MENU NAME</MonoLabel>
          <TextInput accessibilityLabel="Menu name" value={name} onChangeText={setName} style={[styles.name, { color: ds.c.ink, borderBottomColor: ds.c.lineStrong, fontFamily: fontFamilies.instrument }]} />
        </View>
        <View style={styles.pills}>
          {have ? <Pill tone="have" label={`${have} in your bar`} /> : null}
          {made ? <Pill tone="new" label={`${made} new`} /> : null}
          {open.length ? <Pill tone="pick" label={`${open.length} to pick`} /> : null}
        </View>
        <View role="list" aria-label="Drinks on the menu">
          {rows.map((row, i) => (
            <Fragment key={row.key}>
              {i === 0 || row.section !== rows[i - 1].section ? (
                <View style={styles.section}>
                  <MonoLabel>{(row.section ?? 'Drinks').toUpperCase()}</MonoLabel>
                  <MonoLabel>PRICE</MonoLabel>
                </View>
              ) : null}
              <MenuLine
                row={row}
                files={files}
                data={data}
                fresh={!!fresh[row.key]}
                onPick={(id) => setPicks((p) => ({ ...p, [row.key]: id }))}
                onMatch={() => setMatchOf(row.key)}
                onUndoFresh={() => setFresh((f) => ({ ...f, [row.key]: false }))}
              />
            </Fragment>
          ))}
          {skipped.map(({ line, i }) => (
            <SkippedMenuLine key={`skip-${i}`} line={line} files={files} onBringBack={() => setBack((b) => [...b, i])} />
          ))}
        </View>
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </ScrollView>
      <CheckFooter note={open.length ? `Pick the ${open[0].status === 'pick' ? open[0].name : ''} to finish` : null}>
        <Button label={saving ? 'Saving…' : `Add menu and ${have + made} ${have + made === 1 ? 'drink' : 'drinks'}`} size="lg" disabled={saving || !!open.length || !(have + made)} onPress={save} />
      </CheckFooter>
      {matchOf ? (
        <MenuSheet visible onClose={() => setMatchOf(null)} title="In your bar" subtitle="It matched a drink you have.">
          <View style={styles.sheet}>
            <Button label="Keep the match" onPress={() => setMatchOf(null)} />
            <Button label="Make it a new drink" variant="secondary" onPress={() => { setFresh((f) => ({ ...f, [matchOf]: true })); setMatchOf(null); }} />
          </View>
        </MenuSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.md, paddingBottom: space.xxl },
  name: { ...typeScale.title, borderBottomWidth: 1, paddingTop: space.xs, paddingBottom: space.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingVertical: 5, paddingHorizontal: space.sm + 2, borderRadius: radius.pill, borderWidth: 1 },
  section: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.lg + 2, paddingBottom: space.xs },
  sheet: { gap: space.sm },
});
