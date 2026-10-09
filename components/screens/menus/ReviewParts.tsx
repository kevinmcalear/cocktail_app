import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { menuReadiness, plural } from '@/lib/menus';
import type { MenuDrink, MenuSectionDetail } from '@/types/menus';

import { MenuVisual } from './MenuVisual';

interface CardHeaderProps {
  name: string;
  /** "Fri 31 Oct · 6 guests", "From 8 October": what the card says about when. */
  when?: string | null;
  coverUrl: string | null;
  coverPosition?: number;
  drinks: MenuDrink[];
}

/**
 * The top of a review step, on paper like the add-drink wizard's band: the
 * menu's pictures (its cover, or its drinks side by side) and its name.
 */
export function CardHeader(props: CardHeaderProps) {
  return (
    <BackbarTheme scheme="light">
      <Paper {...props} />
    </BackbarTheme>
  );
}

function Paper({ name, when, coverUrl, coverPosition, drinks }: CardHeaderProps) {
  const ds = useDs();
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
      <MenuVisual name={name} coverUrl={coverUrl} coverPosition={coverPosition} pictures={drinks} height={112} />
      <View style={styles.paperText}>
        <DsText variant="title" align="center">
          {name}
        </DsText>
        {when ? (
          <Caption tone="muted" align="center">
            {when}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

/** One thing to check before the menu goes out: done, or still to do. */
export function Check({ label, note, done = false, action }: { label: string; note?: string; done?: boolean; action?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.check, { borderBottomColor: ds.c.line }]}>
      <IconSymbol name={done ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={18} color={done ? ds.c.ink : ds.c.muted} />
      <View style={styles.checkText}>
        <Body accessibilityLabel={`${label}${done ? ', done' : ', to do'}`}>{label}</Body>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {action}
      </View>
    </View>
  );
}

/**
 * What a menu needs before it goes out, as Check rows: its sections' rules,
 * and for a venue, photos and prices (which don't stop it going on). A home
 * menu has no photos to shoot or prices to set.
 */
export function ReadyChecks({ sections, home }: { sections: Pick<MenuSectionDetail, 'name' | 'minItems' | 'maxItems' | 'drinks'>[]; home: boolean }) {
  const ready = menuReadiness({ sections });
  const empty = !sections.some((s) => s.drinks.length);
  const rules = [
    ...ready.short.map((s) => `${s.name} needs ${plural(s.needed, 'more drink')}`),
    ...ready.over.map((s) => `${s.name} has ${plural(s.extra, 'drink')} too many`),
  ];
  return (
    <>
      {empty ? <Check label="Add some drinks first" /> : rules.length ? rules.map((l) => <Check key={l} label={l} />) : <Check done label="Every section has what it needs" />}
      {home || empty ? null : (
        <>
          <Check
            done={!ready.needsPhoto.length}
            label={ready.needsPhoto.length ? `${plural(ready.needsPhoto.length, 'drink')} still need${ready.needsPhoto.length === 1 ? 's' : ''} a photo` : 'Every drink has a photo'}
            note={ready.needsPhoto.length ? 'Sketches show until then.' : undefined}
          />
          <Check done={!ready.noPrice.length} label={ready.noPrice.length ? `${plural(ready.noPrice.length, 'drink')} with no price` : 'Every drink has a price'} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  paperText: { paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  checkText: { flex: 1, gap: space.xs },
});
