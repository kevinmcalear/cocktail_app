import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Surface, Tag, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDrinkAllergens, useItemAllergens, useSetItemAllergens, type AllergenDeclaration } from '@/hooks/useAllergens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { ALLERGENS, allergenLabel, checkedLine, viaLine, type Allergen } from '@/lib/allergens';

interface AllergenSectionProps {
  itemId: string;
  /** The ingredient has a recipe of its own, so its allergens come from that. */
  houseMade: boolean;
  /** The viewer can edit the item itself (the catalogue's declaration). */
  canEditItem: boolean;
}

/**
 * Allergens on an ingredient's page. A bought ingredient declares its own:
 * the catalogue's declaration, or the venue's own once it has checked the
 * bottle it actually buys. A house-made one shows what rolls up from its
 * recipe. Unchecked is never shown as none.
 */
export function AllergenSection(props: AllergenSectionProps) {
  return (
    <VenueBrandProvider>
      <Surface style={styles.card}>
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          ALLERGENS
        </Caption>
        {props.houseMade ? <RolledUp itemId={props.itemId} /> : <Declared {...props} />}
      </Surface>
    </VenueBrandProvider>
  );
}

function RolledUp({ itemId }: { itemId: string }) {
  const { data, isPending } = useDrinkAllergens(itemId);
  if (isPending) return <Body tone="muted">Working it out from the recipe.</Body>;
  if (!data) return null;
  return (
    <View style={styles.list}>
      <Caption tone="muted">From the recipe.</Caption>
      {data.allergens.length ? (
        data.allergens.map((a) => (
          <View key={a.allergen} style={styles.found}>
            <Tag label={`Contains ${allergenLabel(a.allergen).toLowerCase()}`} tone="warning" />
            {a.via.map((path, i) => {
              const line = viaLine(path);
              return line ? (
                <Caption key={i} tone="muted">
                  {line}
                </Caption>
              ) : null;
            })}
          </View>
        ))
      ) : (
        <Body tone="muted">No allergens declared on what goes in.</Body>
      )}
      {data.unchecked > 0 ? (
        <Caption tone="accent">
          {data.unchecked === 1 ? '1 ingredient' : `${data.unchecked} ingredients`} not checked yet.
        </Caption>
      ) : null}
    </View>
  );
}

function Declared({ itemId, canEditItem }: AllergenSectionProps) {
  const { active } = useActiveVenue();
  const venueId = useMode().mode === 'home' ? null : (active?.id ?? null);
  const { data: capabilities } = useCapabilities(venueId);
  // In a venue, the venue's own declaration is what gets edited; with no venue, the catalogue's.
  const scope = venueId;
  const canEdit = scope ? !!capabilities?.includes('edit_drinks') : canEditItem;
  const { data, isPending } = useItemAllergens(itemId, venueId);
  const save = useSetItemAllergens(itemId, scope);
  if (isPending || !data) return <Body tone="muted">Loading.</Body>;

  const own = scope ? data.bar : data.catalogue;
  const shown: AllergenDeclaration | null = own ?? data.catalogue;
  const source = own ? (scope ? `Checked by ${active?.name ?? 'this venue'}` : 'Checked') : shown ? 'From the catalogue' : null;
  const current = save.isPending && save.variables ? save.variables : (shown?.allergens ?? []);
  const toggle = (key: Allergen) => save.mutate(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);

  if (!canEdit) {
    return (
      <View style={styles.list}>
        {current.length ? (
          <View style={styles.tags}>
            {current.map((key) => (
              <Tag key={key} label={`Contains ${allergenLabel(key).toLowerCase()}`} tone="warning" />
            ))}
          </View>
        ) : (
          <Body tone="muted">{shown ? 'None declared.' : 'Nobody has checked this ingredient yet.'}</Body>
        )}
        <Caption tone={shown ? 'muted' : 'accent'}>{shown ? `${source}. ${checkedLine(shown.checkedAt)}` : checkedLine(null)}</Caption>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Body tone="muted">
        {scope
          ? `Tick what's on the label of the one ${active?.name ?? 'the venue'} buys. Saving marks it checked here.`
          : "Tick what's on the label or the supplier's sheet. Saving marks it checked."}
      </Body>
      <View style={styles.tags} role="group" accessibilityLabel="Allergens in this ingredient">
        {ALLERGENS.map((a) => (
          <Toggle key={a.key} label={a.label} on={current.includes(a.key)} onPress={() => toggle(a.key)} />
        ))}
      </View>
      {save.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
      {own ? (
        <Caption tone="muted">
          {source}. {checkedLine(own.checkedAt)}
        </Caption>
      ) : (
        <View style={styles.row}>
          <Caption tone={shown ? 'muted' : 'accent'}>{shown ? `${source}, not checked here yet.` : checkedLine(null)}</Caption>
          <PressableScale accessibilityLabel="Mark as checked with what's ticked" onPress={() => save.mutate(current)} style={styles.noneButton}>
            <Caption tone="accent">{current.length ? 'Confirm as checked' : 'Checked: none of these'}</Caption>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="checkbox"
      aria-checked={on}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.toggle, { backgroundColor: on ? ds.c.ink : ds.c.raised, borderColor: on ? ds.c.ink : ds.c.line }]}
    >
      {on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
      <Caption color={on ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  eyebrow: { letterSpacing: 1 },
  list: { gap: space.sm },
  found: { gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  toggle: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  noneButton: { minHeight: layout.minTapTarget, justifyContent: 'center' },
});
