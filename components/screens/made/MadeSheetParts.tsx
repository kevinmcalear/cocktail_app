import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, PressableScale, TextLink, useDs } from '@/components/ds';
import { pickDrinkPhotos } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { showMessage } from '@/lib/dialogs';

const TILE = 88;

/** The dashed Photo tile beside the note: pick one, then it shows there, with Remove under it. */
export function MadePhoto({ uri, name, onChange }: { uri: string | null; name: string; onChange: (uri: string | null) => void }) {
  const ds = useDs();
  const pick = async () => {
    try {
      const picked = (await pickDrinkPhotos())[0];
      if (picked) onChange(picked);
    } catch {
      showMessage("Couldn't open your photos", 'Try again in a moment.');
    }
  };
  return (
    <View style={styles.photo}>
      <PressableScale
        role="button"
        accessibilityLabel={uri ? 'Change the photo' : 'Add a photo'}
        onPress={pick}
        style={[styles.tile, uri ? null : { borderColor: ds.c.lineStrong, borderWidth: 1, borderStyle: 'dashed' }]}
      >
        {uri ? (
          <DrinkImage source={uri} accessibilityLabel={`Your ${name}`} aspectRatio={1} radius="control" style={styles.fill} />
        ) : (
          <>
            <IconSymbol name="camera" size={22} color={ds.c.muted} />
            <Caption tone="muted">Photo</Caption>
          </>
        )}
      </PressableScale>
      {uri ? <TextLink label="Remove" onPress={() => onChange(null)} /> : null}
    </View>
  );
}

/**
 * "Show on my profile" above Save. When the profile can't show it yet
 * (no public profile, or it shows no drinks had), says so under the box.
 */
export function ShowOnProfile({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const ds = useDs();
  const profile = useMyProfile().data;
  const blocked = !profile
    ? 'You don’t have a public profile yet, so only you see it for now.'
    : !profile.isPublic || profile.sharing.had === 'none'
      ? 'Your profile doesn’t show the drinks you’ve had, so only you see it for now. Change that in What people see.'
      : null;
  return (
    <View style={styles.show}>
      <PressableScale role="checkbox" aria-checked={on} accessibilityLabel="Show on my profile" onPress={() => onChange(!on)} style={styles.showRow}>
        <Body>Show on my profile</Body>
        <View style={[styles.mark, { borderColor: on ? ds.accentText : ds.c.lineStrong, backgroundColor: on ? ds.accentText : 'transparent' }]}>
          {on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
        </View>
      </PressableScale>
      {on && blocked ? <Caption tone="muted">{blocked}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', gap: space.xs },
  tile: { width: TILE, height: TILE, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: space.xs, overflow: 'hidden' },
  fill: { width: TILE, height: TILE },
  show: { gap: space.xs },
  showRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: space.md },
  mark: { width: 22, height: 22, borderRadius: radius.mark, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
