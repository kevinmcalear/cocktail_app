import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { KitPrompt } from '@/components/screens/kit/KitPrompt';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { barGlassFor, useBarGlassware, useBarPageId } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { GLASS_TYPE_LABEL, glassPromptKey, hasGlass } from '@/lib/glassware';
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
  /** The drink, for "From the Paloma" in the sheet. */
  drink?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * Under a glass pick (the add-drink wizard, the drink editor): "Is this one of
 * your glasses?" when the venue doesn't list it yet. Add opens Kit's Add a
 * glass sheet on that shape, named as picked (Kit and ice, step 12); "Not
 * now" isn't asked again for that glass on this device. Only for people who
 * may change the glassware (prep, which the database checks too).
 */
export function GlasswarePrompt({ barId, glass, variant, name, drink, style }: GlasswarePromptProps) {
  const router = useRouter();
  const { data: caps = [] } = useCapabilities(barId);
  const { data: pageId } = useBarPageId(barId);
  const { data: rows } = useBarGlassware(barId);
  const notNow = useSettingsStore((s) => s.glassesNotNow);
  const skip = useSettingsStore((s) => s.skipGlassPrompt);
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name;
  const [open, setOpen] = useState(false);
  // The glass just added here, so the line under it says so (and links to the list).
  const [added, setAdded] = useState<string | null>(null);
  if (!barId || !glass || !rows || !pageId || !caps.includes('prep')) return null;

  // No pick for this glass is drawn in the venue's own glass of it, as the sketch is.
  const drawn = variant?.startsWith(`${glass}_`) ? variant : (barGlassFor(rows, glass)?.variant ?? null);
  const key = glassPromptKey(barId, glass, drawn);
  const label = name?.trim() || GLASS_TYPE_LABEL[glass];
  if (added !== key && (hasGlass(rows, glass, drawn) || notNow.includes(key))) return null;
  return (
    <>
      <KitPrompt
        title="Is this one of your glasses?"
        detail={`Add it to ${venueName ?? 'the venue'}’s glassware: its drinks are drawn in the glasses you have, and the glass list puts them first.`}
        addLabel="Add to our glassware"
        onAdd={() => setOpen(true)}
        onNotNow={() => skip(key)}
        added={added === key ? `${label} is in your glassware.` : null}
        listLabel="Your glassware"
        onOpenList={() => router.push(`/settings/bar/${barId}/glassware` as Href)}
        style={style}
      />
      <GlassSheet
        barId={barId}
        pageId={pageId}
        visible={open}
        initial={{ glass, variant: drawn, name: name?.trim() && name.trim() !== GLASS_TYPE_LABEL[glass] ? name.trim() : null }}
        from={drink?.trim() ? `From the ${drink.trim()}` : undefined}
        venueName={venueName}
        onSaved={() => setAdded(key)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
