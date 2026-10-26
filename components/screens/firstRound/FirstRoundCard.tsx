import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Surface, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks } from '@/hooks/useProfiles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { onAMenu, OPENED_COPY, yourMenuStep } from '@/lib/firstRound';
import { menuStatus } from '@/lib/menus';
import { canSwitchFeatures } from '@/lib/venueFeatures';

import { FirstCocktailChoices } from './FirstCocktailChoices';
import { nextLine, progressLine, RoundBars, RoundStepList, useRoundGo } from './RoundParts';

function CloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={styles.close}>
      <IconSymbol name="xmark" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * The first round at the top of the Library (whole-app canvas, Onboarding,
 * "First round and Features"): the steps with the one that's up, then a
 * one-line strip once a step is done, then a quiet "That's the round". A
 * maker's "put it on a menu" counts as soon as a menu here has a drink.
 */
export function FirstRoundCard() {
  const ds = useDs();
  const router = useRouter();
  const round = useFirstRound();
  const go = useRoundGo();
  const [open, setOpen] = useState<boolean | null>(null);
  const [now] = useState(() => Date.now());
  const menus = useVenueMenus(round.active && (round.current?.key === 'menu' || round.current?.key === 'open_menu') ? (round.venue?.id ?? null) : null).data;
  const profileId = useMyProfile().data?.id;
  const mine = useMyMadeDrinks(profileId, round.active && round.current?.key === 'open_menu' && !!profileId).data;
  const markMenu = !!menus && round.current?.key === 'menu' && onAMenu(round.round, menus.filter((m) => m.barId === round.venue?.id));
  const { done } = round;
  // Admins can switch more on, as the role they're viewing as (the Features row and page check the same).
  const switches = canSwitchFeatures(useEffectiveRole(round.venue?.id ?? null));
  useEffect(() => {
    if (markMenu) done('menu');
  }, [markMenu, done]);

  const venue = round.venue;
  if (!venue) return null;
  const frame = [styles.card, { borderColor: ds.c.line }];

  if (round.showDone) {
    return (
      <Surface raised style={frame}>
        <CloseButton label="Dismiss" onPress={round.seeDone} />
        <View role="status" style={styles.doneText}>
          <Body style={styles.strong}>That’s the round</Body>
          <Caption tone="muted">{`Menus and Discover are open. Anything else ${venue.name} turns on shows up here.`}</Caption>
        </View>
        {switches ? <TextLink label={`Turn on more for ${venue.name}`} tone="ink" onPress={() => router.push(`/settings/bar/${venue.id}/features`)} /> : null}
      </Surface>
    );
  }
  if (!round.active || !round.current) return null;

  const full = open ?? round.doneCount === 0;
  // "3 of its drinks are yours" on a staff member's first step (find-yourself step 7).
  const yours = menus && mine ? yourMenuStep(menus.filter((m) => m.barId === venue.id).map((m) => ({ ...m, status: menuStatus(m, now) })), new Set(mine.map((d) => d.id))) : null;
  const steps = yours ? round.steps.map((s) => (s.key === 'open_menu' ? { ...s, ...yours } : s)) : round.steps;
  const current = steps.find((s) => s.key === round.current?.key) ?? round.current;
  if (!full) {
    return (
      <PressableScale role="button" accessibilityLabel={`${progressLine(round.doneCount, round.total)}. ${nextLine(current)}. Show the steps`} onPress={() => setOpen(true)}>
        <Surface raised style={[frame, styles.strip]}>
          <View style={styles.grow}>
            <Caption tone="muted">{progressLine(round.doneCount, round.total)}</Caption>
            <Body style={styles.medium}>{nextLine(current)}</Body>
          </View>
          <RoundBars done={round.doneCount} total={round.total} />
        </Surface>
      </PressableScale>
    );
  }

  const make = round.kind === 'make';
  const firstCocktail = round.current.key === 'house_spec';
  return (
    <Surface raised style={frame}>
      <CloseButton label="Hide the first round for now" onPress={() => setOpen(false)} />
      <View style={styles.intro}>
        <Caption tone="muted">{make ? 'Your first round' : `Welcome to ${venue.name}`}</Caption>
        <Headline role="heading">{make ? 'Three things, about two minutes' : 'Two things, about a minute'}</Headline>
        <Caption tone="muted">{make ? 'Each one opens a bit more of the app. Skip any time.' : `Every spec ${venue.name} pours is here. Skip any time.`}</Caption>
      </View>
      <RoundStepList
        steps={steps}
        currentKey={round.current.key}
        onSkip={() => round.current && round.done(round.current.key)}
        choices={firstCocktail ? <FirstCocktailChoices onPick={(start) => go(round.current, start)} /> : null}
      />
      <View style={styles.actions}>
        {/* The first cocktail's choices are its buttons (E30 B); every other step has one. */}
        {firstCocktail ? null : <Button label={round.current.action} onPress={() => go(round.current)} />}
        <Button label="Show me everything" variant="ghost" onPress={round.showEverything} />
      </View>
    </Surface>
  );
}

/** "Menus is open": over the tab bar, once, as a step opens its tab. */
export function RoundOpened() {
  const ds = useDs();
  const round = useFirstRound();
  const go = useRoundGo();
  const inset = useTabBarInset();
  const tab = round.opened;
  if (!tab) return null;
  const copy = OPENED_COPY[tab];
  const later = () => round.seeOpened(tab);
  return (
    <View style={[styles.floating, { bottom: Math.max(space.md, inset - space.md) }]} pointerEvents="box-none">
      <Surface raised style={[styles.card, styles.opened, { borderColor: ds.c.lineStrong }]}>
        <View role="status" style={styles.openedRow}>
          <View style={[styles.openedIcon, { backgroundColor: ds.c.surface }]}>
            <IconSymbol name={tab === 'menus' ? 'place.menus' : 'place.discover'} size={20} color={ds.accentText} />
          </View>
          <View style={styles.grow}>
            <Body style={styles.strong}>{copy.title}</Body>
            <Caption tone="muted">{copy.body}</Caption>
          </View>
        </View>
        <View style={styles.row}>
          <Button
            label={copy.action}
            onPress={() => {
              later();
              go(round.current);
            }}
            style={styles.grow}
          />
          <Button label="Later" variant="secondary" onPress={later} />
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: space.lg },
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  close: { position: 'absolute', top: space.xs, right: space.xs, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  intro: { gap: space.xs, paddingRight: space.xxl },
  doneText: { gap: space.xs, paddingRight: space.xxl },
  actions: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
  floating: { position: 'absolute', left: space.md, right: space.md, ...(Platform.OS === 'web' ? { maxWidth: 560 } : null) },
  opened: { gap: space.md, padding: space.lg, borderRadius: radius.card },
  openedRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  openedIcon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
