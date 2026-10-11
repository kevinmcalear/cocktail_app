import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useProfilePositions, type Position, type Profile } from '@/hooks/useProfiles';
import { jobYears } from '@/lib/profiles';

import { pendingNote } from './JobRequests';

/**
 * Where someone works now, and each past job (many from public research on
 * unclaimed profiles) only once the person switches it on. RLS hides the rest
 * from everyone else; this keeps the owner's own view the same as theirs.
 */
export const isShownPosition = (p: Pick<Position, 'is_current' | 'is_shown'> & { is_hidden?: boolean }) => !p.is_hidden && (p.is_current || p.is_shown);

/**
 * "Works at" and "Previously" on a person, "Current team" and "Previous" on a
 * bar, so nobody reads a past job as a current one. Each row opens the other
 * profile. With emptyText it fills a tab, with a line when nobody is listed.
 */
export function Positions({ profile, emptyText }: { profile: Pick<Profile, 'id' | 'kind'>; emptyText?: string }) {
  const onPerson = profile.kind === 'person';
  // Filtered here, not in the query, so a persisted cache from before can't show them either.
  // A job someone added shows on their own page, marked, before the bar confirms it; never on the bar's.
  const positions = (useProfilePositions(profile).data ?? []).filter((p) => isShownPosition(p) && (onPerson || p.bar_accepted));
  if (!positions.length) return emptyText ? <Body tone="muted">{emptyText}</Body> : null;
  return (
    <View style={styles.sections}>
      <PositionList heading={onPerson ? 'Works at' : 'Current team'} positions={positions.filter((p) => p.is_current)} onPerson={onPerson} />
      <PositionList heading={onPerson ? 'Previously' : 'Previous'} positions={positions.filter((p) => !p.is_current)} onPerson={onPerson} />
    </View>
  );
}

function PositionList({ heading, positions, onPerson }: { heading: string; positions: Position[]; onPerson: boolean }) {
  const ds = useDs();
  const router = useRouter();
  if (!positions.length) return null;
  return (
    <View style={styles.section}>
      {onPerson ? (
        <Headline role="heading">{heading}</Headline>
      ) : (
        <Caption tone="muted" role="heading" style={styles.cap}>
          {heading}
        </Caption>
      )}
      <View role="list">
        {positions.map((p) => {
          const other = onPerson ? p.bar : p.person;
          const pending = pendingNote(p);
          const title = pending ? `${p.title} · ${pending}` : p.title;
          // On a person (ppl-person): the title first, then the bar and its years, then who confirmed it.
          const where = [other.display_name, jobYears(p)].filter(Boolean).join(' · ');
          const mark = p.bar_accepted ? `Confirmed by ${p.bar.display_name}` : 'Not confirmed by the bar yet';
          return (
            <PressableScale
              key={p.id}
              role="link"
              accessibilityLabel={onPerson ? `${p.title}, ${where}. ${mark}. Open the bar's profile` : `${other.display_name}, ${p.is_current ? title : `formerly ${title}`}. Open their profile`}
              onPress={() => router.push(`/p/${other.handle}` as Href)}
              style={[styles.row, { borderBottomColor: ds.c.line }]}
            >
              <UserAvatar uri={other.avatar_url} name={other.display_name} size={40} />
              {onPerson ? (
                <View style={styles.flex}>
                  <DsText variant="headline" numberOfLines={1}>
                    {p.title}
                  </DsText>
                  <Caption tone="muted" numberOfLines={1}>
                    {where}
                  </Caption>
                  <View style={styles.mark}>
                    {p.bar_accepted ? <IconSymbol name="checkmark.seal.fill" size={14} color={ds.accentText} /> : null}
                    <Caption tone={p.bar_accepted ? 'ink' : 'muted'}>{mark}</Caption>
                  </View>
                </View>
              ) : (
                <View style={styles.flex}>
                  <DsText variant="headline" numberOfLines={1}>
                    {other.display_name}
                  </DsText>
                  <Caption tone="muted" numberOfLines={pending ? 2 : 1}>
                    {title}
                  </Caption>
                </View>
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.lg },
  section: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
