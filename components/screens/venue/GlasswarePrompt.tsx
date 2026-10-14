import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, Surface, TextLink, useToast } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { barGlassFor, useBarGlassware, useBarPageId, useSaveBarGlass } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { GLASS_TYPE_LABEL, glassPromptKey, glassToAdd, hasGlass } from '@/lib/glassware';
import type { SketchGlass } from '@/lib/sketch/types';
import { useSettingsStore } from '@/store/useSettingsStore';

interface GlasswarePromptProps {
  /** The venue the drink is at; null (a drink at home) shows nothing. */
  barId: string | null | undefined;
  /** The glass picked, as the sketch draws it, and its drawing (null is the default). */
  glass: SketchGlass | null | undefined;
  variant: string | null | undefined;
  /** As picked: "Coupe", "Champagne saucer". */
  name: string | null | undefined;
  style?: StyleProp<ViewStyle>;
}

/**
 * Under a glass pick (the add-drink wizard, the drink editor): "Is this one of
 * your glasses?" when the venue doesn't list it yet. One tap adds it to the
 * venue's glassware; "Not now" isn't asked again for that glass on this
 * device. Only for people who may change the glassware (prep, which the
 * database checks too).
 */
export function GlasswarePrompt({ barId, glass, variant, name, style }: GlasswarePromptProps) {
  const router = useRouter();
  const toast = useToast();
  const { data: caps = [] } = useCapabilities(barId);
  const { data: pageId } = useBarPageId(barId);
  const { data: rows } = useBarGlassware(barId);
  const save = useSaveBarGlass(barId, pageId);
  const notNow = useSettingsStore((s) => s.glassesNotNow);
  const skip = useSettingsStore((s) => s.skipGlassPrompt);
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name;
  // The glass just added here, so the line under it says so (and links to the list).
  const [added, setAdded] = useState<string | null>(null);
  if (!barId || !glass || !rows || !pageId || !caps.includes('prep')) return null;

  // No pick for this glass is drawn in the venue's own glass of it, as the sketch is.
  const drawn = variant?.startsWith(`${glass}_`) ? variant : (barGlassFor(rows, glass)?.variant ?? null);
  const key = glassPromptKey(barId, glass, drawn);
  const label = name?.trim() || GLASS_TYPE_LABEL[glass];
  const openList = () => router.push(`/settings/bar/${barId}/glassware` as Href);
  if (added === key) {
    return (
      <View style={[styles.done, style]}>
        <Caption tone="muted">{`${label} is in your glassware.`}</Caption>
        <TextLink label="Your glassware" onPress={openList} />
      </View>
    );
  }
  if (hasGlass(rows, glass, drawn) || notNow.includes(key)) return null;

  const add = () =>
    save.mutate(glassToAdd(rows, glass, drawn, name), {
      onSuccess: () => {
        setAdded(key);
        toast.show({ title: 'Added to your glassware', detail: label });
      },
    });
  return (
    <Surface raised style={[styles.card, style]}>
      <View role="group" aria-label="Is this one of your glasses?" style={styles.stack}>
        <Body>Is this one of your glasses?</Body>
        <Caption tone="muted">
          {`Add it to ${venueName ?? 'the venue'}’s glassware: its drinks are drawn in the glasses you have, and the glass list puts them first.`}
        </Caption>
        {save.error ? <Caption tone="muted">Couldn’t add it. Check your connection and try again.</Caption> : null}
        <View style={styles.actions}>
          <Button label={save.isPending ? 'Adding…' : 'Add to our glassware'} size="sm" variant="secondary" disabled={save.isPending} onPress={add} />
          <Button label="Not now" size="sm" variant="ghost" onPress={() => skip(key)} />
          <TextLink label="Your glassware" tone="ink" onPress={openList} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md },
  stack: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  done: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
