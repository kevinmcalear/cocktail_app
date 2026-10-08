import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, GlassButton, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useDrafts } from '@/hooks/useDrafts';

// The same five things the old create button made, and where each is made.
const CREATE: { label: string; hint: string; icon: string; href: string }[] = [
  { label: 'Drink', hint: 'A cocktail and its spec', icon: 'TabDrinks', href: '/add-cocktail' },
  { label: 'Ingredient', hint: 'A bottle, or something made in house', icon: 'TabIngredients', href: '/add-ingredient' },
  { label: 'Beer', hint: 'For the list or a menu', icon: 'Beer', href: '/add-beer' },
  { label: 'Wine', hint: 'For the list or a menu', icon: 'Wine', href: '/add-wine' },
  { label: 'Menu', hint: 'Start fresh or copy one', icon: 'TabMenus', href: '/menus/all?new=1' },
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

/** New: make a drink, ingredient, beer, wine or menu, or carry on with a draft. A dialog on desktop, like every other sheet. */
export function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const { drafts } = useDrafts();
  const go = (href: string) => {
    onClose();
    router.push(href as Href);
  };
  return (
    <MenuSheet visible={visible} onClose={onClose} title="New">
      <View>
        {CREATE.map((c) => (
          <Row key={c.label} label={c.label} hint={c.hint} icon={<CustomIcon name={c.icon} size={22} color={ds.c.ink} />} onPress={() => go(c.href)} />
        ))}
        <Row label="Bring in" hint="Paste drinks or bottles" icon={<IconSymbol name="doc.on.doc" size={20} color={ds.c.ink} />} onPress={() => go('/bring-in')} />
        <Row
          label="Drafts"
          hint={drafts.length ? 'Pick up where you left off' : 'Nothing unfinished'}
          icon={<IconSymbol name="doc.text" size={20} color={ds.c.ink} />}
          trailing={drafts.length ? <Caption tone="muted">{drafts.length}</Caption> : null}
          onPress={() => go('/edit-mode')}
        />
      </View>
    </MenuSheet>
  );
}

/** The "+" in the header of every redesigned screen. */
export function CreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GlassButton accessibilityLabel="New: drink, ingredient, beer, wine, menu, bring in a list, or a draft" icon="plus" onPress={() => setOpen(true)} />
      {open ? <CreateSheet visible onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
