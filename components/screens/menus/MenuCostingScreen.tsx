import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Field, GlassButton, LockedSection, PressableScale, Spec, Tag, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useSetMenuPrice } from '@/hooks/useDrinkCost';
import { useMenuCosting, type MenuCostRow } from '@/hooks/useMenuCosting';
import { useMenu } from '@/hooks/useMenus';
import { usePricingSettings } from '@/hooks/usePricing';
import { formatPct, margin, menuSummary, targetsLine, targetStatus, underLabel, type Targets, type TaxRule } from '@/lib/costing';
import { formatMoney, moneyFieldValue, parseMoney } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

/**
 * Menu costing (venue-menus-costing-desktop): every drink on a menu with its
 * cost per serve, menu price, price without tax, profit, GP, pour cost and
 * the price that clears the venue's targets (a GP, and the least a drink
 * should make). A drink under either gets a tag and a Use button that sets
 * that price. Click a price to set your own. Phones get the drink, cost,
 * price and profit, with the same tags.
 */
export function MenuCostingScreen({ menuId }: { menuId: string }) {
  return (
    <BackbarTheme>
      <Page menuId={menuId} />
    </BackbarTheme>
  );
}

function Page({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { data: menu } = useMenu(menuId);
  const barId = menu?.barId ?? null;
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const { data: caps } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'costs');
  const unlocked = !!barId && !!caps?.includes('costs');
  const { data: settings } = usePricingSettings(unlocked ? barId : null);
  const { data: rows, isPending, error } = useMenuCosting(menuId, barId, unlocked);
  const tax: TaxRule = { taxRate: settings?.tax_rate ?? 0, pricesIncludeTax: settings?.prices_include_tax ?? true };
  const targets: Targets = { gp: settings?.target_gp ?? null, minProfitMinor: settings?.min_profit_minor ?? null };
  const currency = settings?.currency ?? null;
  const drinks = (rows ?? []).filter((r) => r.itemType === 'cocktail');
  const summary = menuSummary(
    drinks.map((r) => ({ costMinor: r.cost && !(r.cost.total_minor === 0 && r.cost.missing > 0) ? r.cost.total_minor : null, priceMinor: r.priceMinor, missing: r.cost?.missing ?? 0 })),
    targets,
    tax
  );
  const money = (minor: number | null | undefined) => formatMoney(minor, currency) ?? '–';
  const wants = targetsLine(targets, (m) => money(m));
  const meta = [venue?.name, settings ? (settings.prices_include_tax ? `prices include ${settings.tax_rate}% tax` : `${settings.tax_rate}% tax at the till`) : null, wants ? `target ${wants}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <BrandProvider accent={venue?.accent ?? undefined}>
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <WebHead>
          <title>Menu costing</title>
        </WebHead>
        <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
          <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}` as never))} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }}>
          <View style={styles.readable}>
            <Caption tone="muted">{meta || 'Menu costing'}</Caption>
            <Title>{menu ? `${menu.name}: costing` : 'Menu costing'}</Title>
            {!barId && menu ? <Body tone="muted">Only a venue’s menu can be costed.</Body> : null}
            {barId && !unlocked ? (
              <LockedSection title="Cost, price and GP" unlocked={false} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Admin'}>
                {null}
              </LockedSection>
            ) : null}
            {unlocked && !currency && settings ? <Body tone="muted">Set the venue’s currency in Pricing first.</Body> : null}
            {unlocked && error ? <Body tone="muted">Couldn’t work out the costs. Check your connection and try again.</Body> : null}
            {unlocked && isPending && !error ? <Caption tone="muted">Adding it up…</Caption> : null}
            {unlocked && rows && currency ? (
              <>
                <Body tone="muted">
                  Profit is what a drink makes after tax and ingredients. Drinks under a target are marked with the price that clears {targets.gp != null && targets.minProfitMinor != null ? 'both' : 'it'}: use it, or click a price to set your own. Anything unpriced is counted as missing, never as free.
                </Body>
                <View role="table" style={[styles.table, { borderColor: ds.c.line }]}>
                  <Header wide={wide} pricesIncludeTax={tax.pricesIncludeTax} />
                  {drinks.map((r) => (
                    <Row key={r.id} row={r} wide={wide} tax={tax} targets={targets} currency={currency} money={money} />
                  ))}
                </View>
                <View style={styles.foot}>
                  <Body>
                    Average GP <Spec>{summary.averageGp == null ? '–' : formatPct(summary.averageGp)}</Spec> · average profit{' '}
                    <Spec>{summary.averageProfitMinor == null ? '–' : money(Math.round(summary.averageProfitMinor))}</Spec>
                  </Body>
                  {wants ? <Body tone="muted">{summary.underTarget} of {drinks.length} under target</Body> : null}
                  {summary.incomplete ? <Body tone="muted">{summary.incomplete} {summary.incomplete === 1 ? 'drink' : 'drinks'} with an ingredient still without a price</Body> : null}
                  {drinks.length === 0 ? <Body tone="muted">No cocktails on this menu.</Body> : null}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </BrandProvider>
  );
}

/** Column weights: the drink column narrows on phones so the money columns don't wrap. */
const COLS = { drink: 3, drinkPhone: 1.6, num: 1.2 } as const;

