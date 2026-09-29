import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMenuEditions, useProfileAwards } from '@/hooks/useProfiles';
import { groupAwards } from '@/lib/awards';
import { menuDate, type MenuEdition } from '@/lib/menuEditions';

const FIRST_MENUS = 6;

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
            <View style={styles.head}>
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

/** Every cocktail menu the bar has put out, newest first, with the month and year it launched. */
export function MenuHistory({ profileId, name }: { profileId: string; name: string }) {
  const { data = [], isLoading } = useMenuEditions(profileId);
  const [all, setAll] = useState(false);
  if (isLoading) return <Caption tone="muted">Loading menus…</Caption>;
  if (!data.length) return <Body tone="muted">{`No menus from ${name} here yet.`}</Body>;
  const shown = all ? data : data.slice(0, FIRST_MENUS);
  return (
    <View style={styles.section}>
      <View role="list">
        {shown.map((m, i) => (
          <EditionRow key={m.id} edition={m} current={i === 0} />
        ))}
      </View>
      {data.length > FIRST_MENUS && !all ? (
        <Button label={`Show all ${data.length} menus`} variant="secondary" onPress={() => setAll(true)} />
      ) : null}
    </View>
  );
}

function EditionRow({ edition: m, current }: { edition: MenuEdition; current: boolean }) {
  const ds = useDs();
  const when = menuDate(m);
  const source = m.source_url;
  return (
    <View role="listitem" style={[styles.edition, { borderBottomColor: ds.c.line }]}>
      <View accessible accessibilityLabel={[`${m.name}, ${current ? 'latest menu, ' : ''}from ${when}`, m.theme, m.drinks.length ? `Drinks: ${m.drinks.join(', ')}` : null].filter(Boolean).join('. ')} style={styles.editionText}>
        <View style={styles.head}>
          <DsText variant="headline" style={styles.flex}>
            {m.name}
          </DsText>
          <Caption tone={current ? 'ink' : 'muted'}>{when}</Caption>
        </View>
        {m.theme ? <Body tone="muted">{m.theme}</Body> : null}
        {m.drinks.length ? <Caption tone="muted">{m.drinks.join(' · ')}</Caption> : null}
      </View>
      {source ? (
        <DsText variant="caption" tone="muted" role="link" accessibilityLabel={`Source for ${m.name}`} style={styles.link} onPress={() => Linking.openURL(source)}>
          {`Source: ${source.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]}`}
        </DsText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  award: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  edition: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  editionText: { gap: space.xs },
  start: { alignSelf: 'flex-start' },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
