import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { menuReadiness, plural } from '@/lib/menus';
import type { MenuDrink, MenuSectionDetail } from '@/types/menus';

import { MenuVisual } from './MenuVisual';

interface CardHeaderProps {
  name: string;
  /** "Friday 31 October", "From Mon 1 December": the eyebrow above the name. */
  when?: string | null;
  /** "Tap to see the whole card": opens the guest card. */
  onOpenCard?: () => void;
  coverUrl: string | null;
  coverPosition?: number;
  drinks: MenuDrink[];
}

/**
 * The top of a review step, on paper like the add-drink wizard's band: when
 * (an eyebrow), the menu's name, its pictures (its cover, or its drinks'
 * sketches side by side), and a link to the whole guest card.
 */
export function CardHeader(props: CardHeaderProps) {
  return (
    <BackbarTheme scheme="light">
      <Paper {...props} />
    </BackbarTheme>
  );
}

function Paper({ name, when, coverUrl, coverPosition, drinks, onOpenCard }: CardHeaderProps) {
  const ds = useDs();
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
      <View style={styles.paperText}>
        {when ? (
          <Caption tone="muted" align="center" style={styles.eyebrow}>
            {when.toUpperCase()}
          </Caption>
        ) : null}
        <DsText variant="title" align="center" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
      </View>
      <MenuVisual name={name} coverUrl={coverUrl} coverPosition={coverPosition} pictures={drinks} height={112} />
      {onOpenCard ? (
        <PressableScale role="link" accessibilityLabel="Tap to see the whole card" onPress={onOpenCard} style={styles.cardLink}>
          <Caption color={ds.c.sketchInk} style={styles.mono}>
            Tap to see the whole card
          </Caption>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * A label over a group, in Geist Mono capitals as the menu boards set them:
 * "READY TO GO ON?", "WHAT GUESTS SEE", "ADD TO STIRRED".
 */
export function MonoLabel({ children }: { children: string }) {
  return (
    <Caption tone="muted" style={styles.label} numberOfLines={1}>
      {children.toUpperCase()}
    </Caption>
  );
}

/** One thing to check before the menu goes out: done, or still to do. With `onPress` it opens what it names (a chevron says so). */
export function Check({ label, note, done = false, action, onPress }: { label: string; note?: string; done?: boolean; action?: ReactNode; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      <IconSymbol name={done ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={18} color={done ? ds.c.ink : ds.c.muted} />
      <View style={styles.checkText}>
        <Body accessibilityLabel={onPress ? undefined : `${label}${done ? ', done' : ', to do'}`}>{label}</Body>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {action}
      </View>
      {onPress ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.check, { borderBottomColor: ds.c.line }]}>{body}</View>;
  return (
    <PressableScale accessibilityLabel={`${label}${done ? ', done' : ', to do'}, open`} onPress={onPress} style={[styles.check, styles.checkRow, { borderBottomColor: ds.c.line }]}>
      {body}
    </PressableScale>
  );
}

/** What a checklist row opens. */
export type CheckTarget = { kind: 'section'; name: string } | { kind: 'dates' } | { kind: 'drink'; name: string };

/**
 * What a menu needs before it goes out, as Check rows in this order: its
 * sections' rules, for a venue's builder the dates (`dated`), then prices and
 * photos (which don't stop it going on). A home menu has no photos to shoot or
 * prices to set. With `onOpen`, each row that's still to do opens what it names.
 */
export function ReadyChecks({ sections, home, dated, onOpen }: {
  sections: Pick<MenuSectionDetail, 'name' | 'minItems' | 'maxItems' | 'drinks'>[];
  home: boolean;
  /** Builder only: whether the dates are picked (undefined leaves the row out). */
  dated?: boolean;
  onOpen?: (target: CheckTarget) => void;
}) {
  const ready = menuReadiness({ sections });
  const empty = !sections.some((s) => s.drinks.length);
  const open = (target: CheckTarget) => (onOpen ? () => onOpen(target) : undefined);
  const rules = [
    ...ready.short.map((s) => ({ name: s.name, label: `${s.name} needs ${plural(s.needed, 'more drink')}` })),
    ...ready.over.map((s) => ({ name: s.name, label: `${s.name} has ${plural(s.extra, 'drink')} too many` })),
  ];
  return (
    <>
      {empty ? (
        <Check label="Add some drinks first" />
      ) : rules.length ? (
        rules.map((r) => <Check key={r.label} label={r.label} onPress={open({ kind: 'section', name: r.name })} />)
      ) : (
        <Check done label="Every section has what it needs" />
      )}
      {home || dated === undefined ? null : (
        <Check done={dated} label={dated ? 'Dates picked' : 'Pick the dates'} note="It goes on at the start of that day." onPress={open({ kind: 'dates' })} />
      )}
      {home || empty ? null : (
        <>
          <Check
            done={!ready.noPrice.length}
            label={ready.noPrice.length ? `${plural(ready.noPrice.length, 'drink')} with no price` : 'Every drink has a price'}
            onPress={ready.noPrice.length ? open({ kind: 'drink', name: ready.noPrice[0] }) : undefined}
          />
          <Check
            done={!ready.needsPhoto.length}
            label={ready.needsPhoto.length ? `${plural(ready.needsPhoto.length, 'drink')} still need${ready.needsPhoto.length === 1 ? 's' : ''} a photo` : 'Every drink has a photo'}
            note={ready.needsPhoto.length ? 'Sketches show until then.' : undefined}
            onPress={ready.needsPhoto.length ? open({ kind: 'drink', name: ready.needsPhoto[0] }) : undefined}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  paperText: { paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2 },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.5 },
  cardLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  mono: { fontFamily: fontFamilies.mono },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.5 },
  checkRow: { alignItems: 'center' },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  checkText: { flex: 1, gap: space.xs },
});
