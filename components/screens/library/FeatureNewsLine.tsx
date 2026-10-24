import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useFeatureNews } from '@/hooks/useFeatureNews';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { withAlpha } from '@/lib/color';
import { featureIcon, featureLabel, featureTab, firstName, newsDetail, type FeatureEvent } from '@/lib/featureNews';
import { phoneTabs, venueTabs } from '@/lib/venueFeatures';

/**
 * "New at <venue>" at the top of the Library (whole-app canvas, Onboarding,
 * "Staff: something new at the venue"): the newest feature someone else
 * switched on, who and when, until you dismiss it. Nothing when there's no
 * news; hooks/useFeatureNews.ts decides what's news.
 */
export function FeatureNewsLine() {
  const { line, barId, venueName, markSeen } = useFeatureNews();
  const [gone, setGone] = useState<string | null>(null);
  if (!line || !barId || line.id === gone) return null;
  const dismiss = () => {
    setGone(line.id);
    markSeen(line, 'line');
  };
  return <Line key={line.id} barId={barId} venueName={venueName ?? 'your venue'} news={line} onDismiss={dismiss} />;
}

function Line({ barId, venueName, news, onDismiss }: { barId: string; venueName: string; news: FeatureEvent; onDismiss: () => void }) {
  const ds = useDs();
  const [now] = useState(Date.now);
  const { data: members } = useBarMembers(barId);
  const { has } = useVenueFeatures();
  const wide = useIsWideWeb();
  // "Look for this tab" only when it's in the bar (a phone's bar holds four) or the sidebar.
  const tab = featureTab(news.feature);
  const shown: string[] = wide ? venueTabs(has) : phoneTabs(false, has);
  const who = firstName(members?.find((m) => m.user_id === news.by_user)?.display_name);
  const label = `New at ${venueName}`;
  return (
    <View role="complementary" aria-label={label} style={[styles.line, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <View aria-hidden style={[styles.icon, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
        <IconSymbol name={featureIcon(news.feature)} size={22} color={ds.accentText} />
      </View>
      <View style={styles.words}>
        <Body style={styles.title}>{`${label}: ${featureLabel(news.feature)}`}</Body>
        <Caption tone="muted">{newsDetail(news, who, now, !!tab && shown.includes(tab))}</Caption>
      </View>
      <PressableScale role="button" aria-label="Dismiss" onPress={onDismiss} style={styles.dismiss}>
        <IconSymbol name="xmark" size={18} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  // The board's card: 12 above and below, 14 in on the left, 4 on the right for the 44pt dismiss.
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingLeft: space.md + 2, paddingRight: space.xs, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamilies.bodyMedium, lineHeight: 22 },
  dismiss: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
