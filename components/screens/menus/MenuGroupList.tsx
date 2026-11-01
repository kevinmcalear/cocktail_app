import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, LockedSection, useDs } from '@/components/ds';
import { font, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import { groupMenus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { MenuCard, MenuListRow, MenuPastLine, MenuRowFrame } from './MenuRows';

/** A group's label in small capitals, with a dot (green on now, amber drafts) and a note at the right ("Your team only"). */
export function MenuGroup({ title, dot, aside, children }: { title: string; dot?: 'green' | 'amber'; aside?: string; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.group}>
      <View style={styles.head}>
        {dot ? <View style={[styles.dot, { backgroundColor: readableAccent(dot === 'green' ? STATUS.success : STATUS.warning, ds.c.ground) }]} /> : null}
        <Caption tone="muted" role="heading" style={[styles.title, styles.grow]}>
          {title.toUpperCase()}
        </Caption>
        {aside ? (
          <Caption tone="muted" style={styles.title}>
            {aside.toUpperCase()}
          </Caption>
        ) : null}
      </View>
      {children}
    </View>
  );
}

interface MenuGroupListProps {
  /** One venue's menus, or your own: never both. */
  menus: MenuSummary[];
  now: number;
  /** Drafts and R&D show; without, drafts are a locked section that opens at `opensAt`. */
  canBuild: boolean;
  opensAt?: string;
  /** Added to a menu's line, like how many of its drinks you can make. */
  note?: (menu: MenuSummary) => string | undefined;
  /** Past shows this many, then "All N" (Collection, where more follows below). */
  pastShown?: number;
  onAllPast?: () => void;
  /** A bar's team: Our drinks, every drink with its runs, under Past (Menu-l-drinks; the way in isn't drawn). */
  onOurDrinks?: () => void;
}

/**
 * Menus in the same groups in both modes (menus-one-look): the first menu
 * (on now, else the next) as a card, then Coming up, Drafts and R&D as rows,
 * and Past as lines. The Menus screen and Collection's Menus both draw this.
 */
export function MenuGroupList({ menus, now, canBuild, opensAt = 'Drink Creator', note, pastShown, onAllPast, onOurDrinks }: MenuGroupListProps) {
  const g = groupMenus(menus, now);
  const home = menus.every((m) => !m.barId);
  // The first menu gets the card: what's on, else the next one.
  const lead = g.on.length ? g.on : g.upcoming.slice(0, 1);
  const comingUp = g.on.length ? g.upcoming : g.upcoming.slice(1);
  return (
    <>
      {lead.length ? (
        <MenuGroup title={g.on.length ? 'On now' : 'Coming up'} dot={g.on.length ? 'green' : undefined}>
          {lead.map((m) => (
            <MenuCard key={m.id} menu={m} now={now} note={note?.(m)} />
          ))}
        </MenuGroup>
      ) : null}
      {comingUp.length ? (
        <MenuGroup title="Coming up">
          {comingUp.map((m) => (
            <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} ruled />
          ))}
        </MenuGroup>
      ) : null}
      {g.draft.length ? (
        canBuild ? (
          <MenuGroup title="Drafts" dot="amber" aside={home ? undefined : 'Your team only'}>
            {g.draft.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} ruled />
            ))}
          </MenuGroup>
        ) : (
          <LockedSection title={`Drafts · ${plural(g.draft.length, 'menu')}`} unlocked={false} opensAt={opensAt}>
            {null}
          </LockedSection>
        )
      ) : null}
      {g.previous.length || (onOurDrinks && !home) ? (
        <MenuGroup title={home ? 'Past nights' : 'Past'}>
          <View>
            {g.previous.slice(0, pastShown).map((m) => (
              <MenuPastLine key={m.id} menu={m} />
            ))}
          </View>
          {pastShown !== undefined && onAllPast && g.previous.length > 0 ? (
            <MenuRowFrame ruled label={`All past menus, ${g.previous.length}`} onPress={onAllPast} thumb={null} name={home ? 'All past nights' : 'All past menus'} line={`${g.previous.length} since ${new Date(g.previous[g.previous.length - 1].startsAt ?? g.previous[g.previous.length - 1].createdAt).getFullYear()}`} />
          ) : null}
          {onOurDrinks && !home ? <MenuRowFrame ruled label="Our drinks, every drink with its runs" onPress={onOurDrinks} thumb={null} name="Our drinks" line="Every drink with its runs, and Bring back" /> : null}
        </MenuGroup>
      ) : null}
      {g.rnd.length && canBuild ? (
        <MenuGroup title="R&D">
          {g.rnd.map((m) => (
            <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} ruled />
          ))}
        </MenuGroup>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  grow: { flex: 1 },
  title: { letterSpacing: 1.5, ...font.medium },
});
