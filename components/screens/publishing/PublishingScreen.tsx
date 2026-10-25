import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DsText, Field, GlassButton, Headline, PressableScale, Surface, Title, useDs, useGutter } from '@/components/ds';
import { Crumbs, usePageFrame } from '@/components/nav/PageFrame';
import { WebHead } from '@/components/WebHead';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useSaveProfileInstagram } from '@/hooks/useMyProfile';
import { useBarPublishing, useSetPublish } from '@/hooks/usePublishing';
import { instagramProblem } from '@/lib/profiles';
import { nextPageChange } from '@/lib/pageVisibility';

import { SwitchRow } from '../settings/SettingsParts';

import { MakerDetailsEditor } from './MakerDetailsEditor';
import { PageVisibilityChoice } from './PageVisibilityChoice';
import { PublishChoice } from './PublishChoice';
import { ReleaseList } from './ReleaseList';

/** The bar’s Instagram, on the public page. Only someone who can publish here can change it. */
function InstagramEditor({ profileId, initial }: { profileId: string; initial: string }) {
  const save = useSaveProfileInstagram();
  const [value, setValue] = useState(initial);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const problem = tried ? instagramProblem(value) : undefined;
  return (
    // The field, with Save beside it (below it when there isn't room).
    <View style={styles.ig}>
      <View style={styles.igField}>
        <Field
          label="Instagram"
          value={value}
          onChangeText={(next) => {
            setValue(next);
            setTried(false);
            setSaved(false);
          }}
          error={problem || (save.error ? save.error.message : undefined)}
          hint={saved ? 'Saved. It shows on the public page.' : 'Optional. A name like @little.rye, or the link to the bar’s Instagram.'}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
      </View>
      <Button
        label="Save Instagram"
        variant="secondary"
        disabled={save.isPending}
        onPress={() => {
          setTried(true);
          if (instagramProblem(value)) return;
          save.mutate({ id: profileId, raw: value }, { onSuccess: () => setSaved(true) });
        }}
      />
    </View>
  );
}

/**
 * A venue's publishing settings: the bar's default, each menu's setting, and
 * how many drinks the public sees. Single drinks and ingredients override on
 * their own pages. Anyone at the venue can look; changes need the publish
 * permission, which the database checks too.
 */
export function PublishingScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <PublishingPage barId={barId} />
    </BackbarTheme>
  );
}

