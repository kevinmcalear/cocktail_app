import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { radius, space } from '@/constants/tokens';
import type { useBarEditor } from '@/hooks/useBarEditor';

type Editor = ReturnType<typeof useBarEditor>;

const LOGO = 32;

/** The venue's name, and the way to its Brand screen (logo, accent, display face, icon). */
export function VenueBasics({ editor, barId }: { editor: Editor; barId: string }) {
  const router = useRouter();
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
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  name: { paddingVertical: space.md },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark },
});
