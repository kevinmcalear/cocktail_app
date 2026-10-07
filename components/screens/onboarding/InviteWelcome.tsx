import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Display, DsText, useDs, useGutter } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueSwitcher';
import { WebHead } from '@/components/WebHead';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useAcceptInvite, useRemoveInvite, type MyInvite } from '@/hooks/useBarInvites';
import { faceFromDb, usableGroundTint } from '@/lib/brand';
import { isHexColor } from '@/lib/color';
import { INVITE_STEP_NAMES, withArticle } from '@/lib/onboarding';
import { roleLabel } from '@/lib/roles';

interface InviteWelcomeProps {
  invite: MyInvite;
  onJoined: () => void;
  onDeclined: () => void;
}

/**
 * Onboarding's first page for someone a venue invited, in the venue's own
 * brand: who invited them and as what, the three short steps, then accept
 * (the short setup follows) or decline (the invite goes, the usual setup runs).
 */
export function InviteWelcome(props: InviteWelcomeProps) {
  const { invite } = props;
  return (
    <BackbarTheme>
      <BrandProvider
        accent={isHexColor(invite.bar_color) ? invite.bar_color : undefined}
        displayFace={faceFromDb(invite.bar_display_face)}
        groundTint={usableGroundTint(invite.bar_ground_tint) ?? undefined}
      >
        <Welcome {...props} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function Welcome({ invite, onJoined, onDeclined }: InviteWelcomeProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const accept = useAcceptInvite(invite.bar_id);
  const decline = useRemoveInvite(invite.bar_id);
  const busy = accept.isPending || decline.isPending;
  const who = invite.invited_by_name ?? invite.bar_name;
  const venue = {
    id: invite.bar_id,
    name: invite.bar_name,
    logoUrl: invite.bar_logo_url,
    accent: isHexColor(invite.bar_color) ? invite.bar_color : null,
    displayFace: faceFromDb(invite.bar_display_face),
    groundTint: null,
    roleLevel: invite.role_level,
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{`Join ${invite.bar_name}`}</title>
      </WebHead>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.intro}>
            <View style={[styles.mark, { borderColor: ds.accentText }]}>
              <VenueMark venue={venue} size={88} />
            </View>
            <Caption tone="accent" style={styles.kicker}>
              YOU’RE INVITED
            </Caption>
            <Display>{`Join ${invite.bar_name} as ${withArticle(roleLabel(invite.role_level))}`}</Display>
            <Body tone="muted">{`${who} added you. Three quick steps and you’ll see tonight’s menu and every spec.`}</Body>
            <View accessibilityLabel="Three steps" style={styles.steps}>
              {INVITE_STEP_NAMES.map((name, i) => (
                <View key={name} style={styles.step}>
                  <View
                    style={[
                      styles.number,
                      i === 0 ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong },
                    ]}
                  >
                    <DsText variant="caption" color={i === 0 ? ds.accentFill.text : ds.c.muted}>
                      {String(i + 1)}
                    </DsText>
                  </View>
                  <Body>{name}</Body>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            {accept.error || decline.error ? (
              <Caption tone="accent" role="alert">
                Couldn’t save that. Check your connection and try again.
              </Caption>
            ) : null}
            <Button
              label={accept.isPending ? 'Joining…' : 'Accept and start'}
              size="lg"
              disabled={busy}
              onPress={() => accept.mutate(undefined, { onSuccess: onJoined })}
            />
            <Button label="Not me? Decline" variant="ghost" disabled={busy} onPress={() => decline.mutate(invite.id, { onSuccess: onDeclined })} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'space-between', gap: space.xxl },
  intro: { gap: space.md },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  kicker: { letterSpacing: 0.8, fontFamily: fontFamilies.bodySemiBold },
  steps: { gap: space.xs, marginTop: space.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  number: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: space.sm },
});
