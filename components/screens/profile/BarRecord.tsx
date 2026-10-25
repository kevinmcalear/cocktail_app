import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useMenuEditions, useProfileAwards } from '@/hooks/useProfiles';
import { awardInitials, groupAwards } from '@/lib/awards';

import { ReportSheet } from '../safety/ReportSheet';
import { AWARD_LOGOS } from './awardLogos';
import { PublicMenus } from './PublicMenus';

const GROUPS_SHOWN = 3;

/**
 * A profile's awards, one row per list: its places as year chips
 * ("2025 · No. 1") and its titles as lines under them. Each opens the list it
 * came from. Long records start folded. Nothing when there are none.
 */
export function Awards({ profileId }: { profileId: string }) {
  const ds = useDs();
  const [all, setAll] = useState(false);
  const { data = [] } = useProfileAwards(profileId);
  const groups = groupAwards(data);
  if (!groups.length) return null;
  const shown = all ? groups : groups.slice(0, GROUPS_SHOWN);
  return (
    <View style={styles.section}>
      <Caption tone="muted" style={styles.cap}>
        Awards
      </Caption>
      <View role="list">
        {shown.map((g) => (
          <View key={g.award} role="listitem" style={[styles.award, { borderBottomColor: ds.c.line }]}>
            <View style={styles.awardHead}>
              <View style={[styles.logo, { backgroundColor: ds.c.paper, borderColor: ds.c.line }]} aria-hidden>
                {AWARD_LOGOS[g.award] ? (
                  <Image source={AWARD_LOGOS[g.award]} style={styles.logoImg} contentFit="contain" accessible={false} />
                ) : (
                  <DsText variant="caption" style={{ color: ds.c.sketchInk }}>
                    {awardInitials(g.award)}
                  </DsText>
                )}
              </View>
              <DsText variant="headline" style={styles.flex}>
                {g.award}
              </DsText>
              {g.best !== null ? <Caption tone="muted">{`Best: No. ${g.best}`}</Caption> : null}
            </View>
            {g.places.length ? (
              <View style={styles.chips}>
                {g.places.map((a) => (
                  <SourceLink key={a.id} url={a.source_url} label={`No. ${a.position}, ${g.award} ${a.year}`}>
                    <Tag label={`${a.year} · No. ${a.position}`} tone={a.position === 1 ? 'accent' : 'default'} />
                  </SourceLink>
                ))}
              </View>
            ) : null}
            {g.titles.map((a) => (
              <SourceLink key={a.id} url={a.source_url} label={`${a.title}, ${g.award} ${a.year}`}>
                <Caption>{`${a.year} · ${a.title}`}</Caption>
              </SourceLink>
            ))}
          </View>
        ))}
      </View>
      {groups.length > GROUPS_SHOWN ? (
        <Button label={all ? 'Show fewer' : `Show all ${data.length} awards`} variant="secondary" onPress={() => setAll((v) => !v)} />
      ) : null}
    </View>
  );
}

/** Opens where an award came from; plain text when there's no source. */
function SourceLink({ url, label, children }: { url: string | null; label: string; children: ReactNode }) {
  if (!url) return <View accessible accessibilityLabel={label}>{children}</View>;
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. Open the list`} onPress={() => void Linking.openURL(url)} style={styles.start}>
      {children}
    </PressableScale>
  );
}

/**
 * Every cocktail menu the bar has put out, in the band/line look
 * (menus-one-look): the one on now as a card, the rest as lines. Each opens
 * its menu, where it can be saved. Then where they came from.
 */
export function MenuHistory({ profileId, name }: { profileId: string; name: string }) {
  const ds = useDs();
  const { data = [] } = useMenuEditions(profileId);
  const [report, setReport] = useState(false);
  return (
    <View style={styles.section}>
      <PublicMenus profileId={profileId} name={name} />
      {data.length ? (
        <Caption tone="muted">
          {data.every((m) => m.from_venue) ? `From ${name}’s own menus. Something wrong? ` : 'From the bar’s site and press. Each menu links to its source. Something wrong? '}
          <Caption role="link" accessibilityLabel="Tell us what's wrong" onPress={() => setReport(true)} style={[styles.underline, { color: ds.accentText }]}>
            Tell us.
          </Caption>
        </Caption>
      ) : null}
      {report ? (
        <ReportSheet subject={`${name}'s menus`} targets={[{ label: name, target: { kind: 'profile', profileId } }]} onClose={() => setReport(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  award: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  awardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 44, height: 44, borderRadius: radius.control, borderCurve: 'continuous', padding: space.xs, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: '100%', height: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
});
