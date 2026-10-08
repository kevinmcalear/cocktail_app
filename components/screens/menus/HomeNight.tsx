import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSetHomeNight } from '@/hooks/useMenuMutations';
import { homeNight, type NightDraft } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { Choice, MenuSheet } from './MenuSheet';

export const EMPTY_NIGHT: NightDraft = { when: 'none', date: '', guests: '' };

/** The draft for a home menu that already has a night. */
export function draftFor(menu: Pick<MenuSummary, 'menuDate' | 'guestCount'>): NightDraft {
  return { when: menu.menuDate ? 'date' : 'none', date: menu.menuDate ?? '', guests: menu.guestCount ? String(menu.guestCount) : '' };
}

/** A home menu's night: when it is, and how many are coming. Both optional. */
export function HomeNightFields({ value, onChange }: { value: NightDraft; onChange: (next: NightDraft) => void }) {
  const set = (patch: Partial<NightDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <Caption tone="muted">When</Caption>
      <View role="radiogroup" accessibilityLabel="When" style={styles.wrap}>
        <Choice label="Tonight" selected={value.when === 'tonight'} onPress={() => set({ when: 'tonight' })} />
        <Choice label="Tomorrow" selected={value.when === 'tomorrow'} onPress={() => set({ when: 'tomorrow' })} />
        <Choice label="Pick a date" selected={value.when === 'date'} onPress={() => set({ when: 'date' })} />
        <Choice label="No date" selected={value.when === 'none'} onPress={() => set({ when: 'none' })} />
      </View>
      {value.when === 'date' ? (
        <DateField label="Date" value={value.date} onChange={(date) => set({ date })} />
      ) : null}
      <Field
        label="Guests"
        value={value.guests}
        onChangeText={(guests) => set({ guests: guests.replace(/[^0-9]/g, '') })}
        placeholder="6"
        keyboardType="number-pad"
        hint="How many are coming, so you know what to batch."
      />
    </>
  );
}

/** Changes a home menu's date and guest count, from the menu page. */
export function HomeNightSheet({ menu, onClose }: { menu: Pick<MenuSummary, 'id' | 'name' | 'menuDate' | 'guestCount'>; onClose: () => void }) {
  const [draft, setDraft] = useState(() => draftFor(menu));
  const [error, setError] = useState<string | null>(null);
  const save = useSetHomeNight();

  const submit = async () => {
    const night = homeNight(draft, Date.now());
    if ('error' in night) return setError(night.error);
    setError(null);
    try {
      await save.mutateAsync({ menuId: menu.id, night });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.');
    }
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Date and guests"
      subtitle={menu.name}
      footer={<Button label={save.isPending ? 'Saving…' : 'Save'} size="lg" onPress={submit} disabled={save.isPending} />}
    >
      <HomeNightFields value={draft} onChange={setDraft} />
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
