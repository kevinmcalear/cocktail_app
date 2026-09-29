import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Display, DsText, GlassButton, PressableScale, Tag, useBreakpoint, useDs, useGutter, type IconName } from '@/components/ds';
import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMenu } from '@/hooks/useMenus';
import { homeMenuLine, menuDateLine, menuStatus, plural } from '@/lib/menus';
import type { MenuStatus } from '@/types/menus';

import { HomeNightSheet } from './HomeNight';
import { MenuMoreSheet } from './MenuMoreSheet';
import { MenuSections } from './MenuSections';

const STATUS_LABEL: Record<MenuStatus, string> = { on: 'On now', upcoming: 'Coming up', draft: 'Draft', previous: 'Previous' };
const STATUS_TONE = { on: 'success', upcoming: 'accent', draft: 'default', previous: 'default' } as const;

export function MenuAction({ label, icon, onPress, primary }: { label: string; icon: IconName; onPress: () => void; primary?: boolean }) {
  const ds = useDs();
  const ink = primary ? ds.accentFill.text : ds.c.ink;
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.action,
        primary ? { backgroundColor: ds.accentFill.fill } : { backgroundColor: ds.c.surface, borderColor: ds.c.line, borderWidth: 1 },
      ]}
    >
      <IconSymbol name={icon} size={20} color={ink} />
      <DsText variant="caption" color={ink}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/**
 * One menu, set like the printed menu, with what you can do with it: edit,
 * share, study and prep. Drinks open their own pages.
 */
export function MenuScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { venues } = useActiveVenue();
  const { data: menu, isLoading, error } = useMenu(menuId);
  const [now] = useState(() => Date.now());
  const [more, setMore] = useState(false);
  const [night, setNight] = useState(false);
  const userId = useAuth().user?.id ?? null;
  const caps = useCapabilities(menu?.barId);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
  if (!menu) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
        <Body tone="muted">{isLoading ? 'Opening the menu…' : error ? 'Couldn’t load this menu. Try again in a moment.' : 'This menu isn’t there any more, or it isn’t yours to see.'}</Body>
      </View>
    );
  }

  const status = menuStatus(menu, now);
  const venue = venues.find((v) => v.id === menu.barId);
  const drinkCount = menu.sections.reduce((n, s) => n + s.drinks.length, 0);
  const hero = menu.coverUrl ?? menu.sections.flatMap((s) => s.drinks).find((d) => d.imageUrl && !d.isSketch)?.imageUrl ?? null;
  const go = (href: string) => router.push(href as Href);
  const canEdit = menu.barId ? Array.isArray(caps.data) && caps.data.includes('menus') : menu.createdBy === userId;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        {hero ? <DrinkHero name={menu.name} imageUrl={hero} glass={null} height={wide ? 360 : 320} fade /> : <View style={{ height: insets.top + 72 }} />}
        <View style={[styles.body, { paddingHorizontal: gutter, marginTop: hero ? -84 : 0, maxWidth: wide ? 760 : undefined }]}>
          {/* A solid ground behind it: it sits on the photo, which can be light or dark. */}
          {/* A home menu is always a draft to the venue calendar: its night is in the line below. */}
          {menu.barId || status !== 'draft' ? (
            <Tag label={[STATUS_LABEL[status], menuDateLine(menu, now)].filter(Boolean).join(' ')} tone={STATUS_TONE[status]} style={{ backgroundColor: ds.c.ground }} />
          ) : null}
          <Display>{menu.name}</Display>
          <Caption tone="muted">
            {[venue?.name ?? (menu.barId ? null : 'Just yours'), homeMenuLine(menu, now), plural(drinkCount, 'drink'), plural(menu.sections.length, 'section')].filter(Boolean).join(' · ')}
          </Caption>
          <View style={styles.actions}>
            {canEdit ? <MenuAction label="Edit" icon="pencil" primary onPress={() => go(`/menus/${menu.id}/edit`)} /> : null}
            {canEdit && !menu.barId ? <MenuAction label="Date and guests" icon="calendar" onPress={() => setNight(true)} /> : null}
            <MenuAction label="Share" icon="square.and.arrow.up" onPress={() => go(`/menus/${menu.id}/card`)} />
            {status === 'on' ? <MenuAction label="Study" icon="book" onPress={() => go('/study/tonight')} /> : null}
            {status === 'on' || status === 'upcoming' ? <MenuAction label="Prep" icon="flask" onPress={() => go('/prep')} /> : null}
          </View>
          {drinkCount === 0 ? <Body tone="muted">No drinks on this menu yet.</Body> : <MenuSections sections={menu.sections} variant="page" />}
        </View>
      </ScrollView>
      <View style={[styles.topBar, { top: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to Menus" onPress={back} onMedia={!!hero} />
        {canEdit ? <GlassButton icon="ellipsis" accessibilityLabel="More: duplicate, take off, delete" onPress={() => setMore(true)} onMedia={!!hero} /> : null}
      </View>
      {night ? <HomeNightSheet menu={menu} onClose={() => setNight(false)} /> : null}
      {more ? <MenuMoreSheet menu={menu} status={status} visible onClose={() => setMore(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { gap: space.lg },
  body: { width: '100%', alignSelf: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  action: { flex: 1, minHeight: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: space.xs, borderCurve: 'continuous' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
});
