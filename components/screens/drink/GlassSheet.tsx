import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Field, Headline, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSetGlassSize, useSetIcePerServe } from '@/hooks/useGlassIce';
import { useCanEditItem } from '@/hooks/useViewAs';
import { defaultIcePerServe, formatIce, glassFit, glassSizeLabel, type GlassSize } from '@/lib/glass';

export interface GlassSheetGlass extends GlassSize {
  id: string;
  name: string;
  bar_id: string | null;
  icon_key?: string | null;
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
  /** The viewer can edit the drink (its ice per serve). */
  canEditDrink: boolean;
  accent?: string;
}

const num = (s: string) => (s.trim() ? Number(s) : null);

/** Ice in the glass, unless the drink says none. */
export function hasIce(iceName: string | null | undefined): boolean {
  return !!iceName && !/^(none|no ice)$/i.test(iceName.trim());
}

/**
 * The glass and the ice: whether the serve fits, the glass's capacity with
 * and without ice (editable by whoever can edit the glass), and the ice a
 * serve takes (editable by the drink's editors), which the event prep list
 * adds up.
 */
export function GlassSheet(props: GlassSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme>
        <BrandProvider accent={props.accent}>
          <Sheet {...props} />
        </BrandProvider>
      </BackbarTheme>
    </Modal>
  );
}

function Sheet({ onClose, itemId, name, glass, iceName, serveMl, icePerServeG, canEditDrink }: GlassSheetProps) {
  const ds = useDs();
  const canEditGlass = useCanEditItem(glass);
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
    <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, { backgroundColor: ds.c.ground }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Caption tone="muted">Glass and ice</Caption>
            <Title>{name}</Title>
            {glass ? (
              <View style={styles.group}>
                <Headline>{glass.name}</Headline>
                <Body tone="muted">
                  {glassSizeLabel(glass) ?? 'No capacity on file yet.'}
                  {fit ? ` Serve of ${Math.round(serveMl!)} ml: ${fit.fits ? 'fits' : `over by ${Math.round(fit.overMl)} ml`}${withIce && glass.iced_capacity_ml ? ' with the ice in' : ''}.` : ''}
                </Body>
                {canEditGlass ? (
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
              {canEditDrink && withIce ? (
                <>
                  <Field label="Grams of ice in the glass" value={ice} onChangeText={setIceDraft} placeholder={suggested ? String(suggested) : '140'} keyboardType="decimal-pad" error={iceProblem ?? undefined} hint="Leave blank to clear it." />
                  <Button label={setIce.isPending ? 'Saving…' : 'Save ice'} disabled={setIce.isPending || !!iceProblem} onPress={() => setIce.mutate(iceN)} style={styles.button} />
                  {setIce.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
                </>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  avoider: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous', maxHeight: '90%' },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  group: { gap: space.sm },
  button: { alignSelf: 'flex-start' },
});
