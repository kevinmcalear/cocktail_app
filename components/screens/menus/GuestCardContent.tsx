import { StyleSheet, View } from 'react-native';

import { Caption, DsText, LogoImage, useDs } from '@/components/ds';
import { logoFill } from '@/components/nav/VenueMarks';
import { displayFaces, font, radius, space } from '@/constants/tokens';
import type { Venue } from '@/hooks/useActiveVenue';
import type { MenuSectionDetail } from '@/types/menus';

import { MenuSections, type CardPictures } from './MenuSections';

/** The venue's logo, or its initial in the display italic on its accent, small at the card's foot. */
function VenueMark({ venue }: { venue: Venue }) {
  const ds = useDs();
  if (venue.logoUrl) {
    return <LogoImage uri={venue.logoUrl} size={styles.mark.width} radius={styles.mark.borderRadius} fill={logoFill(venue)} />;
  }
  return (
    <View style={[styles.mark, { backgroundColor: ds.accentFill.fill }]} aria-hidden>
      <DsText variant="body" color={ds.accentFill.text} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
        {venue.name.slice(0, 1)}
      </DsText>
    </View>
  );
}

interface GuestCardContentProps {
  name: string;
  /** The eyebrow: "Friday 31 October", "From Mon 1 December" (lib/menus cardWhen). */
  when: string | null;
  venue: Venue | null;
  sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[];
  pictures: CardPictures;
  /** Smaller type and pictures: the editor's live preview beside the menu. */
  compact?: boolean;
  /** Drinks not made yet (New menu's pasted list), marked NEW and not drawn. */
  newIds?: ReadonlySet<string>;
}

/**
 * The card itself: when (an eyebrow), the menu's name in the display face, "at
 * Little Rye" in italic, a rule, its sections with a QR code under each drink
 * that opens its page, and a foot: the drawings note, "Scan a code to open the
 * drink" and the venue's mark. The editor's preview (`compact`) is just when,
 * name and sections. Inside the light theme, on paper.
 */
export function GuestCardContent({ name, when, venue, sections, pictures, compact = false, newIds }: GuestCardContentProps) {
  const ds = useDs();
  return (
    <View style={styles.card}>
      {when ? (
        <Caption tone="muted" style={styles.eyebrow}>
          {when.toUpperCase()}
        </Caption>
      ) : null}
      <DsText variant={compact ? 'title' : 'display'} role="heading" align="center">
        {name}
      </DsText>
      {venue && !compact ? (
        <DsText variant="headline" align="center" tone="muted" style={[styles.at, { fontFamily: displayFaces[ds.displayFace].italic }]}>
          {`at ${venue.name}`}
        </DsText>
      ) : null}
      <View style={[styles.rule, compact && styles.ruleCompact, { backgroundColor: ds.c.lineStrong }]} />
      {/* Each section's own name heads it (a one-section menu's "Drinks" included): no extra heading. */}
      <View style={styles.sections}>
        <MenuSections
          sections={sections}
          variant="card"
          pictures={pictures}
          newIds={newIds}
          compact={compact}
          codes={!compact}
          foot={
            compact ? undefined : (
              <View style={styles.scan}>
                <Caption tone="muted">Scan a code to open the drink</Caption>
                {venue ? <VenueMark venue={venue} /> : null}
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 656, alignItems: 'center', gap: space.sm },
  mark: { width: 28, height: 28, borderRadius: radius.mark * 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  eyebrow: { ...font.figures, letterSpacing: 1.5, textAlign: 'center' },
  at: { marginTop: -space.xs },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  ruleCompact: { marginVertical: space.sm },
  sections: { width: '100%' },
});
