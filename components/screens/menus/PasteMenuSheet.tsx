import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { useSetMissingPrices } from '@/hooks/useBulk';
import { space } from '@/constants/tokens';
import { stageBringIn } from '@/lib/bringInHandoff';
import { plainDbMessage } from '@/lib/dbError';
import type { EditSection } from '@/lib/menuLayout';
import { bringInText, parseMenuPaste, pasteRows, placedGroups, type PasteRow, type PlacedGroup } from '@/lib/paste';
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

/** Paste drink names onto the menu. Specs stay in the library; this only attaches them. */
export function PasteMenuSheet({ into, library, already = [], onClose, onApply }: PasteMenuSheetProps) {
  const router = useRouter();
  const setPrices = useSetMissingPrices();
  const [text, setText] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const sections = useMemo(() => parseMenuPaste(text, !!into), [text, into]);

  const rows = useMemo(() => pasteRows(sections, library, picks, into, already), [sections, library, picks, into, already]);

  const adding = rows.filter((row): row is Extract<PasteRow, { status: 'add' }> => row.status === 'add');
  const missing = rows.flatMap((row) => (row.status === 'missing' ? [{ name: row.name, ingredients: row.ingredients }] : []));
  const unresolved = rows.some((row) => row.status === 'pick');

  const confirm = async () => {
    const groups = placedGroups(rows, !!into);
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
                stageBringIn(bringInText(missing));
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
