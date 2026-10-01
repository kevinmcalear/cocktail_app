import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { useSetMissingPrices } from '@/hooks/useBulk';
import { space } from '@/constants/tokens';
import { stageBringIn } from '@/lib/bringInHandoff';
import { plainDbMessage } from '@/lib/dbError';
import type { EditSection } from '@/lib/menuLayout';
import { matchByName, parseMenuPaste, type PlacedGroup } from '@/lib/paste';
import type { MenuDrink } from '@/types/menus';

import { Choice, MenuSheet } from './MenuSheet';

interface PasteMenuSheetProps {
  /** The section this paste fills. Null pastes a whole menu, headings and all. */
  into: EditSection | null;
  library: MenuDrink[];
  /** Drinks already in the section a heading-less paste lands in. */
  already?: string[];
  onClose: () => void;
  onApply: (groups: PlacedGroup[]) => void;
}

type Row =
  | { key: string; section: string | null; status: 'add'; drink: MenuDrink; price: string | null; note: string }
  | { key: string; section: string | null; status: 'pick'; name: string; options: MenuDrink[] }
  | { key: string; section: string | null; status: 'missing'; name: string }
  | { key: string; section: string | null; status: 'skip'; name: string; note: string };

/** Paste drink names onto the menu. Specs stay in the library; this only attaches them. */
export function PasteMenuSheet({ into, library, already = [], onClose, onApply }: PasteMenuSheetProps) {
  const router = useRouter();
  const setPrices = useSetMissingPrices();
  const [text, setText] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const sections = useMemo(() => parseMenuPaste(text, !!into), [text, into]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const seen = new Set(into?.drinks.map((drink) => drink.id) ?? []);
    const parked = new Set(already);
    sections.forEach((section, si) => {
      section.lines.forEach((line, li) => {
        const key = `${si}:${li}`;
        const match = matchByName(line.name, library);
        const place = (drink: MenuDrink) => {
          if (into && !into.allowedTypes.includes(drink.kind)) {
            out.push({ key, section: section.name, status: 'skip', name: drink.name, note: `${into.name} doesn’t take ${drink.kind}` });
            return;
          }
          if (seen.has(drink.id) || (!into && !section.name && parked.has(drink.id))) {
            out.push({ key, section: section.name, status: 'skip', name: drink.name, note: 'Already on this menu' });
            return;
          }
          seen.add(drink.id);
          const price = !drink.price && line.price ? line.price : null;
          const note = drink.price && line.price ? `Price stays ${drink.price}` : price ? `Price ${price}` : 'In the library';
          out.push({ key, section: section.name, status: 'add', drink: price ? { ...drink, price } : drink, price, note });
        };
        if (match.kind === 'one') place(match.item);
        else if (match.kind === 'many') {
          const chosen = match.items.find((item) => item.id === picks[key]);
          if (chosen) place(chosen);
          else out.push({ key, section: section.name, status: 'pick', name: line.name, options: match.items });
        } else out.push({ key, section: section.name, status: 'missing', name: line.name });
      });
    });
    return out;
  }, [sections, library, picks, into, already]);

  const adding = rows.filter((row): row is Extract<Row, { status: 'add' }> => row.status === 'add');
  const missing = rows.flatMap((row) => (row.status === 'missing' ? [row.name] : []));
  const unresolved = rows.some((row) => row.status === 'pick');

  const confirm = async () => {
    const groups: PlacedGroup[] = [];
    for (const row of adding) {
      const name = into ? null : row.section;
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.drinks.push(row.drink);
      else groups.push({ name, drinks: [row.drink] });
    }
    setError(null);
    try {
      const prices = adding.flatMap((row) => (row.price ? [{ id: row.drink.id, price: row.price }] : []));
      if (prices.length) await setPrices.mutateAsync(prices);
      onApply(groups);
      onClose();
    } catch (e) {
      setError(plainDbMessage(e) ?? 'Couldn’t set those prices.');
    }
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={into ? `Paste into ${into.name}` : 'Paste a list'}
      subtitle={into ? 'One drink a line. Headings are skipped.' : 'A line ending in a colon starts a section.'}
      footer={
        <>
          <Button label={setPrices.isPending ? 'Adding…' : `Add ${adding.length}`} onPress={confirm} disabled={!adding.length || unresolved || setPrices.isPending} />
          {missing.length ? (
            <Button
              label={`Make ${missing.length} missing ${missing.length === 1 ? 'drink' : 'drinks'}`}
              variant="secondary"
              onPress={() => {
                stageBringIn(missing);
                onClose();
                router.push('/bring-in' as Href);
              }}
            />
          ) : null}
        </>
      }
    >
      <Field label="The list" value={text} onChangeText={setText} placeholder={'Signatures:\nNegroni — 18\nMartini — 19'} minLines={4} />
      {!text.trim() ? <Body tone="muted">Drinks already in the library get attached. A price is kept only when the drink has none.</Body> : null}
      {rows.map((row) => {
        if (row.status === 'pick') {
          return (
            <View key={row.key} style={{ gap: space.sm }}>
              <Caption>{row.name}. Which one?</Caption>
              {row.options.map((option) => (
                <Choice key={option.id} label={option.name} detail={option.line || option.kind} selected={false} onPress={() => setPicks((prev) => ({ ...prev, [row.key]: option.id }))} />
              ))}
            </View>
          );
        }
        const label = row.status === 'add' ? `${row.drink.name}. ${row.note}` : row.status === 'missing' ? `${row.name}. Not in the library` : `${row.name}. ${row.note}`;
        return (
          <Caption key={row.key} tone={row.status === 'missing' ? 'accent' : 'muted'}>
            {label}
          </Caption>
        );
      })}
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </MenuSheet>
  );
}
