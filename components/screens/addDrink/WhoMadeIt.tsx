import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { PickList } from '@/components/search/NearPicks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { usePublicPeople, type PublicPerson } from '@/hooks/useProfiles';
import type { MaybeNear } from '@/hooks/useSearchNear';
import type { StepProps } from '@/lib/drinkWizard';
import { addMaker, askLines, asked, makers, removeMaker } from '@/lib/whoMadeIt';

import { Eyebrow } from './WizardChrome';

/**
 * Who made it (board w2-wizard-steps, Q24): one list, you on it to start,
 * Add someone searching names and @handles, an x to take each off. Anyone
 * else saved as made with is asked first (#899), and the line under the
 * list says so (board w3-credits-to-check).
 */
export function WhoMadeIt({ draft, set, venueName }: StepProps & { venueName: string | null }) {
  const ds = useDs();
  const mine = useMyProfile();
  const profile = mine.data ?? null;
  const me = profile ? { id: profile.id, name: profile.displayName } : null;
  const [who, setWho] = useState('');
  const people = usePublicPeople(who, { near: true }).data ?? [];
  const list = makers(draft, me);
  const waiting = asked(draft, me);
  return (
    <View style={styles.section}>
      <Eyebrow>Who made it</Eyebrow>
      {list.length ? (
        <View role="list" accessibilityLabel="Who made it" style={[styles.list, { borderColor: ds.c.line }]}>
          {list.map((m, i) => (
            <View key={m.id ?? m.name} role="listitem" style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line }]}>
              <UserAvatar name={m.name} size={36} neutral={m.me} />
              <View style={styles.flex}>
                <DsText variant="body" color={ds.c.ink} style={styles.name} numberOfLines={1}>
                  {m.name}
                </DsText>
                <Caption tone="muted" numberOfLines={1}>
                  {m.me ? ['You', venueName].filter(Boolean).join(' · ') : (m.sub ?? '')}
                </Caption>
              </View>
              {waiting.some((w) => w.id === m.id) ? (
                <View role="img" aria-label={`Waiting for ${m.name} to say yes`}>
                  <IconSymbol name="clock" size={16} color={ds.c.muted} />
                </View>
              ) : null}
              <PressableScale role="button" accessibilityLabel={`Take ${m.me ? 'yourself' : m.name} off`} hitSlop={8} onPress={() => set(removeMaker(draft, me, m))} style={styles.remove}>
                <IconSymbol name="xmark" size={16} color={ds.c.muted} />
              </PressableScale>
            </View>
          ))}
        </View>
      ) : null}
      {askLines(waiting).map((line) => (
        <Caption key={line} tone="muted">
          {line}
        </Caption>
      ))}
      <Field label="Add someone" value={who} onChangeText={setWho} placeholder="Full name or @handle" autoCapitalize="words" autoCorrect={false} maxLength={60} />
      {/* Results wait for your profile, so the first person picked can't take your place on the list. */}
      {who.trim().length >= 2 && !mine.isLoading ? (
        <PickList
          rows={people.filter((p) => !list.some((m) => m.id === p.id)).map(personRow)}
          empty="Nobody by that name or handle has a public profile yet."
          no="No, it’s someone else"
          onPick={(id) => {
            const p = people.find((x) => x.id === id);
            if (p) set(addMaker(draft, me, { id: p.id, name: p.display_name, sub: personSub(p), claimed: p.is_claimed }));
            setWho('');
          }}
        />
      ) : null}
      <Caption tone="muted">{me ? 'Take everyone off and it saves as Not sure.' : 'Make a profile on the You tab to take credit for your drinks.'}</Caption>
      {venueName ? <Caption tone="muted">{`It’s credited to ${venueName} too.`}</Caption> : null}
    </View>
  );
}

/** "@sam.ortiz · Little Rye": their handle, then where they work now (else their city), so two Sams can be told apart. */
const personSub = (p: PublicPerson) => [`@${p.handle}`, p.current_bar ?? p.city].filter(Boolean).join(' · ');

function personRow(p: MaybeNear<PublicPerson>) {
  return { id: p.id, label: p.display_name, sub: personSub(p), near: p.near };
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamilies.bodySemiBold },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
