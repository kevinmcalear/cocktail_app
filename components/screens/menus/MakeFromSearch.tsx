import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { EditSection } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

const CREATE_ROUTE: Record<MenuDrink['kind'], '/add-cocktail' | '/add-beer' | '/add-wine'> = { cocktail: '/add-cocktail', beer: '/add-beer', wine: '/add-wine' };

/**
 * Opens drink creation for a section, the name already in (cocktails; beer and
 * wine start blank). Once it's saved the builder puts it in that section
 * (useLayoutEditor's handoff).
 */
export function useMakeDrink(section: EditSection | null, barId: string | null) {
  const router = useRouter();
  return (name: string | null) => {
    if (!section) return;
    const kind = section.allowedTypes.includes('cocktail') ? 'cocktail' : (section.allowedTypes[0] ?? 'cocktail');
    router.push({ pathname: CREATE_ROUTE[kind], params: { menuSectionId: section.key, ...(barId ? { barId } : {}), ...(name && kind === 'cocktail' ? { name } : {}) } });
  };
}

interface MakeFromSearchProps {
  /** The name typed that isn't in the library (lib/menuLayout nameToMake). */
  name: string;
  section: EditSection;
  /** "Little Rye", or null for your own drinks. */
  where: string | null;
  onMake: () => void;
  onBringIn: () => void;
  /** A phone: the drink steps open, and Bring in is a snapped spec sheet. */
  phone?: boolean;
}

/**
 * When a drink isn't there, the same search makes it (dm-decided): Make
 * "name" straight onto the section, or bring it in from a spec sheet, a photo
 * or a link. Close matches follow it in the list.
 */
export function MakeFromSearch({ name, section, where, onMake, onBringIn, phone }: MakeFromSearchProps) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      <Caption tone="muted">{where ? `Not at ${where} yet.` : 'Not in your drinks yet.'}</Caption>
      <Option
        icon="plus"
        accent
        label={`Make “${name}”`}
        detail={phone ? 'Opens the drink steps, comes back here' : `A new drink, straight onto ${section.name}`}
        keys={phone ? undefined : '↵'}
        onPress={onMake}
        tint={ds.c.raised}
      />
      <Option
        icon={phone ? 'camera' : 'square.and.arrow.up'}
        label={phone ? 'Snap the spec' : 'Bring it in'}
        detail={phone ? 'A spec sheet or a notebook page' : 'From a spec sheet, a photo or a link'}
        onPress={onBringIn}
      />
    </View>
  );
}

function Option({ icon, label, detail, keys, accent, tint, onPress }: { icon: IconName; label: string; detail: string; keys?: string; accent?: boolean; tint?: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={[styles.option, tint ? { backgroundColor: tint } : null]}>
      <View style={[styles.icon, { backgroundColor: accent ? ds.accentFill.fill : ds.c.raised }]} aria-hidden>
        <IconSymbol name={icon} size={16} color={accent ? ds.accentFill.text : ds.c.ink} />
      </View>
      <View style={styles.flex}>
        <DsText variant="body" numberOfLines={1} style={{ fontFamily: fontFamilies.bodySemiBold }}>
          {label}
        </DsText>
        <Caption tone="muted">{detail}</Caption>
      </View>
      {keys ? (
        <Caption tone="muted" aria-hidden>
          {keys}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, paddingVertical: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.control, borderCurve: 'continuous' },
  icon: { width: 36, height: 36, borderRadius: radius.control - 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
