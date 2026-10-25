import { useState } from 'react';

import { Button, Caption, EquipmentThumb } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { IceSheet } from '@/components/screens/kit/IceSheet';
import { KitList } from '@/components/screens/kit/KitList';
import { ToolSheet } from '@/components/screens/kit/ToolSheet';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useKitFromDrinks } from '@/hooks/useKitFromDrinks';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import type { FromDrinks } from '@/lib/kitFromDrinks';
import { equipmentById } from '@/lib/techniques/equipment';

type Open =
  | { kind: 'glass'; row: FromDrinks['glasses'][number] }
  | { kind: 'ice'; row: FromDrinks['ice'][number] }
  | { kind: 'tool'; row: FromDrinks['tools'][number] };

const drinksLine = (n: number) => `${n} ${n === 1 ? 'drink' : 'drinks'}`;

/** How many things the venue's drinks name that its Kit doesn't have; null while it loads. */
export const fromDrinksCount = (f: FromDrinks | null) => (f ? f.glasses.length + f.ice.length + f.tools.length : null);

/**
 * What next › From your drinks (Kit and ice, step 12): the glasses, ice and
 * tools the venue's drinks name that aren't in its Kit. Each opens Kit's Add
 * sheet with what it is answered, or a glass in the Kit with no real glass
 * to match.
 */
export function FromDrinksStep({ barId, pageId, name, onBack }: { barId: string; pageId: string | null; name: string; onBack: () => void }) {
  const chrome = useSetupChrome();
  const found = useKitFromDrinks(barId);
  const glasses = useBarGlassware(barId).data ?? [];
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);
  const pick = (id: string) => {
    const [kind, key] = id.split('|');
    const row = kind === 'glass' ? found?.glasses.find((g) => g.name === key) : kind === 'ice' ? found?.ice.find((i) => i.name === key) : found?.tools.find((t) => t.key === key);
    if (row) setOpen({ kind, row } as Open);
  };
  const matching = open?.kind === 'glass' && open.row.match ? (glasses.find((g) => g.id === open.row.match) ?? null) : null;

  return (
    <SetupChromeProvider value={{ ...chrome, title: 'From your drinks', intro: undefined, mark: undefined, eyebrow: null, progress: null, topLabel: `${name} · What next`, noBack: false, onBack }}>
      <SetupPage footer={<Button label="Done" size="lg" onPress={onBack} />}>
        <Caption tone="muted">Your drinks name a few things that aren’t in your Kit yet. Add or match each one.</Caption>
        {found ? (
          <KitList
            sections={[
              {
                title: 'Glasses',
                // Glassware hangs off the venue's page: none to add to before it's checked.
                entries: (pageId ? found.glasses : []).map((g) => ({
                  id: `glass|${g.name}`,
                  name: g.name,
                  line: `${drinksLine(g.drinks)} · ${g.match ? 'in your Kit, no real glass' : 'not in your Kit'}`,
                  thumb: <GlassThumb glass={g.glass} variant={null} />,
                  action: g.match ? 'Match' : 'Add',
                })),
              },
              {
                title: 'Ice',
                entries: found.ice.map((i) => ({ id: `ice|${i.name}`, name: i.name, line: `${drinksLine(i.drinks)} · not in your ice`, thumb: <IceThumb kind={i.kind} />, action: 'Add' })),
              },
              {
                title: 'Tools',
                entries: found.tools.map((t) => ({
                  id: `tool|${t.key}`,
                  name: equipmentById(t.key)?.name ?? t.key,
                  line: t.why,
                  thumb: <EquipmentThumb id={t.key} name={t.key} size={48} />,
                  action: 'Add',
                })),
              },
            ]}
            onOpen={pick}
            empty="Everything your drinks name is in your Kit."
          />
        ) : (
          <Caption tone="muted">Loading…</Caption>
        )}
      </SetupPage>
      <GlassSheet
        barId={barId}
        pageId={pageId}
        visible={open?.kind === 'glass'}
        glass={matching}
        match={!!matching}
        initial={open?.kind === 'glass' && !matching ? { glass: open.row.glass, name: open.row.name !== GLASS_TYPE_LABEL[open.row.glass] ? open.row.name : null } : undefined}
        from={open?.kind === 'glass' ? drinksLine(open.row.drinks) : undefined}
        venueName={name}
        onClose={close}
      />
      <IceSheet
        barId={barId}
        visible={open?.kind === 'ice'}
        initial={open?.kind === 'ice' ? { name: open.row.name, shape: open.row.kind } : undefined}
        startAt={1}
        from={open?.kind === 'ice' ? drinksLine(open.row.drinks) : undefined}
        onClose={close}
      />
      <ToolSheet barId={barId} visible={open?.kind === 'tool'} initialKey={open?.kind === 'tool' ? open.row.key : null} startAt={1} from={open?.kind === 'tool' ? open.row.why : undefined} onClose={close} />
    </SetupChromeProvider>
  );
}
