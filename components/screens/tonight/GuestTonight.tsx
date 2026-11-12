import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PencilState } from '@/components/ds';
import { DrinkListRow, DrinkRows } from '@/components/screens/drinks/DrinksParts';
import { WarnNote } from '@/components/screens/takeover/parts';
import { space } from '@/constants/tokens';
import { useMenu } from '@/hooks/useMenus';
import type { TakeoverGuest } from '@/hooks/useTakeoverPage';
import { accessEnds } from '@/lib/takeover';

import { TonightHead, TonightLabel } from './TonightParts';

/**
 * The guest bartender's Tonight (Keep-phone guestview): how long they're a
 * guest here, then their list for the night, each drink with what's in it.
 * The board's "Where things live" waits for the back bar map, which is
 * switched off for now (BACK_BAR_SHOWN).
 */
export function GuestTonight({ guest, barName }: { guest: TakeoverGuest; barName: string }) {
  const router = useRouter();
  const menu = useMenu(guest.menuId);
  const drinks = (menu.data?.sections ?? []).flatMap((s) => s.drinks);
  const until = accessEnds(guest.endsAt);
  return (
    <View style={styles.stack}>
      {until ? <WarnNote icon="clock" text={`Guest at ${barName} until ${until}`} /> : null}
      <TonightHead eyebrow={`${barName} · takeover`} />
      <TonightLabel title="Your list" aside={[guest.guestBar, String(drinks.length)].filter(Boolean).join(' · ')} />
      {menu.isLoading ? (
        <PencilState kind="loading" title="Loading your list" compact />
      ) : (
        <DrinkRows>
          {drinks.map((d) => (
            <DrinkListRow key={d.id} itemId={d.id} name={d.name} line={d.line} onPress={() => router.push(`/cocktail/${d.id}` as Href)} />
          ))}
        </DrinkRows>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
});