function PublishingPage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const frame = usePageFrame('text');
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const { data: caps = [] } = useCapabilities(barId);
  const { data, isLoading, error } = useBarPublishing(barId);
  const set = useSetPublish(barId);
  const canPublish = caps.includes('publish');
  // A phone leads with who sees the page and links to the rest (tools-publishing-phone); wide shows it all.
  const more = useLocalSearchParams<{ part?: string }>().part === 'more';
  const lead = frame.wide || !more;
  const rest = frame.wide || more;
  const venueName = venue?.name ?? 'the venue';
  const n = (count: number) => <DsText style={styles.num}>{count}</DsText>;
  const errorFor = (key: string) => {
    const v = set.variables;
    return set.error && v && (v.level === 'bar' || v.level === 'page' || v.level === 'changes' ? v.level : v.id) === key ? set.error.message : null;
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Publishing</title>
      </WebHead>
      <ScrollView
        contentContainerStyle={{
          paddingTop: frame.wide ? frame.top : insets.top + layout.minTapTarget + space.xl,
          paddingBottom: insets.bottom + space.xxxl,
          paddingHorizontal: gutter,
        }}
      >
        <View style={[frame.column, styles.readable]}>
          {/* Wide web: the trail back instead of a Back button (the sidebar is there). */}
          {frame.wide ? (
            <Crumbs
              trail={[
                {
                  label: 'Venue settings',
                  href: `/settings/bar/${barId}` as Href,
                },
              ]}
            />
          ) : null}
          <Title>Publishing</Title>
          <Body tone="muted">
            {frame.wide
              ? `Who outside ${venueName} can see its drinks. Set a default for the bar, open or close whole menus, and override single drinks and ingredients on their own pages.`
              : more
                ? 'Spec changes, the bar’s default, menus and releases.'
                : `Who outside ${venueName} can see its drinks.`}
          </Body>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the settings. Check your connection and try again.</Body> : null}
          {data ? (
            <>
              <Surface style={styles.card}>
                {data.profile ? (
                  <>
                    {lead ? (
                      <Body>
                        Right now the public sees {n(data.counts.spec)} {data.counts.spec === 1 ? 'drink' : 'drinks'} with the full spec and {n(data.counts.description)} as a menu
                        card. {n(data.counts.private)} {data.counts.private === 1 ? 'stays' : 'stay'} private.
                      </Body>
                    ) : null}
                    {rest ? (
                      <View style={styles.start}>
                        <Button
                          label="See the public page"
                          variant="secondary"
                          icon="globe"
                          onPress={() => router.push(`/p/${data.profile!.handle ?? data.profile!.id}` as Href)}
                        />
                      </View>
                    ) : null}
                    {rest && canPublish ? <View style={[styles.rule, { backgroundColor: ds.c.line }]} /> : null}
                    {rest && canPublish ? <InstagramEditor profileId={data.profile.id} initial={data.profile.instagram ?? ''} /> : null}
                    {rest && canPublish && data.profile.kind === 'maker' ? (
                      <MakerDetailsEditor profileId={data.profile.id} makes={data.profile.makes ?? []} serves={data.profile.serves ?? []} />
                    ) : null}
                  </>
                ) : (
                  <Body>Nothing goes public until the venue has a public page. Find it on the map and claim it for this venue, then come back here.</Body>
                )}
                {canPublish ? null : <Caption tone="muted">You can look, but changing these needs the publish permission at this venue.</Caption>}
              </Surface>

              {data.profile && lead ? (
                <PageVisibilityChoice
                  radios
                  venueName={venueName}
                  value={data.pageVisibility}
                  privateAllowed={data.privateAllowed}
                  note={changeNote(data.pageChangedAt)}
                  disabled={!canPublish || set.isPending}
                  error={errorFor('page')}
                  onChange={(visibility) => set.mutate({ level: 'page', visibility })}
                />
              ) : null}
              {lead && !rest ? (
                <PressableScale
                  role="link"
                  accessibilityLabel="Spec changes, the bar’s default, menus and releases"
                  onPress={() => router.push(`/settings/bar/${barId}/publishing?part=more` as Href)}
                >
                  <Body color={ds.accentText}>Spec changes, the bar’s default, menus and releases ›</Body>
                </PressableScale>
              ) : null}

              {data.profile && rest ? (
                <View style={styles.group}>
                  <Headline role="heading">Spec changes</Headline>
                  <Surface>
                    <SwitchRow
                      label="Show how specs changed"
                      detail="Guests who can see a drink’s spec also see each saved change to it, with the date. Never who made it, version notes or bartender notes."
                      value={data.showSpecChanges}
                      disabled={!canPublish || set.isPending}
                      onValueChange={(show) => set.mutate({ level: 'changes', show })}
                    />
                  </Surface>
                  {errorFor('changes') ? (
                    <Caption tone="accent" role="alert">
                      {errorFor('changes')}
                    </Caption>
                  ) : null}
                </View>
              ) : null}

              {rest ? (
                <View style={styles.group}>
                  <Headline role="heading">The bar’s default</Headline>
                  <Caption tone="muted">For every drink and ingredient that doesn’t say otherwise and isn’t on a menu with its own setting.</Caption>
                  <PublishChoice
                    radios
                    label="The bar's default"
                    value={data.barDefault}
                    disabled={!canPublish || set.isPending}
                    error={errorFor('bar')}
                    onChange={(mode) => mode && set.mutate({ level: 'bar', mode })}
                  />
                </View>
              ) : null}

              {rest ? (
                <View style={styles.group}>
                  <Headline role="heading">Menus</Headline>
                  <Caption tone="muted">
                    A menu’s setting covers every drink on it. When a drink is on more than one menu, the most open one wins, and a drink’s own setting beats them all.
                  </Caption>
                  {data.menus.length ? null : <Body tone="muted">No menus yet.</Body>}
                  <View role="list">
                    {data.menus.map((m) => (
                      <View key={m.id} role="listitem" style={[styles.menu, { borderBottomColor: ds.c.line }]}>
                        <View>
                          <Body>{m.name}</Body>
                          <Caption tone="muted">{`${m.status} · ${m.drinkCount} ${m.drinkCount === 1 ? 'drink' : 'drinks'}`}</Caption>
                        </View>
                        <PublishChoice
                          compact
                          radios
                          label={`Who can see ${m.name}`}
                          value={m.publish_mode}
                          inherited={{ mode: data.barDefault, source: 'bar' }}
                          disabled={!canPublish || set.isPending}
                          error={errorFor(m.id)}
                          onChange={(mode) => set.mutate({ level: 'menu', id: m.id, mode })}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {canPublish && rest ? <ReleaseList barId={barId} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      {frame.wide ? null : (
        <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
          <GlassButton
            accessibilityLabel="Back"
            icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          />
        </View>
      )}
    </View>
  );
}

/** The line under the choice: the 30-day rule, and when the next change opens if it's waiting. */
function changeNote(changedAt: string | null): string {
  const next = nextPageChange(changedAt);
  const when = next ? ` Your next change opens ${next.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.` : '';
  return `Any single drink can still be kept private from its own page. You can change this once every 30 days.${when}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { gap: space.lg },
  controls: { position: 'absolute' },
  card: { gap: space.lg, paddingVertical: space.lg },
  ig: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  igField: { flexGrow: 1, flexBasis: 260 },
  start: { alignItems: 'flex-start' },
  rule: { height: StyleSheet.hairlineWidth },
  num: { fontFamily: fontFamilies.mono },
  group: { gap: space.sm },
  menu: {
    gap: space.sm,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