function Header({ wide, pricesIncludeTax }: { wide: boolean; pricesIncludeTax: boolean }) {
  const ds = useDs();
  const cells = wide ? ['Drink', 'Cost', 'Price', pricesIncludeTax ? 'Ex tax' : 'Before tax', 'Profit', 'GP', 'Pour cost', 'Hits target at'] : ['Drink', 'Cost', 'Price', 'Profit'];
  return (
    <View role="row" style={[styles.row, styles.header, { borderBottomColor: ds.c.lineStrong }]}>
      {cells.map((c, i) => (
        <Caption key={c} tone="muted" role="columnheader" align={i === 0 ? 'left' : 'right'} style={{ flex: i === 0 ? (wide ? COLS.drink : COLS.drinkPhone) : COLS.num, letterSpacing: 1 }}>
          {c.toUpperCase()}
        </Caption>
      ))}
    </View>
  );
}

function Row({ row, wide, tax, targets, currency, money }: { row: MenuCostRow; wide: boolean; tax: TaxRule; targets: Targets; currency: string; money: (m: number | null | undefined) => string }) {
  const ds = useDs();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(moneyFieldValue(row.priceMinor, currency));
  const set = useSetMenuPrice(row.id);
  // A drink whose every line is unpriced has no cost yet, not a cost of nothing.
  const costMinor = row.cost && !(row.cost.total_minor === 0 && row.cost.missing > 0) ? row.cost.total_minor : null;
  const m = costMinor == null ? null : margin(costMinor, row.priceMinor, tax);
  const target = costMinor == null ? null : targetStatus(costMinor, row.priceMinor, targets, tax);
  // Marked only once it has a price: an unpriced drink isn't under anything yet.
  const under = m && target && !target.onTarget ? target.under : null;
  const draftMinor = parseMoney(draft, currency);
  // Under a target: the tag and the price that clears it. Phones give it its own line under the row.
  const flag =
    under && target && !target.onTarget ? (
      <View style={styles.flag}>
        <Tag label={underLabel(under, targets, money)} tone="accent" />
        <Button
          label={set.isPending ? 'Saving…' : `Use ${money(target.priceMinor)}`}
          accessibilityLabel={`Use ${money(target.priceMinor)} for ${row.name}`}
          variant="secondary"
          size="sm"
          disabled={set.isPending}
          onPress={() => set.mutate(target.priceMinor)}
        />
        {set.error && !editing ? <Caption tone="accent" role="alert">Couldn’t save. Try again.</Caption> : null}
      </View>
    ) : null;
  const cell = (text: string, tone: 'ink' | 'muted' | 'accent' = 'ink') => (
    <Spec tone={tone} align="right" style={{ flex: COLS.num }}>
      {text}
    </Spec>
  );
  return (
    <View
      role="row"
      accessibilityLabel={`${row.name}: cost ${money(costMinor)}, price ${money(row.priceMinor)}, ${m ? `profit ${money(Math.round(m.profitMinor))}, GP ${formatPct(m.gp)}` : 'no price'}${under ? `, ${underLabel(under, targets, money)}` : ''}`}
      style={[styles.rowWrap, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.cells}>
        <View style={{ flex: wide ? COLS.drink : COLS.drinkPhone, gap: space.xs }}>
          <Body>{row.name}</Body>
          {row.cost?.missing ? <Tag label={`${row.cost.missing} without a price`} tone="warning" /> : null}
          {wide ? flag : null}
          {editing ? (
            <View style={styles.edit}>
              <Field label={`Menu price (${currency})`} value={draft} onChangeText={setDraft} placeholder="12.00" keyboardType="decimal-pad" />
              <View style={styles.editActions}>
                <Button label={set.isPending ? 'Saving…' : 'Save'} size="md" disabled={set.isPending || (!!draft.trim() && draftMinor === null)} onPress={() => set.mutateAsync(draft.trim() ? draftMinor : null).then(() => setEditing(false), () => {})} />
                <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
              </View>
            </View>
          ) : null}
        </View>
        {cell(costMinor == null ? '–' : money(costMinor), costMinor == null ? 'muted' : 'ink')}
        <PressableScale role="button" accessibilityLabel={`Change the price of ${row.name}`} onPress={() => setEditing((e) => !e)} style={{ flex: COLS.num, minHeight: layout.minTapTarget, justifyContent: 'center' }}>
          <Spec tone="accent" align="right">
            {row.priceMinor == null ? 'Set' : money(row.priceMinor)}
          </Spec>
        </PressableScale>
        {wide ? cell(m ? money(Math.round(m.exTaxMinor)) : '–', 'muted') : null}
        {cell(m ? money(Math.round(m.profitMinor)) : '–', under === 'profit' || under === 'both' || (!wide && under) ? 'accent' : 'ink')}
        {wide ? cell(m ? formatPct(m.gp) : '–', under === 'gp' || under === 'both' ? 'accent' : 'ink') : null}
        {wide ? cell(m ? formatPct(m.pourCost) : '–', 'muted') : null}
        {wide ? cell(target ? (target.onTarget ? 'on target' : money(target.priceMinor)) : '–', target && !target.onTarget ? 'accent' : 'muted') : null}
      </View>
      {wide ? null : flag}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', paddingBottom: space.sm, minHeight: layout.minTapTarget },
  readable: { maxWidth: 1040, width: '100%', gap: space.md, paddingTop: space.md },
  table: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  rowWrap: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  cells: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  header: { paddingVertical: space.sm },
  edit: { gap: space.xs, marginTop: space.xs },
  editActions: { flexDirection: 'row', gap: space.sm },
  flag: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  foot: { gap: space.xs, marginTop: space.sm },
});
