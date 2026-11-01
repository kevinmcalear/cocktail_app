import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, DsText, Headline, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { GlassFillResult } from '@/hooks/useGlassFill';
import { factorWords, fillWords } from '@/lib/glassFill';
import { amountText } from '@/lib/units';

const ml = (n: number) => `${Math.round(n)} ml`;

/** "Fills the Nick and Nora to 119 ml, 31 ml short of its 150 ml wash line." */
function noteWords({ glassName, fill }: GlassFillResult) {
  const words = fillWords(fill).replace(/ the (\d+ ml wash line)$/, ' its $1');
  return `Fills the ${glassName} to ${ml(fill.levelMl)}, ${words}.`;
}

/** "The cost per drink goes up to $8.30, from $4.50."; the figures only for people who can see costs. */
function costWords(factor: number, cost: FitGlassSheetProps['cost']) {
  if (cost && cost.now === cost.was) return `The cost per drink stays about ${cost.now}.`;
  return `The cost per drink goes ${factor > 1 ? 'up' : 'down'} ${cost ? `to ${cost.now}, from ${cost.was}` : 'with it'}.`;
}

/**
 * Under the spec, when the drink falls short of its glass's wash line or goes
 * over it (QA Q38): how full it is, and Fit it for the drink's editors.
 * Nothing when it fits.
 */
export function FitGlassNote({ result, onFit }: { result: GlassFillResult | null; onFit?: () => void }) {
  const ds = useDs();
  if (!result || result.fill.state === 'fits') return null;
  return (
    <View style={[styles.note, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]}>
      <View style={styles.flex}>
        <Body>{noteWords(result)}</Body>
        <Caption tone="muted">The venue’s wash line for this glass.</Caption>
      </View>
      {onFit && result.fitted ? <Button label="Fit it" size="sm" variant="secondary" onPress={onFit} accessibilityHint="Shows the spec scaled to fill the glass to its wash line" /> : null}
    </View>
  );
}

interface FitGlassSheetProps {
  result: GlassFillResult;
  /** The spec's lines by name, in order, as the fitted amounts are. */
  names: readonly string[];
  /** The amounts as they are now ("45"). */
  amounts: readonly string[];
  onUse: () => void;
  onClose: () => void;
  /** The cost per drink before and after, for people who can see costs ("$4.10"). */
  cost?: { was: string; now: string } | null;
  accent?: string;
}

/**
 * Fit it to the glass (design calls q38, Kevin picked Scale it): the glass and
 * its wash line, how full the drink comes now, and every amount scaled to land
 * on the line. Use this spec puts the amounts in the editor; Done saves them.
 */
export function FitGlassSheet(props: FitGlassSheetProps) {
  return (
    <BackbarTheme>
      <BrandProvider accent={props.accent}>
        <Sheet visible onClose={props.onClose} accessibilityLabel="Fit it to the glass" ground>
          <FitBody {...props} />
        </Sheet>
      </BrandProvider>
    </BackbarTheme>
  );
}

function FitBody({ result, names, amounts, onUse, onClose, cost }: FitGlassSheetProps) {
  const ds = useDs();
  const { fill, fitted, line } = result;
  if (!fitted) return null;
  const first = fitted.lines.findIndex((l) => l.changed);
  const example = first >= 0 ? `${names[first]}: ${amountText(amounts[first], fitted.lines[first].unit)} to ${amountText(fitted.lines[first].amount, fitted.lines[first].unit)}.` : null;
  const kept = fitted.lines.some((l) => !l.changed && l.amount);
  return (
    <SheetScrollView contentContainerStyle={styles.body}>
      <Caption tone="muted" style={styles.eyebrow}>
        {result.glassName}
      </Caption>
      <View style={[styles.glass, { backgroundColor: ds.c.paper }]}>
        <GlassThumb glass={result.venueGlass.glass} variant={result.venueGlass.variant} outline={result.venueGlass.outline ?? result.venueGlass.model?.outline} size={96} />
        <View style={styles.flex}>
          <DsText variant="label" color={ds.c.sketchInk}>{`Wash line ${ml(line.ml)}`}</DsText>
          <DsText variant="body" color={ds.c.sketchInk}>{`Fills to ${ml(fill.levelMl)}: ${ml(Math.abs(fill.diffMl))} ${fill.state === 'short' ? 'short' : 'over'}`}</DsText>
        </View>
      </View>
      <Headline role="heading">Fit it to the glass</Headline>
      <View style={styles.lines}>
        {fitted.lines.map((l, i) => (
          <View key={`${names[i]}-${i}`} style={[styles.line, { borderColor: l.changed ? ds.accentText : ds.c.line }]}>
            <Body numberOfLines={1} style={styles.flex}>
              {names[i]}
            </Body>
            <DsText variant="label" style={styles.mono}>
              {l.amount ? amountText(l.amount, l.unit) : ''}
            </DsText>
          </View>
        ))}
      </View>
      <Body tone="muted">
        {[factorWords(fitted.factor), example, `It fills to ${ml(fitted.fill.levelMl)}.`, kept ? 'Dashes and spoons stay as they are.' : null, costWords(fitted.factor, cost)].filter(Boolean).join(' ')}
      </Body>
      <Button label="Use this spec" onPress={onUse} />
      <Button label="Not now" variant="ghost" onPress={onClose} />
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  lines: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5 },
  mono: { fontFamily: fontFamilies.monoMedium },
});
