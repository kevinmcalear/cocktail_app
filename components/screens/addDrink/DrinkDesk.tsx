import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, useDs } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDraftPacks, useMenuSectionPlace } from '@/hooks/useDrinkDesk';
import { usePricingSettings } from '@/hooks/usePricing';
import type { ClassicMatch } from '@/lib/classics';
import { lineCostMinor } from '@/lib/costing';
import { amountOf, guessUnit, hasContent, newLine, pickByName, sketchLook, type WizardDraft, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { density } from '@/lib/drinkMath';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { formatMoney } from '@/lib/money';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { suggestAmount } from '@/lib/specDefaults';
import { isVenueIce } from '@/lib/venueKit';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { CreditsStep } from './CreditsStep';
import { DeskCost, DeskDrinkCard, DeskTaste, type DeskCostLine } from './DrinkDeskRail';
import { FinishStep } from './FinishStep';
import { GlassStep } from './GlassStep';
import { IngredientsStep } from './IngredientsStep';
import type { CatalogIngredient } from './IngredientSearch';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { ReviewPhotos } from './ReviewPhotos';
import { StartFromClassic } from './StartFromClassic';
import { BigName, NotesStep } from './TextSteps';
import { Eyebrow, WizardChip } from './WizardChrome';

export interface DrinkDeskProps {
  draft: WizardDraft;
  /** What the sketch draws: the draft, or a classic its name matches until that spec is used. */
  drawn: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  barId: string | null;
  venueName: string;
  menuSectionId?: string | null;
  ingredients: readonly CatalogIngredient[];
  loading: boolean;
  aliases?: readonly IngredientAlias[];
  coreIds: ReadonlySet<string>;
  shelf?: ReadonlySet<string>;
  methods: WizardPick[];
  glasses: WizardPick[];
  ices: WizardPick[];
  guess: { method: string | null; glass: string | null; ice: string | null };
  barGlasses?: readonly BarGlass[];
  barVariants: string[];
  barIce: string[];
  barIceKinds: string[];
  classic: ClassicMatch | null;
  resumed: boolean;
  onStartOver: () => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Adding a drink on a desktop browser (make-create-desktop, decided 15 Oct):
 * one page. The spec on the left, written in any order; the drink, its
 * taste and what it costs fixed on the right, filling in as it's written.
 * Phones and narrow windows keep the steps (AddDrinkWizard). Save, or ⌘↵.
 */
export function DrinkDesk(p: DrinkDeskProps) {
  const ds = useDs();
  const { draft, set, barId } = p;
  const place = useMenuSectionPlace(p.menuSectionId).data;
  const menu = place?.menu ?? null;
  const caps = useCapabilities(barId).data;
  const canCost = !!barId && !!caps?.includes('costs');
  const pricing = usePricingSettings(canCost ? barId : null).data ?? null;
  const costed = [...draft.lines, ...draft.garnishes];
  const ids = costed.flatMap((l) => (l.id ? [l.id] : []));
  const packs = useDraftPacks(barId, ids, canCost).data ?? [];
  const currency = pricing?.currency ?? 'GBP';
  const [finishOpen, setFinishOpen] = useState(false);
  // A classic or a riff can bring garnishes in after the page opens: they show.
  const finishing = finishOpen || draft.garnishes.length > 0;

  const pack = (l: WizardLine) => packs.find((k) => k.itemId === l.id) ?? null;
  const cost = (l: WizardLine) => {
    const k = pack(l);
    return k?.costMinor != null && k.amount && k.unit ? lineCostMinor(amountOf(l.amount), l.unit, { amount: k.amount, unit: k.unit, costMinor: k.costMinor }, density(l.name, null)) : null;
  };
  const costLines: DeskCostLine[] = costed.map((l) => ({ key: l.key, name: l.name, minor: cost(l) }));
  const lineDetail = (l: WizardLine) => {
    if (!canCost) return null;
    const minor = cost(l);
    return [pack(l)?.supplier, minor != null ? formatMoney(minor, currency) : null].filter(Boolean).join(' · ') || null;
  };
  // A one-tap fix from the taste card: a likely pour, as a line added from the search would get.
  const addByName = (name: string) => {
    const pick = pickByName(name, p.ingredients);
    const unit = guessUnit(pick.name, getPreferredUnit());
    const generic = (id: string | null) => p.ingredients.find((i) => i.id === p.ingredients.find((x) => x.id === id)?.generic_id)?.name ?? null;
    const amount = suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
    set({ lines: [...draft.lines, newLine(pick, unit, amount)] });
  };

  // ⌘↵ (Ctrl+Enter off a Mac) saves from anywhere on the page.
  const latest = useRef(p.onSave);
  useEffect(() => {
    latest.current = p.canSave && !p.saving ? p.onSave : () => {};
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Not while a sheet is open over the page (a prep being written): that sheet's work isn't done.
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  const look = sketchLook(p.drawn, p.barVariants, p.barIceKinds);
  const eyebrow = menu ? ['New drink for ' + menu, place?.section].filter(Boolean).join(' · ') : barId ? `New drink at ${p.venueName}` : 'New drink';
  const saveLabel = p.saving ? 'Saving…' : menu ? `Add to ${menu}` : 'Save drink';

  return (
    <View testID="add-drink" style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Add a drink</title>
      </WebHead>
      <View style={[styles.header, { borderBottomColor: ds.c.line }]}>
        <Button label={menu ?? 'Back'} icon="chevron.left" variant="secondary" onPress={p.onClose} accessibilityLabel={`Back to ${menu ?? 'where you were'}. Your draft is kept`} />
        <View style={styles.flex}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </View>
        {hasContent(draft) ? <Caption tone="muted">Draft saved</Caption> : null}
        <Button label={saveLabel} onPress={p.onSave} disabled={!p.canSave || p.saving} />
        <Caption tone="muted" aria-hidden>
          ⌘ ↵
        </Caption>
      </View>
      <View style={styles.body}>
        <ScrollView style={styles.left} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <BigName value={draft.name} onChange={(name) => set({ name })} onDone={() => {}} resumed={p.resumed} onStartOver={p.onStartOver} />
          {p.classic ? <StartFromClassic set={set} match={p.classic} /> : null}
          <Eyebrow>Ingredients</Eyebrow>
          <IngredientsStep
            draft={draft}
            set={set}
            ingredients={p.ingredients}
            loading={p.loading}
            aliases={p.aliases}
            coreIds={p.coreIds}
            shelf={p.shelf}
            balance={false}
            lineDetail={lineDetail}
          />
          <Row label="Method">
            <PickStep label="Method" ownLabel="Your own method" multi compact options={p.methods} selected={draft.methods} onChange={(methods) => set({ methods })} suggested={p.guess.method} />
          </Row>
          <Row label="Glass">
            <GlassStep compact draft={draft} set={set} options={p.glasses} barId={barId} barGlasses={p.barGlasses} barVariants={p.barVariants} suggested={p.guess.glass} />
          </Row>
          <Row label="Ice">
            <PickStep
              label="Ice"
              ownLabel="Other ice"
              compact
              options={p.ices}
              selected={draft.ice ? [draft.ice] : []}
              onChange={([ice]) => set({ ice: ice ?? null })}
              suggested={p.guess.ice}
              mine={p.barIce.length ? { has: (x) => isVenueIce(p.barIce, x.name), label: 'Your ice', restLabel: 'Other ice' } : undefined}
            />
          </Row>
          <Row label="Finish">
            {finishing ? (
              <FinishStep draft={draft} set={set} ingredients={p.ingredients} loading={p.loading} aliases={p.aliases} coreIds={p.coreIds} />
            ) : (
              <View style={styles.chips}>
                <WizardChip label="Garnish, oil, mist or rinse" add kind="button" onPress={() => setFinishOpen(true)} />
              </View>
            )}
          </Row>
          <Eyebrow>Credit</Eyebrow>
          <CreditsStep draft={draft} set={set} venueName={barId ? p.venueName : null} ingredients={p.ingredients} />
          <Eyebrow>Notes</Eyebrow>
          <NotesStep draft={draft} set={set} />
          <Eyebrow>Who sees it</Eyebrow>
          <PublishStep draft={draft} set={set} barId={barId} />
          <Eyebrow>Photos</Eyebrow>
          <ReviewPhotos photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} sketch={draftSketchInputs(sketchLook(draft, p.barVariants, p.barIceKinds))} seed={draft.id ?? 'new-drink'} />
        </ScrollView>
        <ScrollView style={[styles.rail, { backgroundColor: ds.c.surface, borderLeftColor: ds.c.line }]} contentContainerStyle={styles.railBody}>
          <Eyebrow>The drink, as you go</Eyebrow>
          <DeskDrinkCard draft={draft} look={look} seed={draft.id ?? 'new-drink'} />
          <DeskTaste lines={draft.lines} ingredients={p.ingredients} onAdd={addByName} />
          {canCost ? <DeskCost lines={costLines} pricing={pricing} priceMinor={draft.priceMinor ?? null} onPrice={(priceMinor) => set({ priceMinor })} /> : null}
        </ScrollView>
      </View>
    </View>
  );
}

/** A label on the left and its choices beside it, as the board lays out method, glass, ice and finish. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Eyebrow>{label}</Eyebrow>
      </View>
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xxl, paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  left: { flex: 1, maxWidth: 760 },
  form: { paddingHorizontal: space.xxl, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  rowLabel: { width: 100, paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rail: { flex: 1, minWidth: 360, borderLeftWidth: StyleSheet.hairlineWidth },
  railBody: { padding: space.xl, gap: space.lg },
});
