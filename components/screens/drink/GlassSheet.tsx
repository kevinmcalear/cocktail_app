import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Field, Headline, Sheet, SheetScrollView, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { GlassFillResult } from '@/hooks/useGlassFill';
import { useSetGlassSize, useSetIcePerServe } from '@/hooks/useGlassIce';
import { glassModelFacts, type GlassModel } from '@/hooks/useGlassModels';
import { useCanEditItem } from '@/hooks/useViewAs';
import { defaultIcePerServe, formatIce, glassFit, glassSizeLabel, type GlassSize } from '@/lib/glass';
import { fillWords } from '@/lib/glassFill';

import { DrinkMakerCredits } from './DrinkMakerCredits';

export interface GlassSheetGlass extends GlassSize {
  id: string;
  name: string;
  bar_id: string | null;
  icon_key?: string | null;
  /** The real glass the drink is served in: its size is the maker's, not editable here. */
  model?: GlassModel | null;
}

interface GlassSheetProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  name: string;
  glass: GlassSheetGlass | null;
  /** The drink's ice type name, or null; "None" counts as no ice. */
  iceName: string | null;
  serveMl: number | null;
  icePerServeG: number | null;
  /** The drink's editor: the glass size, the ice per serve and the makers can change. The read view only reads. */
  editing: boolean;
  /** How full the venue's glass comes (useItemGlassFill): when known, the serve is checked against its wash line, as the drink page's note is. */
  fill?: GlassFillResult | null;
  accent?: string;
}

const num = (s: string) => (s.trim() ? Number(s) : null);

/** "Serve fills it to 119 ml, 31 ml short of its 150 ml wash line.", after the glass's size when it has one. */
function serveWords({ fill }: GlassFillResult, glass: GlassSize): string {
  const line = fill.state === 'fits' ? `at its ${Math.round(fill.washLineMl)} ml wash line` : fillWords(fill).replace(/ the (\d+ ml wash line)$/, ' its $1');
  return `${glass.capacity_ml ? ' ' : ''}Serve fills it to ${Math.round(fill.levelMl)} ml, ${line}.`;
}

/** Ice in the glass, unless the drink says none. */
export function hasIce(iceName: string | null | undefined): boolean {
  return !!iceName && !/^(none|no ice)$/i.test(iceName.trim());
}

/**
 * The glass and the ice: whether the serve fits (the venue glass's wash line
 * when there is one, else the capacity), the glass's capacity with
 * and without ice, the ice a serve takes (the event prep list adds it up)
 * and who cut the ice and made the glass. They change from the editor
 * (`editing`, board drink-read-and-edit): the glass's size by whoever can
 * edit the glass, the rest by the drink's editors.
 */
export function GlassSheet(props: GlassSheetProps) {
  return (
    <BackbarTheme>
      <BrandProvider accent={props.accent}>
        <Sheet visible={props.visible} onClose={props.onClose} accessibilityLabel={`Glass and ice, ${props.name}`} keyboard ground>
          <GlassBody {...props} />
        </Sheet>
      </BrandProvider>
    </BackbarTheme>
  );
}

function GlassBody({ itemId, name, glass, iceName, serveMl, icePerServeG, editing, fill: washFill }: GlassSheetProps) {
  const canEditGlass = useCanEditItem(glass) && editing;
  const setSize = useSetGlassSize(glass?.id ?? '');
  const setIce = useSetIcePerServe(itemId);
  const [capacity, setCapacity] = useState(glass?.capacity_ml ? String(glass.capacity_ml) : '');
  const [iced, setIced] = useState(glass?.iced_capacity_ml ? String(glass.iced_capacity_ml) : '');
  const [ice, setIceDraft] = useState(icePerServeG != null ? String(icePerServeG) : '');
  const withIce = hasIce(iceName);
  const fit = glass ? glassFit(serveMl, glass, withIce) : null;
  const suggested = glass ? defaultIcePerServe(glass, withIce) : null;
  const capN = num(capacity);
  const icedN = num(iced);
  const iceN = num(ice);
  const sizeProblem = (capN !== null && !(capN > 0)) || (icedN !== null && !(icedN > 0)) ? 'Capacities are more than 0 ml.' : capN !== null && icedN !== null && icedN > capN ? 'The iced capacity is at most the capacity.' : null;
  const iceProblem = iceN !== null && !(iceN >= 0) ? 'Ice is 0 g or more.' : null;

  return (
    <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Caption tone="muted">Glass and ice</Caption>
      <Title>{name}</Title>
      {glass ? (
        <View style={styles.group}>
          <Headline>{glass.name}</Headline>
          <Body tone="muted">
            {glassSizeLabel(glass) ?? (washFill ? '' : 'No capacity on file yet.')}
            {washFill ? serveWords(washFill, glass) : fit ? ` Serve of ${Math.round(serveMl!)} ml: ${fit.fits ? 'fits' : `over by ${Math.round(fit.overMl)} ml`}${withIce && glass.iced_capacity_ml ? ' with the ice in' : ''}.` : ''}
          </Body>
          {glass.model ? (
            <Caption tone="muted">{[glassModelFacts(glass.model), glass.model.maker ? `From ${glass.model.maker.display_name}’s catalog.` : null].filter(Boolean).join('. ')}</Caption>
          ) : canEditGlass ? (
            <>
              <Field label="Capacity (ml, to the brim)" value={capacity} onChangeText={setCapacity} placeholder="180" keyboardType="decimal-pad" />
              <Field label="Iced capacity (ml, what the liquid fills with ice in)" value={iced} onChangeText={setIced} placeholder={capacity || '180'} keyboardType="decimal-pad" error={sizeProblem ?? undefined} />
              <Button label={setSize.isPending ? 'Saving…' : 'Save glass'} variant="secondary" disabled={setSize.isPending || !!sizeProblem} onPress={() => setSize.mutate({ capacity_ml: capN, iced_capacity_ml: icedN })} style={styles.button} />
              {setSize.error ? <Caption tone="accent">{"Couldn't save the glass. Check your connection and try again."}</Caption> : null}
            </>
          ) : (
            <Caption tone="muted">Whoever looks after this glass in the Library sets its capacity.</Caption>
          )}
        </View>
      ) : (
        <Body tone="muted">No glass set for this drink.</Body>
      )}
      <View style={styles.group}>
        <Headline>Ice per serve</Headline>
        <Body tone="muted">
          {withIce
            ? icePerServeG != null
              ? `${formatIce(icePerServeG)} of ${iceName!.toLowerCase()} per serve. An event's prep list adds it up.`
              : suggested
                ? `Not weighed yet. From the glass, about ${formatIce(suggested)} of ${iceName!.toLowerCase()} fills it.`
                : 'Not weighed yet.'
            : 'No ice in the glass.'}
        </Body>
        {editing && withIce ? (
          <>
            <Field label="Grams of ice in the glass" value={ice} onChangeText={setIceDraft} placeholder={suggested ? String(suggested) : '140'} keyboardType="decimal-pad" error={iceProblem ?? undefined} hint="Leave blank to clear it." />
            <Button label={setIce.isPending ? 'Saving…' : 'Save ice'} disabled={setIce.isPending || !!iceProblem} onPress={() => setIce.mutate(iceN)} style={styles.button} />
            {setIce.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          </>
        ) : null}
      </View>
      <DrinkMakerCredits itemId={itemId} canEdit={editing} />
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  group: { gap: space.sm },
  button: { alignSelf: 'flex-start' },
});
