import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PencilState } from '@/components/ds';
import { ListGroup, ListRow } from '@/components/ds/ListGroup';
import { DrinkListRow, DrinkRows } from '@/components/screens/drinks/DrinksParts';
import { WarnNote } from '@/components/screens/takeover/parts';
import { space } from '@/constants/tokens';
import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { useMenu } from '@/hooks/useMenus';
import { useTakeoverGuest, type TakeoverGuest } from '@/hooks/useTakeoverGuest';
import { useTakeoverPlaces, type TakeoverPlace } from '@/hooks/useTakeoverPage';
import { BACK_BAR_SHOWN } from '@/lib/backBar';
import { serviceTag } from '@/lib/drinksTab';
import { accessEnds } from '@/lib/takeover';

import { TonightHead, TonightLabel } from './TonightParts';

const PLACE_ICON = { house: 'flask', glass: 'wineglass', ice: 'snowflake', bottle: 'place.backbar' } as const satisfies Record<TakeoverPlace['kind'], string>;

/** Tonight for someone on one of the bar's own roles: a takeover's guest gets theirs (in `frame`), anyone else the team's (`children`). */
export function GuestGate({ barId, barName, roleId, wait, frame, children }: { barId: string; barName: string; roleId: string; wait: ReactNode; frame: (page: ReactNode) => ReactNode; children: ReactNode }) {
  const { data: guest, isLoading } = useTakeoverGuest(barId, roleId);
  if (isLoading) return wait;
  return guest ? frame(<GuestTonight guest={guest} barId={barId} barName={barName} />) : children;
}

/**
 * The guest bartender's Tonight (Keep-phone guestview): how long they're a
 * guest here, their list for the night (each drink with what's in it and its
 * allergen tag, "Egg"), and where its bottles, house-mades and glasses live
 * at the host. Where things live shows only what the host has placed
 * (item_locations), while the guest role has that permission and the back
 * bar isn't parked (BACK_BAR_SHOWN).
 */
function GuestTonight({ guest, barId, barName }: { guest: TakeoverGuest; barId: string; barName: string }) {
  const router = useRouter();
  const menu = useMenu(guest.menuId);
  const drinks = (menu.data?.sections ?? []).flatMap((s) => s.drinks);
  const ids = drinks.map((d) => d.id);
  const allergens = useGuestDrinkAllergens(ids).data;
  // The back bar is parked (BACK_BAR_SHOWN, Kevin 3 Nov: hidden everywhere), so its spots wait with it.
  const places = useTakeoverPlaces(BACK_BAR_SHOWN ? barId : null, ids).data ?? [];
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
          {drinks.map((d) => {
            const tag = serviceTag((allergens?.get(d.id)?.allergens ?? []).map((a) => a.allergen));
            return <DrinkListRow key={d.id} itemId={d.id} name={d.name} line={d.line} tag={tag ? { label: tag, warn: true } : null} onPress={() => router.push(`/cocktail/${d.id}` as Href)} />;
          })}
        </DrinkRows>
      )}
      {places.length ? (
        <>
          <TonightLabel title="Where things live" />
          <ListGroup>
            {places.map((p, i) => (
              <ListRow key={p.key} first={i === 0} icon={PLACE_ICON[p.kind]} title={p.name} detail={p.where} />
            ))}
          </ListGroup>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
});
