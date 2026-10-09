import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import type { useBarEditor } from '@/hooks/useBarEditor';

type Editor = ReturnType<typeof useBarEditor>;

const LOGO = 32;

/**
 * The venue's name, the way to its Brand screen (logo, accent, display face,
 * icon), and its drinks in the Library, which switches the app to this venue.
 */
export function VenueBasics({ editor, barId }: { editor: Editor; barId: string }) {
  const router = useRouter();
  const { enterVenue } = useActiveVenue();
  const drinks = `${editor.drinkCount} ${editor.drinkCount === 1 ? 'drink' : 'drinks'}`;
  const openLibrary = () => {
    enterVenue(barId);
    router.navigate('/library' as Href);
  };
  return (
    <SettingsSection title="Venue">
      <View style={styles.name}>
        <Field label="Name" value={editor.name} onChangeText={editor.setName} readOnly={!editor.canEdit} />
      </View>
      <RowDivider />
      <SettingsRow
        label="Brand and look"
        detail="Logo, accent colour, display face and home-screen icon"
        icon="paintpalette.fill"
        leading={editor.logoUrl ? <Image source={{ uri: editor.logoUrl }} style={styles.logo} contentFit="cover" /> : undefined}
        onPress={() => router.push(`/settings/bar/${barId}/brand` as Href)}
      />
      <RowDivider />
      <SettingsRow label="View in Library" detail={drinks} icon="square.grid.2x2" onPress={openLibrary} />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  name: { paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark },
});
