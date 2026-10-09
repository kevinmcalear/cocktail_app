import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarInlineEditor } from '@/components/bar/BarInlineEditor';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BackbarTheme, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { UnsavedBar } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { confirmDiscardChanges } from '@/lib/dialogs';
import type { EditorChromeState } from '@/lib/editorChrome';
import { roleLabel } from '@/lib/roles';

const LOGO = 44;

/** A venue's settings on a page of their own: name and brand, staff link, who sees what, more settings, team. */
export function VenueSettingsScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <VenuePage barId={barId} />
    </BackbarTheme>
  );
}

function VenuePage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const name = venue?.name ?? 'Venue';
  // The editor's Save and Discard, so changes can be saved from the bar at the bottom.
  const [chrome, setChrome] = useState<EditorChromeState | null>(null);
  const dirty = !!chrome?.isDirty;

  const back = async () => {
    if (!(await confirmDiscardChanges(dirty))) return;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{`${name} settings`}</title>
      </WebHead>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: (dirty ? 0 : tabBarInset) + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={styles.page}>
          <View style={styles.head}>
            <GlassButton
              accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
              icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
              onPress={() => void back()}
            />
            {venue?.logoUrl ? <Image source={{ uri: venue.logoUrl }} style={[styles.logo, { borderColor: ds.c.line }]} contentFit="cover" /> : null}
            <View style={styles.title}>
              <Title numberOfLines={1}>{name}</Title>
              {venue ? <Caption tone="muted">{`Venue settings · You’re ${roleLabel(venue.roleLevel)}`}</Caption> : null}
            </View>
          </View>
          <BarInlineEditor barId={barId} embedded onChromeState={setChrome} />
        </View>
      </ScrollView>
      {dirty && chrome ? <UnsavedBar saving={chrome.saving} onDiscard={chrome.cancel} onSave={() => void chrome.save()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark, borderWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, gap: 2, minWidth: 0 },
});
