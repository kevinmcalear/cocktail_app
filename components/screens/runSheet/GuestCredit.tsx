import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { RunSheetData } from '@/hooks/useRunSheet';
import type { RunDrink } from '@/lib/runSheet';
import { andList } from '@/lib/runSheetText';
import { shareText } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { Dot } from './parts';

type Guest = RunSheetData['parties'][number];

/** "Bar Leone’s". */
const possessive = (name: string) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);

/** Whose a drink is, on its Serves row (board 7): tap to make it the guest bar's own, or ours again. */
export function WhoseTag({ drink, guest, guestColour, onToggle }: { drink: RunDrink; guest: Guest; guestColour: string; onToggle: () => void }) {
  const ds = useDs();
  const theirs = drink.partyId === guest.id;
  return (
    <PressableScale
      role="switch"
      aria-checked={theirs}
      accessibilityLabel={`${drink.name} is ${possessive(guest.name)} drink`}
      onPress={onToggle}
      style={[styles.tag, { borderColor: theirs ? guestColour : ds.c.lineStrong }]}
    >
      <Dot colour={theirs ? guestColour : ds.accentText} />
      <Caption numberOfLines={1} tone={theirs ? 'ink' : 'muted'} style={{ maxWidth: 180 }}>
        {theirs ? possessive(guest.name) : 'Ours'}
      </Caption>
    </PressableScale>
  );
}

/** Under the guest's name: whether it's linked to a bar page, and whether the bar runs that page. */
export function GuestPageNote({ guest, guestColour }: { guest: Guest; guestColour: string }) {
  const ds = useDs();
  const text = !guest.page ? 'Not linked to a page yet' : guest.page.claimed ? 'On Cocktail' : 'On Cocktail · not claimed yet';
  return (
    <View style={styles.note}>
      <Dot colour={guest.page ? guestColour : ds.c.muted} size={6} />
      <Caption tone="muted">{text}</Caption>
    </View>
  );
}

/**
 * Where the guest's drinks are credited (boards 7 and 9): to the typed name
 * until their page is linked, then to the page, with an invite to claim it.
 * Nothing once their bar runs its page.
 */
export function GuestCredit({ guest, drinks, menuName, day, onLink }: { guest: Guest; drinks: RunDrink[]; menuName: string; day: string | null; onLink: () => void }) {
  const ds = useDs();
  const names = drinks.filter((d) => d.partyId === guest.id).map((d) => d.name);
  if (!names.length || guest.page?.claimed) return null;
  const list = andList(names);
  const verb = names.length === 1 ? 'is' : 'are';
  const them = names.length === 1 ? 'it' : 'them';
  const page = guest.page;
  const invite = () => {
    if (!page) return;
    const message = `Hi ${guest.name}, we’ve put ${list} on Cocktail, credited to you, for ${menuName}${day ? ` on ${day}` : ''}. Claim your page to see ${them} and fix anything: ${siteOrigin()}/p/${page.handle}`;
    void shareText(message, `${guest.name}: claim your drinks`);
  };
  return (
    <View style={[styles.box, { backgroundColor: ds.c.ground }]}>
      <Body>
        {page
          ? `${list} ${verb} credited to ${guest.name}. Once they claim their page, they can see ${them} and fix anything.`
          : `${list} ${verb} credited to ${guest.name}, by the name you typed. Link their page to put the credit on Cocktail.`}
      </Body>
      <View style={styles.start}>
        {page ? (
          <Button label={`Invite ${guest.name} to claim their drinks`} size="sm" icon="square.and.arrow.up" onPress={invite} />
        ) : (
          <Button label="Link their page" size="sm" variant="secondary" accessibilityLabel={`Link ${guest.name} to their page`} onPress={onLink} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 32, paddingHorizontal: space.sm + 2, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  box: { borderRadius: radius.control, padding: space.md, gap: space.sm + 2, borderCurve: 'continuous' },
  start: { alignItems: 'flex-start' },
});
