import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, LockedSection, TextLink } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { groupMenus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { MenuCard, MenuListRow, MenuPastLine } from './MenuRows';

/** A group's label: mono caps, the only caps on the list. */
export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.title}>
        {title.toUpperCase()}
      </Caption>
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
}

/**
 * Menus in the same groups in both modes (menus-one-look): the first menu
 * (on now, else the next) as a card, then Coming up, Drafts and R&D as rows,
 * and Past as lines. The Menus screen and Collection's Menus both draw this.
 */
export function MenuGroupList({ menus, now, canBuild, opensAt = 'Drink Creator', note, pastShown, onAllPast }: MenuGroupListProps) {
  const g = groupMenus(menus, now);
  // The first menu gets the card: what's on, else the next one.
  const lead = g.on.length ? g.on : g.upcoming.slice(0, 1);
  const comingUp = g.on.length ? g.upcoming : g.upcoming.slice(1);
  return (
    <>
      {lead.length ? (
        <MenuGroup title={g.on.length ? 'On now' : 'Coming up'}>
          {lead.map((m) => (
            <MenuCard key={m.id} menu={m} now={now} note={note?.(m)} />
          ))}
        </MenuGroup>
      ) : null}
      {comingUp.length ? (
        <MenuGroup title="Coming up">
          {comingUp.map((m) => (
            <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} />
          ))}
        </MenuGroup>
      ) : null}
      {g.draft.length ? (
        canBuild ? (
          <MenuGroup title="Drafts">
            {g.draft.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} />
            ))}
          </MenuGroup>
        ) : (
          <LockedSection title={`Drafts · ${plural(g.draft.length, 'menu')}`} unlocked={false} opensAt={opensAt}>
            {null}
          </LockedSection>
        )
      ) : null}
      {g.previous.length ? (
        <MenuGroup title="Past">
          <View>
            {g.previous.slice(0, pastShown).map((m) => (
              <MenuPastLine key={m.id} menu={m} />
            ))}
          </View>
          {pastShown !== undefined && onAllPast && g.previous.length > pastShown ? <TextLink label={`All ${g.previous.length}`} onPress={onAllPast} /> : null}
        </MenuGroup>
      ) : null}
      {g.rnd.length && canBuild ? (
        <MenuGroup title="R&D">
          {g.rnd.map((m) => (
            <MenuListRow key={m.id} menu={m} now={now} note={note?.(m)} />
          ))}
        </MenuGroup>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  title: { letterSpacing: 1.5, fontFamily: fontFamilies.mono },
});
