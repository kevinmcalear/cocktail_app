import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Caption, DsText, Title, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { radius, space, type } from '@/constants/tokens';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { faceFromDb, usableGroundTint } from '@/lib/brand';
import { isHexColor } from '@/lib/color';
import { withArticle } from '@/lib/onboarding';
import { roleLabel } from '@/lib/roles';

interface InvitePreviewProps {
  barId: string;
  barName: string;
  roleLevel: number;
  /** Who sends it: the welcome is signed with their name. */
  sender: string | null;
  welcome: string;
  note?: string;
}

/**
 * The invite email as it arrives (invite-team-last, step 4), in the venue's
 * logo, colour, font and ground tint: who invited them, the welcome message, their own
 * note when there is one, and Join. A likeness of what send-bar-invite
 * builds; keep the two in step.
 */
export function InvitePreview({ barId, barName, roleLevel, sender, welcome, note }: InvitePreviewProps) {
  const brand = useVenueBrand(barId).data;
  const accent = isHexColor(brand?.primary_color) ? brand.primary_color : undefined;
  const groundTint = usableGroundTint(brand?.ground_tint);
  return (
    // The email is dark, whatever the app is in (invite-team-last, step 4).
    <BackbarTheme scheme="dark">
      <BrandProvider accent={accent} displayFace={faceFromDb(brand?.display_face)} groundTint={groundTint ?? undefined}>
        <Paper
          barId={barId}
          barName={barName}
          logoUrl={brand?.logo_url ?? null}
          accent={accent ?? null}
          displayFace={faceFromDb(brand?.display_face)}
          groundTint={groundTint}
          roleLevel={roleLevel}
          sender={sender}
          welcome={welcome.trim()}
          note={note?.trim()}
        />
      </BrandProvider>
    </BackbarTheme>
  );
}

function Paper({ barId, barName, logoUrl, accent, displayFace, groundTint, roleLevel, sender, welcome, note }: Omit<InvitePreviewProps, 'welcome'> & {
  welcome: string;
  logoUrl: string | null;
  accent: string | null;
  groundTint: string | null;
  displayFace: ReturnType<typeof faceFromDb>;
}) {
  const ds = useDs();
  const venue = { id: barId, name: barName, logoUrl, accent, displayFace, groundTint, roleLevel };
  return (
    <View role="group" accessibilityLabel="The invite email" style={[styles.paper, { backgroundColor: groundTint ? ds.c.ground : ds.c.surface, borderColor: ds.c.line }]}>
      {/* The venue's mark as the app draws it: its logo, or its initial on its colour. */}
      <VenueMark venue={venue} size={48} />
      <Caption tone="accent" style={styles.kicker}>{barName.toUpperCase()}</Caption>
      <Title>{`Join ${barName} as ${withArticle(roleLabel(roleLevel))}`}</Title>
      <Body tone="muted">{`${sender ?? barName} added you to the team.`}</Body>
      {welcome ? (
        <View style={styles.welcome}>
          <Body>{welcome}</Body>
          {sender ? <DsText variant="title" italic tone="muted" style={styles.signed}>{sender}</DsText> : null}
        </View>
      ) : null}
      {note ? (
        <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
          <Caption tone="accent">A note for you</Caption>
          <Body>{note}</Body>
        </View>
      ) : null}
      <View style={[styles.join, { backgroundColor: ds.accentFill.fill }]}>
        <DsText variant="label" color={ds.accentFill.text}>{`Join ${barName}`}</DsText>
      </View>
      <Caption tone="muted">Open it on the phone or computer you’ll use. The button signs you in for an hour; after that it asks for your email and sends a code.</Caption>
      <View style={[styles.foot, { borderTopColor: ds.c.line }]}>
        <Caption tone="muted">{`Sent with Cocktail for ${barName}. Not you? Ignore it: nobody joins without your email.`}</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { gap: space.md, padding: space.xl, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  kicker: { letterSpacing: 1, marginTop: space.sm },
  signed: { fontSize: type.headline.fontSize, lineHeight: type.headline.lineHeight },
  welcome: { gap: space.sm },
  note: { gap: space.xs, padding: space.lg, borderRadius: radius.control },
  join: { alignSelf: 'flex-start', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill },
  foot: { paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
