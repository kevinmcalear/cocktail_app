import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BarInlineEditor } from '@/components/bar/BarInlineEditor';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BackbarTheme, useDs, useGutter } from '@/components/ds';
import { UnsavedBar } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { radius, space } from '@/constants/tokens';
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
  const frame = usePageFrame('text');
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
        contentContainerStyle={{ paddingTop: frame.top, paddingBottom: (dirty ? 0 : tabBarInset) + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={[frame.column, styles.page]}>
          {/* On wide web the sidebar's Venue section opens this page, so there's no Back. */}
          <SubPageHead
            title={name}
            subtitle={venue ? `Venue settings · You’re ${roleLabel(venue.roleLevel)}` : undefined}
            onBack={() => void back()}
            leading={venue?.logoUrl ? <Image source={{ uri: venue.logoUrl }} style={[styles.logo, { borderColor: ds.c.line }]} contentFit="cover" /> : null}
          />
          <BarInlineEditor barId={barId} embedded onChromeState={setChrome} />
        </View>
      </ScrollView>
      {dirty && chrome ? <UnsavedBar saving={chrome.saving} onDiscard={chrome.cancel} onSave={() => void chrome.save()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.mark, borderWidth: StyleSheet.hairlineWidth },
});
