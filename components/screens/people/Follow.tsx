import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, DsText, PressableScale, Sheet, Title, useBreakpoint, useSheetClose, useToast } from '@/components/ds';
import { sheetIsDialog } from '@/components/ds/sheetFrame';
import { space } from '@/constants/tokens';
import { useFollowers, useFollowing, useSetFollow } from '@/hooks/useFollows';
import { followLabel } from '@/lib/follows';

/**
 * Following one person (Kept-follow): whether you follow them, whether they
 * follow you, and the label that makes. Follow is one tap; Following asks
 * first (the Unfollow sheet). Fails quietly back with a toast.
 */
export function useFollow(userId: string | null | undefined, name: string) {
  const following = useFollowing().data ?? [];
  const followers = useFollowers().data ?? [];
  const set = useSetFollow();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const on = !!userId && following.includes(userId);
  const followsYou = !!userId && followers.includes(userId);
  const first = name.split(' ')[0] || name;
  const change = (next: boolean) => {
    if (!userId) return;
    set.mutate(
      { followeeId: userId, on: next },
      { onError: () => toast.show({ title: next ? `Couldn’t follow ${first}` : `Couldn’t unfollow ${first}`, detail: 'Check your connection and try again.' }) },
    );
  };
  return {
    following: on,
    followsYou,
    label: followLabel({ following: on, followsYou }),
    /** Follow at once, or ask before unfollowing. */
    press: () => (on ? setAsking(true) : change(true)),
    sheet: <UnfollowSheet name={first} visible={asking} onClose={() => setAsking(false)} onUnfollow={() => change(false)} />,
  };
}

/** The person page's button: Follow or Follow back in the accent with a plus, Following plain with a tick. */
export function FollowButton({ follow, name }: { follow: ReturnType<typeof useFollow>; name: string }) {
  return (
    <>
      <Button
        label={follow.label}
        icon={follow.following ? 'checkmark' : 'plus'}
        variant={follow.following ? 'secondary' : 'primary'}
        accessibilityLabel={follow.following ? `Following ${name}. Unfollow` : `${follow.label} ${name}`}
        onPress={follow.press}
        style={styles.grow}
      />
      {follow.sheet}
    </>
  );
}

/** A row's end (People, Find people): Follow or Follow back in the accent, Following muted (it asks first). */
export function FollowText({ userId, name }: { userId: string; name: string }) {
  const follow = useFollow(userId, name);
  return (
    <>
      <PressableScale role="button" accessibilityLabel={follow.following ? `Following ${name}. Unfollow` : `${follow.label} ${name}`} onPress={follow.press} hitSlop={space.sm} style={styles.text}>
        <DsText variant="label" tone={follow.following ? 'muted' : 'accent'}>
          {follow.label}
        </DsText>
      </PressableScale>
      {follow.sheet}
    </>
  );
}

/** "Unfollow Sam?" Their ranks leave your Tonight, and they aren't told. */
function UnfollowSheet({ name, visible, onClose, onUnfollow }: { name: string; visible: boolean; onClose: () => void; onUnfollow: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={`Unfollow ${name}?`}>
      <UnfollowBody name={name} onUnfollow={onUnfollow} />
    </Sheet>
  );
}

function UnfollowBody({ name, onUnfollow }: { name: string; onUnfollow: () => void }) {
  const close = useSheetClose();
  const insets = useSafeAreaInsets();
  // Side by side in the web's dialog, stacked on a phone.
  const side = useBreakpoint() !== 'phone' && sheetIsDialog;
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      <Title align="center">{`Unfollow ${name}?`}</Title>
      <Body tone="muted" align="center">{`Their ranks leave your Tonight. ${name} isn’t told.`}</Body>
      <View style={[styles.actions, side ? styles.side : null]}>
        <Button
          label="Unfollow"
          variant="danger"
          size="lg"
          onPress={() => {
            onUnfollow();
            close();
          }}
          style={side ? styles.grow : null}
        />
        <Button label="Cancel" variant="ghost" onPress={close} style={side ? styles.grow : null} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  text: { minHeight: 44, justifyContent: 'center' },
  sheet: { gap: space.md, paddingTop: space.lg, paddingHorizontal: space.lg },
  actions: { gap: space.xs, marginTop: space.sm },
  side: { flexDirection: 'row-reverse', gap: space.sm },
});
