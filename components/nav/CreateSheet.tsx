import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs, type IconName } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDrafts } from '@/hooks/useDrafts';
import { useMode } from '@/hooks/useMode';
import { useSearchMine } from '@/hooks/useSearchMine';
import { roleLabel } from '@/lib/roles';
import { useBringIn } from '@/store/useBringIn';

import { NewDrafts } from './NewDrafts';
import { HomeMark } from './VenueMarks';

// The same five things the old create button made, and where each is made.
// `atVenue`: made at the venue you're in, so it needs its bar and the right to add there.
// `homeHint`: what it says at home, where it lands in your own drinks and shelf.
const CREATE: { label: string; hint: string; homeHint: string; icon: string; symbol?: IconName; href: string; atVenue?: boolean }[] = [
  { label: 'Drink', hint: 'A cocktail and its spec', homeHint: 'A cocktail and its spec, in your drinks', icon: 'TabDrinks', href: '/add-cocktail', atVenue: true },
  { label: 'Ingredient or prep', hint: 'A bottle, or something made in house', homeHint: 'A bottle for your shelf, or something you make', icon: 'TabIngredients', href: '/add-ingredient', atVenue: true },
  { label: 'Beer', hint: 'For the list or a menu', homeHint: 'For your shelf or a home menu', icon: 'Beer', href: '/add-beer', atVenue: true },
  { label: 'Wine', hint: 'For the list or a menu', homeHint: 'For your shelf or a home menu', icon: 'Wine', href: '/add-wine', atVenue: true },
  { label: 'Menu', hint: 'Start fresh or copy one', homeHint: 'A night in: start fresh or from a saved menu', icon: 'TabMenus', symbol: 'text.alignleft', href: '/menus/all?new=1' },
];

function Row({ icon, label, hint, trailing, onPress }: { icon: React.ReactNode; label: string; hint: string; trailing?: React.ReactNode; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. ${hint}`} onPress={onPress} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>{icon}</View>
      <View style={styles.text}>
        <Body style={{ fontFamily: fontFamilies.bodySemiBold }}>{label}</Body>
        <Caption tone="muted">{hint}</Caption>
      </View>
      {trailing}
    </PressableScale>
  );
}

/** Drinks, ingredients, beer and wine at a venue where your role can't add them: shown, locked, with the role that can. */
function LockedRow({ barId }: { barId: string }) {
  const ds = useDs();
  const opensAt = useCapabilityOpensAt(barId, 'edit_drinks').data;
  // Drink Creator (35) in the default role matrix, until the venue's own loads.
  const hint = `Opens at ${roleLabel(opensAt ?? 35)}`;
  return (
    <View accessibilityLabel={`Drink, ingredient, beer, wine. ${hint}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.icon, styles.locked, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="lock.fill" size={18} color={ds.c.muted} />
      </View>
      <View style={styles.text}>
        <Body tone="muted" style={{ fontFamily: fontFamilies.bodySemiBold }}>
          Drink, ingredient, beer, wine
        </Body>
        <Caption tone="muted">{hint}</Caption>
      </View>
    </View>
  );
}

/**
 * New: what you left half made at the top (Drafts), then make a drink,
 * ingredient, beer, wine or menu, or carry on with an older draft.
 * The subtitle says where it's made. A dialog on desktop, like every other sheet.
 */
export function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const { setMode } = useMode();
  const { drafts } = useDrafts();
  // At a venue, what you make is the venue's (it used to save to your home bar).
  // Without the right to add drinks there, those rows lock, with a way to make your own at home.
  const { venueId, canAdd, label: venueName } = useSearchMine();
  // Until the venue's permissions arrive, neither the venue rows nor the lock: no flash of the wrong one.
  const caps = useCapabilities(venueId).data;
  const known = !venueId || caps !== undefined;
  const locked = known && !!venueId && !canAdd;
  const made = CREATE.filter((c) => !c.atVenue || canAdd);
  const hrefOf = (c: (typeof CREATE)[number]) => (c.atVenue && venueId ? `${c.href}?barId=${venueId}` : c.href);
  const subtitle = !venueId ? 'In your home bar' : canAdd ? `Made at ${venueName}, for its library` : `Made at ${venueName}`;
  const go = (href: string) => {
    onClose();
    router.push(href as Href);
  };
  const makeAtHome = () => {
    onClose();
    setMode('home');
    router.push('/add-cocktail');
  };
  return (
    <MenuSheet visible={visible} onClose={onClose} title="New" subtitle={subtitle} plain>
      <View>
        <NewDrafts
          barId={venueId ?? null}
          onOpen={(params) => {
            onClose();
            router.push({ pathname: '/add-cocktail', params });
          }}
        />
        {locked && venueId ? <LockedRow barId={venueId} /> : null}
        {made.map((c) => (
          <Row key={c.label} label={c.label} hint={venueId ? c.hint : c.homeHint} icon={c.symbol ? <IconSymbol name={c.symbol} size={20} color={ds.c.ink} /> : <CustomIcon name={c.icon} size={22} color={ds.c.ink} />} onPress={() => go(hrefOf(c))} />
        ))}
        <Row
          label="Bring in"
          hint="Snap, drop or paste a menu, recipes or bottles"
          icon={<IconSymbol name="square.and.arrow.down" size={20} color={ds.c.ink} />}
          onPress={() => {
            onClose();
            // Its own sheet, over the screen you were on, once this one has gone.
            setTimeout(() => useBringIn.getState().openSheet(), 350);
          }}
        />
        {/* Drafts the older editors kept in the account; what's half made here is listed at the top. */}
        {drafts.length ? (
          <Row label="Drafts" hint="Pick up where you left off" icon={<IconSymbol name="doc.text" size={20} color={ds.c.ink} />} trailing={<Caption tone="muted">{drafts.length}</Caption>} onPress={() => go('/drafts')} />
        ) : null}
        {locked ? (
          <PressableScale role="link" accessibilityLabel="Make your own drink in your home bar" onPress={makeAtHome} style={styles.home}>
            <HomeMark size={24} />
            <Body style={styles.flex}>Make your own drink in your home bar</Body>
            <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  locked: { borderWidth: 1, borderStyle: 'dashed' },
  home: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, marginTop: space.sm },
  flex: { flex: 1 },
});
