import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Headline, PressableScale, Sheet, Spec, TextLink, useDs } from '@/components/ds';
import { backbar, radius, space } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyHadDrinks, useMyHadPicks, usePinDrink, useSetHadPick, useSetSaysWhere } from '@/hooks/useRankings';
import { pickedShown, SHARE_MODES } from '@/lib/profiles';
import { formatScore } from '@/lib/ranking';

/**
 * On a drink you've had: whether it shows on your profile, as a glass button
 * that opens "On your profile" (ppl-drink-sheet). Every time you've had it
 * moves together.
 */
export function OnProfileButton({ itemId, name }: { itemId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const profile = useMyProfile().data;
  const had = (useMyHadDrinks().data ?? []).filter((d) => d.itemId === itemId);
  const picks = useMyHadPicks().data;
  if (!profile || !had.length || !picks) return null;
  const shown = had.some((d) => pickedShown(profile.sharing.had, picks[d.id]?.onProfile));
  return (
    <>
      <GlassButton
        accessibilityLabel={`${name} ${shown ? 'shows on your profile' : 'is only yours'}. Choose`}
        label={shown ? 'On profile' : 'Only me'}
        icon={shown ? 'eye' : 'eye.slash'}
        onPress={() => setOpen(true)}
      />
      <OnProfileSheet visible={open} itemId={itemId} name={name} onClose={() => setOpen(false)} />
    </>
  );
}

function OnProfileSheet({ visible, itemId, name, onClose }: { visible: boolean; itemId: string; name: string; onClose: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const profile = useMyProfile().data;
  const had = (useMyHadDrinks().data ?? []).filter((d) => d.itemId === itemId).sort((a, b) => b.score - a.score);
  const picks = useMyHadPicks().data ?? {};
  const setHad = useSetHadPick();
  const pinDrink = usePinDrink();
  const setWhere = useSetSaysWhere();
  const best = had[0];
  if (!profile || !best) return null;
  const mode = profile.sharing.had;
  const shown = had.some((d) => pickedShown(mode, picks[d.id]?.onProfile));
  const pinned = had.some((d) => picks[d.id]?.pin);
  const saysWhere = had.every((d) => picks[d.id]?.saysWhere !== false);
  const bar = best.venue?.name ?? null;
  const error = setHad.error ?? pinDrink.error ?? setWhere.error;

  const show = (on: boolean) => had.forEach((d) => setHad.mutate({ id: d.id, onProfile: on, pin: on ? (picks[d.id]?.pin ?? null) : null }));
  const choices = [
    { on: true, label: 'Show on my profile', sub: 'With your score' },
    { on: false, label: 'Only me', sub: 'Still counts in your rankings and the bar’s score' },
  ];
  const switchProps = { trackColor: { false: ds.c.lineStrong, true: ds.accentFill.fill }, thumbColor: backbar.light.surface, ...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null) };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="On your profile"
      style={styles.panel}
      header={
        <View style={styles.head}>
          <View style={styles.flex}>
            <Headline role="heading">On your profile</Headline>
            <Caption tone="muted">{[name, bar ? `had at ${bar}` : best.atBar ? 'had at a bar' : 'made at home'].join(' · ')}</Caption>
          </View>
          <View style={styles.score}>
            <Spec>{formatScore(best.score)}</Spec>
            <Caption tone="muted">your score</Caption>
          </View>
        </View>
      }
    >
      <View style={styles.body}>
        <View role="radiogroup" accessibilityLabel="Who sees this drink" style={styles.choices}>
          {choices.map((c) => {
            const on = shown === c.on;
            return (
              <PressableScale
                key={c.label}
                role="radio"
                aria-checked={on}
                accessibilityLabel={`${c.label}. ${c.sub}`}
                onPress={() => show(c.on)}
                style={[styles.choice, { backgroundColor: ds.c.raised, borderColor: on ? ds.accentText : 'transparent' }]}
              >
                <View style={[styles.dot, { borderColor: on ? ds.accentText : ds.c.muted, borderWidth: on ? 6 : 2 }]} />
                <View style={styles.flex}>
                  <DsText variant="headline">{c.label}</DsText>
                  <Caption tone="muted">{c.sub}</Caption>
                </View>
              </PressableScale>
            );
          })}
        </View>
        {shown ? (
          <>
            <View style={styles.row}>
              <Body style={styles.flex}>Pin to top four</Body>
              <Switch value={pinned} onValueChange={(on) => pinDrink.mutate({ id: best.id, pin: on })} aria-label="Pin to top four" disabled={pinDrink.isPending} {...switchProps} />
            </View>
            {bar ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Body>Say where I had it</Body>
                  <Caption tone="muted">{saysWhere ? `Shows ${bar}` : 'Off: shows “At a bar”'}</Caption>
                </View>
                <Switch value={saysWhere} onValueChange={(on) => had.forEach((d) => setWhere.mutate({ id: d.id, saysWhere: on }))} aria-label="Say where I had it" {...switchProps} />
              </View>
            ) : null}
          </>
        ) : null}
        {error ? (
          <Caption tone="accent" role="alert">
            {error.message}
          </Caption>
        ) : null}
        <View style={styles.row}>
          <Caption tone="muted">{`Your drinks are set to ${SHARE_MODES.find((m) => m.value === mode)?.label ?? 'All'}.`}</Caption>
          <TextLink
            label="Change"
            onPress={() => {
              onClose();
              router.push('/settings/profile-sharing' as Href);
            }}
          />
        </View>
        <Button label="Done" size="lg" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  panel: { maxWidth: 520, padding: space.xl, paddingTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  score: { alignItems: 'flex-end' },
  body: { gap: space.lg, paddingBottom: space.lg },
  choices: { gap: space.sm },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, borderWidth: 1 },
  dot: { width: 20, height: 20, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
