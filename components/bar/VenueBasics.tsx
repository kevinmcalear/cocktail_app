import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Field, LogoImage } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { UnitsRow } from '@/components/screens/settings/UnitsRow';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { useBarEditor } from '@/hooks/useBarEditor';
import { DEFAULT_UNIT_OPTIONS } from '@/store/useSettingsStore';

type Editor = ReturnType<typeof useBarEditor>;

const LOGO = 32;

/**
 * The venue's name, its unit (bars.spec_unit: everyone here reads specs and
 * starts new lines in it unless they pick their own; Admins change it, board
 * Sta-units), its Theme for Admins (colour, type, logo and icon; canvas
 * Theme-flow-1), and its drinks in the Drinks tab, which switches the app to this venue.
 */
export function VenueBasics({ editor, barId }: { editor: Editor; barId: string }) {
  const router = useRouter();
  const { enterVenue } = useActiveVenue();
  const canTheme = (useCapabilities(barId).data ?? []).includes('brand');
  const drinks = `${editor.drinkCount} ${editor.drinkCount === 1 ? 'drink' : 'drinks'}`;
  const openDrinks = () => {
    enterVenue(barId);
    router.navigate('/drinks');
  };
  return (
    <SettingsSection title="Venue">
      <View style={styles.name}>
        <Field label="Name" value={editor.name} onChangeText={editor.setName} readOnly={!editor.canEdit} />
      </View>
      <RowDivider />
      <UnitsRow
        icon="jigger"
        intro={`${editor.name.trim() || 'This bar'}’s specs show in this unit. Anyone can pick their own in Settings › Units.`}
        options={DEFAULT_UNIT_OPTIONS}
        value={editor.unit}
        unit={editor.unit}
        onChange={editor.setUnit}
        disabled={!editor.canEdit}
      />
      {canTheme ? (
        <>
          <RowDivider />
          <SettingsRow
            label="Theme"
            detail={`How ${editor.name || 'the venue'} looks to guests and staff: colour, type and logo`}
            icon="place.theme"
            leading={editor.logoUrl ? <LogoImage uri={editor.logoUrl} size={LOGO} radius={radius.mark} /> : undefined}
            onPress={() => router.push(`/settings/bar/${barId}/theme` as Href)}
          />
        </>
      ) : null}
      <RowDivider />
      <SettingsRow label="View in Drinks" detail={drinks} icon="book" onPress={openDrinks} />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  name: { paddingVertical: space.md },
});
