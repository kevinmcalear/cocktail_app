import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Field, GlassButton, Headline, Surface, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useSaveProfileInstagram } from '@/hooks/useMyProfile';
import { useBarPublishing, useSetPublish } from '@/hooks/usePublishing';
import { instagramProblem } from '@/lib/profiles';

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
    <View style={styles.ig}>
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
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const { data: caps = [] } = useCapabilities(barId);
  const { data, isLoading, error } = useBarPublishing(barId);
  const set = useSetPublish(barId);
  const canPublish = caps.includes('publish');
  const errorFor = (key: string) => {
    const v = set.variables;
    return set.error && v && (v.level === 'bar' || v.level === 'page' ? v.level : v.id) === key ? set.error.message : null;
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Publishing</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>
          <Title>Publishing</Title>
          <Body tone="muted">
            Who outside {venue?.name ?? 'the venue'} can see its drinks. Set a default for the bar, open or close whole menus, and override single drinks
            and ingredients on their own pages.
          </Body>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the settings. Check your connection and try again.</Body> : null}
          {data ? (
            <>
              <Surface style={styles.card}>
                {data.profile ? (
                  <>
                    <Body>
                      Right now the public sees {data.counts.spec} {data.counts.spec === 1 ? 'drink' : 'drinks'} with the full spec and {data.counts.description} as a
                      menu card. {data.counts.private} {data.counts.private === 1 ? 'stays' : 'stay'} private.
                    </Body>
                    <Button label="See the public page" variant="secondary" icon="globe" onPress={() => router.push(`/p/${data.profile!.handle ?? data.profile!.id}` as Href)} />
                    {canPublish ? <InstagramEditor profileId={data.profile.id} initial={data.profile.instagram ?? ''} /> : null}
                    {canPublish && data.profile.kind === 'maker' ? (
                      <MakerDetailsEditor profileId={data.profile.id} makes={data.profile.makes ?? []} serves={data.profile.serves ?? []} />
                    ) : null}
                  </>
                ) : (
                  <Body>Nothing goes public until the venue has a public page. Find it on the map and claim it for this venue, then come back here.</Body>
                )}
                {canPublish ? null : <Caption tone="muted">You can look, but changing these needs the publish permission at this venue.</Caption>}
              </Surface>

              {data.profile ? (
                <PageVisibilityChoice
                  venueName={venue?.name ?? 'the venue'}
                  value={data.pageVisibility}
                  disabled={!canPublish || set.isPending}
                  error={errorFor('page')}
                  onChange={(visibility) => set.mutate({ level: 'page', visibility })}
                />
              ) : null}

              <View style={styles.group}>
                <Headline role="heading">The bar’s default</Headline>
                <Caption tone="muted">For every drink and ingredient that doesn’t say otherwise and isn’t on a menu with its own setting.</Caption>
                <PublishChoice
                  label="The bar's default"
                  value={data.barDefault}
                  disabled={!canPublish || set.isPending}
                  error={errorFor('bar')}
                  onChange={(mode) => mode && set.mutate({ level: 'bar', mode })}
                />
              </View>

              <View style={styles.group}>
                <Headline role="heading">Menus</Headline>
                <Caption tone="muted">
                  A menu’s setting covers every drink on it. When a drink is on more than one menu, the most open one wins, and a drink’s own setting beats
                  them all.
                </Caption>
                {data.menus.length ? null : <Body tone="muted">No menus yet.</Body>}
                <View role="list" style={styles.list}>
                  {data.menus.map((m) => (
                    <View key={m.id} role="listitem" style={styles.menu}>
                      <Body>{m.name}</Body>
                      <PublishChoice
                        compact
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
              {canPublish ? <ReleaseList barId={barId} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel="Back"
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space.lg },
  controls: { position: 'absolute' },
  card: { gap: space.md },
  ig: { gap: space.sm },
  group: { gap: space.sm },
  list: { gap: space.lg },
  menu: { gap: space.sm },
});
