import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Chip, Field, sheetFrame, Spec, Title, useDs } from '@/components/ds';
import { PrepCalc } from '@/components/tools/PrepCalc';
import { radius, space } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHereVenue } from '@/hooks/useMode';
import { usePricingSettings } from '@/hooks/usePricing';
import { ethanolIn, formatMl, readings, spiritToProof, waterToDilute } from '@/lib/calculators';
import { priceForTarget } from '@/lib/costing';
import { formatMoney, parseMoney } from '@/lib/money';
import { matchPrepLines, mergePrepRecipe, type PrepLine, type PrepRecipeLine } from '@/lib/prepCalcs';

export type Tool = 'dilute' | 'proof' | 'convert' | 'price' | 'prep';

const TOOLS = [
  { value: 'dilute', label: 'Dilute' },
  { value: 'proof', label: 'Proof' },
  { value: 'convert', label: 'Convert' },
  { value: 'price', label: 'Selling price' },
  { value: 'prep', label: 'Prep' },
] as const;

export interface ToolsSheetProps {
  visible: boolean;
  onClose: () => void;
  tool?: Tool;
  /** Prefills: a volume and ABV for dilute and proof, an amount for convert, a name for prep. */
  volumeMl?: number | null;
  abv?: number | null;
  amount?: { value: number; unit: string; name?: string | null; abv?: number | null; density?: number | null } | null;
  prepName?: string | null;
  /** Writes Prep's lines onto a recipe. The drink spec omits this and only shows the amounts. */
  onPrepApply?: (lines: PrepLine[]) => void;
  applying?: boolean;
  /** Light for prep work, dark on the drink page. */
  scheme?: 'light' | 'dark';
}

/**
 * The bar's calculators in one sheet: water to bring a spirit down, spirit
 * to bring a cordial up, an amount in every unit, the menu price that hits
 * a GP, and the batch for a syrup, foam or juice. Each one also sits where
 * its question comes up; this holds them all for the odd job.
 */
export function ToolsSheet(props: ToolsSheetProps) {
  const here = useHereVenue();
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme scheme={props.scheme ?? 'light'}>
        <BrandProvider accent={here?.accent ?? undefined}>
          <Sheet {...props} />
        </BrandProvider>
      </BackbarTheme>
    </Modal>
  );
}

const num = (s: string) => (s.trim() ? Number(s) : NaN);
const pct = (n: number) => `${Number(n.toFixed(1))}%`;

