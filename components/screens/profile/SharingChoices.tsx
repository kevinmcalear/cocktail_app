import { useRouter, type Href } from 'expo-router';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, useDs } from '@/components/ds';
import { backbar, space } from '@/constants/tokens';
import { useSaveSharing, type MyProfile } from '@/hooks/useMyProfile';
import { modeSummary, SHARE_MODES, type ShareSection } from '@/lib/profiles';

const SECTIONS: { section: ShareSection; title: string }[] = [
  { section: 'had', title: 'Drinks I’ve had' },
  { section: 'bars', title: 'Bars I’ve been to' },
  { section: 'originals', title: 'Drinks I’ve made' },
];

/**
 * Settings › Public profile: how much of each section your profile shows
 * (All, Picked or None), with Choose for the single drinks, bars and
 * originals, and whether your drinks say when you had them. Each change
 * saves straight away, so Choose never loses one.
 */
export function SharingChoices({ profile }: { profile: MyProfile }) {
  const ds = useDs();
  const router = useRouter();
  const save = useSaveSharing();
  // A change shows straight away; a failed save puts it back.
  const pending = save.isPending ? save.variables : undefined;
  const modeOf = (section: ShareSection) => (pending?.section === section && pending.mode ? pending.mode : profile.sharing[section]);
  const showsDates = pending && pending.showsDates !== undefined ? pending.showsDates : profile.showsDates;

  return (
    <View style={styles.box}>
      <Headline role="heading">What your profile shows</Headline>
      {SECTIONS.map(({ section, title }) => {
        const mode = modeOf(section);
        return (
          <View key={section} style={styles.section}>
            <View style={styles.row}>
              <Body style={styles.flex}>{title}</Body>
              {mode !== 'none' ? <Button label="Choose" variant="ghost" onPress={() => router.push(`/settings/profile-picks?section=${section}` as Href)} /> : null}
            </View>
            <View role="radiogroup" accessibilityLabel={title} style={styles.chips}>
              {SHARE_MODES.map((m) => (
                <Chip key={m.value} label={m.label} selected={mode === m.value} onPress={() => save.mutate({ id: profile.id, section, mode: m.value })} />
              ))}
            </View>
            <Caption tone="muted">{modeSummary(section, mode)}</Caption>
            {section === 'had' && mode !== 'none' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Body>Say when I had them</Body>
                  <Caption tone="muted">Dates can show where you are. Off, your drinks show without them.</Caption>
                </View>
                <Switch
                  value={showsDates}
                  onValueChange={(on) => save.mutate({ id: profile.id, showsDates: on })}
                  aria-label="Say when I had them"
                  trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                  thumbColor={backbar.light.surface}
                  {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {save.error ? (
        <Caption tone="accent" role="alert">
          {save.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.lg },
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', gap: space.sm },
});
