import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueIce } from '@/hooks/useVenueIce';
import { iceKind } from '@/lib/iceBuild';
import { venueIceKinds } from '@/lib/venueKit';
import { useSettingsStore } from '@/store/useSettingsStore';

import { IceSheet } from './IceSheet';
import { KitPrompt } from './KitPrompt';

/**
 * Under an ice pick (the add-drink wizard): "Sphere isn't in Little Rye's
 * ice" when the venue pours nothing drawn like it (Kit and ice, step 12).
 * Add opens Kit's Add ice sheet at where it comes from, with what it looks
 * like answered; Not now isn't asked again for that kind on this device.
 * Only for people with Prep.
 */
export function IcePrompt({ barId, ice, drink }: { barId: string | null | undefined; ice: string | null | undefined; drink?: string | null }) {
  const router = useRouter();
  const { data: caps = [] } = useCapabilities(barId);
  const { data: kit } = useVenueIce(barId);
  // ponytail: the glass prompt's "Not now" list, keyed ice:<venue>:<kind>; its own list if it ever needs clearing apart.
  const notNow = useSettingsStore((s) => s.glassesNotNow);
  const skip = useSettingsStore((s) => s.skipGlassPrompt);
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const kind = iceKind(ice);
  if (!barId || !ice?.trim() || !kit || !caps.includes('prep') || !kind || kind === 'none') return null;
  const key = `ice:${barId}:${kind}`;
  // As What next › From your drinks counts it (lib/kitFromDrinks.ts): by how it's drawn.
  const has = venueIceKinds(kit).includes(kind);
  if (added !== key && (has || notNow.includes(key))) return null;
  const name = ice.trim();
  return (
    <>
      <KitPrompt
        title={`${name} isn’t in ${venueName}’s ice.`}
        detail={`Add it, and say where it comes from? Or keep it as written: the drink still says ${name.toLowerCase()}.`}
        addLabel="Add to our ice"
        onAdd={() => setOpen(true)}
        onNotNow={() => skip(key)}
        added={added === key ? `${name} is in your ice.` : null}
        listLabel="Your ice"
        onOpenList={() => router.push(`/settings/bar/${barId}/ice` as Href)}
      />
      <IceSheet
        barId={barId}
        visible={open}
        initial={{ name, shape: kind }}
        startAt={1}
        from={drink?.trim() ? `From the ${drink.trim()}` : undefined}
        onSaved={() => setAdded(key)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