function Sheet({ onClose, tool: initial = 'dilute', volumeMl, abv, amount, prepName, onPrepApply, applying }: ToolsSheetProps) {
  const ds = useDs();
  // At home, the venue's currency, tax and margin aren't yours.
  const here = useHereVenue();
  const { data: pricing } = usePricingSettings(here?.id);
  const [tool, setTool] = useState<Tool>(initial);
  const [volume, setVolume] = useState(volumeMl ? String(Math.round(volumeMl)) : '');
  const [have, setHave] = useState(abv != null ? String(Number(abv.toFixed(1))) : '');
  const [want, setWant] = useState('');
  const [spirit, setSpirit] = useState('96');
  const [value, setValue] = useState(amount ? String(amount.value) : '');
  const [unit, setUnit] = useState(amount?.unit ?? 'ml');
  const [cost, setCost] = useState('');
  const [gp, setGp] = useState(pricing?.target_gp != null ? String(pricing.target_gp) : '80');
  const [tax, setTax] = useState(pricing ? String(pricing.tax_rate) : '20');
  const [included, setIncluded] = useState(pricing?.prices_include_tax ?? true);
  const currency = pricing?.currency ?? 'GBP';

  let result: string | null = null;
  let note = '';
  if (tool === 'dilute') {
    const w = waterToDilute(num(volume), num(have), num(want));
    result = w === null ? null : formatMl(w);
    note = w === null ? 'The ABV you want has to be lower than what you have.' : `${formatMl(num(volume))} at ${pct(num(have))} holds ${formatMl(ethanolIn(num(volume), num(have)))} of ethanol. With the water you get ${formatMl(num(volume) + w)} at ${pct(num(want))}. Ignores contraction: water and ethanol mix to a little less than the sum.`;
  } else if (tool === 'proof') {
    const s = spiritToProof(num(volume), num(have), num(want), num(spirit));
    result = s === null ? null : formatMl(s);
    note = s === null ? 'The ABV you want has to sit between what you have and the spirit you add.' : `Makes ${formatMl(num(volume) + s)} at ${pct(num(want))}. For fortifying a liqueur or a cordial so it keeps.`;
  } else if (tool === 'convert') {
    const list = readings(num(value), unit, amount ?? undefined);
    result = list.length ? list.map((r) => r.label).join(' · ') : null;
    note = list.length ? (amount?.name ? `${amount.name}${amount.density ? ', at its own density' : ', density guessed from the name and ABV'}.` : 'Weights at the density of water unless the amount came from a spec line.') : 'Enter an amount in ml, cl, oz, g, kg, a barspoon or a dash.';
  } else if (tool === 'price') {
    const minor = parseMoney(cost, currency);
    const price = minor === null ? null : priceForTarget(minor, num(gp), { taxRate: num(tax) || 0, pricesIncludeTax: included });
    result = price === null ? null : (formatMoney(price, currency) ?? String(price));
    note = price === null ? 'Enter a cost above zero and a GP under 100.' : `Rounded up to the nearest 10. ${included ? `Includes ${num(tax) || 0}% tax; GP is taken on the price without it.` : 'Tax is added at the till, so GP is taken on this price.'}`;
  }

  return (
    <Pressable accessibilityLabel="Close" style={[styles.scrim, sheetFrame.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, sheetFrame.panel, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Caption tone="muted">Tools</Caption>
            <Title>{TOOLS.find((t) => t.value === tool)?.label}</Title>
            <View role="radiogroup" accessibilityLabel="Calculator" style={styles.picks}>
              {TOOLS.map((t) => (
                <Chip key={t.value} label={t.label} selected={tool === t.value} onPress={() => setTool(t.value)} />
              ))}
            </View>
            {tool === 'prep' ? <PrepCalc name={prepName} onApply={onPrepApply} applying={applying} /> : tool === 'dilute' || tool === 'proof' ? (
              <>
                <Field label="Volume you have (ml)" value={volume} onChangeText={setVolume} placeholder="700" keyboardType="decimal-pad" />
                <Field label="Its ABV (%)" value={have} onChangeText={setHave} placeholder="40" keyboardType="decimal-pad" />
                <Field label="ABV you want (%)" value={want} onChangeText={setWant} placeholder={tool === 'dilute' ? '28' : '22'} keyboardType="decimal-pad" />
                {tool === 'proof' ? <Field label="Spirit you'll add, ABV (%)" value={spirit} onChangeText={setSpirit} placeholder="96" keyboardType="decimal-pad" /> : null}
              </>
            ) : tool === 'convert' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Field label="Amount" value={value} onChangeText={setValue} placeholder="50" keyboardType="decimal-pad" />
                </View>
                <View style={styles.flex}>
                  <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="g" autoCapitalize="none" />
                </View>
              </View>
            ) : (
              <>
                <Field label={`Cost per serve (${currency}, without tax)`} value={cost} onChangeText={setCost} placeholder="1.90" keyboardType="decimal-pad" />
                <Field label="Target GP (%)" value={gp} onChangeText={setGp} placeholder="80" keyboardType="decimal-pad" />
                <Field label="Tax in the menu price (%, 0 for US menus)" value={tax} onChangeText={setTax} placeholder="20" keyboardType="decimal-pad" />
                <Pressable role="checkbox" aria-checked={included} accessibilityLabel="Menu prices include the tax" onPress={() => setIncluded((v) => !v)} style={styles.check}>
                  <Caption tone={included ? 'accent' : 'muted'}>{included ? 'Menu prices include the tax' : 'Tax is added at the till'} (tap to change)</Caption>
                </Pressable>
              </>
            )}
            {tool === 'prep' ? null : <View style={[styles.result, { backgroundColor: ds.c.raised }]}>
              <Caption tone="muted">{tool === 'dilute' ? 'Add water' : tool === 'proof' ? 'Add spirit' : tool === 'convert' ? 'Reads as' : 'Menu price'}</Caption>
              <Spec tone="accent" style={styles.big}>
                {result ?? '…'}
              </Spec>
              <Body tone="muted">{note}</Body>
            </View>}
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  avoider: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous', maxHeight: '92%' },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  check: { paddingVertical: space.sm },
  result: { borderRadius: radius.control, padding: space.lg, gap: space.xs },
  big: { fontSize: space.xl, lineHeight: space.xxl },
});

type SaveDraft = (args: { entityType: string; draftData: { name: string; barId: string | null; recipeItems: [] } }) => Promise<{ id: string }>;

/** Opens the prep calculator. With `onApply`, "Add to recipe" writes the batch onto the ingredient. */
export function PrepCalcButton<T extends PrepRecipeLine>({
  name,
  catalog,
  recipe,
  barId,
  saveDraft,
  onApply,
}: {
  name?: string | null;
  catalog?: { id: string; name: string }[];
  recipe?: { ingredient_id: string; name: string }[];
  barId?: string | null;
  saveDraft?: SaveDraft;
  onApply?: (update: (prev: T[]) => T[]) => void;
}) {
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  // Ids created this session, so a second tap doesn't draft the same ingredient again.
  const made = useRef(new Map<string, { id: string; name: string }>());
  const apply = onApply && saveDraft
    ? async (lines: PrepLine[]) => {
        const known = [
          ...(recipe ?? []).map((r) => ({ id: r.ingredient_id, name: r.name })),
          ...(catalog ?? []),
          ...made.current.values(),
        ];
        setApplying(true);
        try {
          const ready: PrepRecipeLine[] = [];
          for (const line of matchPrepLines(lines, known)) {
            let id = line.ingredient_id;
            if (!id) {
              const draft = await saveDraft({ entityType: 'ingredient', draftData: { name: line.name, barId: barId ?? null, recipeItems: [] } });
              id = draft.id;
              made.current.set(line.name.trim().toLowerCase(), { id, name: line.name });
            }
            ready.push({ ingredient_id: id, name: line.name, amount: line.amount, unit: line.unit });
          }
          onApply((prev) => mergePrepRecipe(prev, ready));
          setOpen(false);
        } catch (e) {
          Alert.alert('Couldn’t add these', e instanceof Error ? e.message : 'Try again.');
        } finally {
          setApplying(false);
        }
      }
    : undefined;
  return (
    <>
      <Button label="Ingredient calculator" variant="secondary" onPress={() => setOpen(true)} accessibilityHint="Amounts for a syrup, foam, juice or soda" />
      {open ? <ToolsSheet visible onClose={() => setOpen(false)} tool="prep" prepName={name} scheme={scheme} onPrepApply={apply} applying={applying} /> : null}
    </>
  );
}
