import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Field, LogoImage } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { useBarEditor } from '@/hooks/useBarEditor';

type Editor = ReturnType<typeof useBarEditor>;

const LOGO = 32;

/**
 * The venue's name, its Theme for Admins (colour, type, logo and icon; canvas
 * Theme-flow-1), and its drinks in the Library, which switches the app to this venue.
 */
export function VenueBasics({ editor, barId }: { editor: Editor; barId: string }) {
  const router = useRouter();
  const { enterVenue } = useActiveVenue();
  const canTheme = (useCapabilities(barId).data ?? []).includes('brand');
  const drinks = `${editor.drinkCount} ${editor.drinkCount === 1 ? 'drink' : 'drinks'}`;
  const openLibrary = () => {
    enterVenue(barId);
    router.navigate('/drinks');
  };
  return (
    <SettingsSection title="Venue">
      <View style={styles.name}>
        <Field label="Name" value={editor.name} onChangeText={editor.setName} readOnly={!editor.canEdit} />
      </View>
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
      <SettingsRow label="View in Library" detail={drinks} icon="book" onPress={openLibrary} />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  name: { paddingVertical: space.md },
});
