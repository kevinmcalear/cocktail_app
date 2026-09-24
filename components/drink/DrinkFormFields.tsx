import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Input, Label, Text, TextArea, XStack, YStack } from 'tamagui';

import { BarAssignmentAccordion } from '@/components/BarAssignmentAccordion';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { useDropdowns } from '@/hooks/useDropdowns';
import type { DrinkKindConfig } from '@/lib/drinkKinds';
import { capitalize, handleCapitalizedChange } from '@/lib/stringUtils';

export type DrinkImage = { id?: string; url: string; isNew?: boolean };

/** Everything a beer or wine form edits, with its setters. */
export function useDrinkFormState(initialName = '', initialBarId: string | null = null) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [maker, setMaker] = useState('');
  const [abv, setAbv] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [localImages, setLocalImages] = useState<DrinkImage[]>([]);
  const [barId, setBarId] = useState<string | null>(initialBarId);
  const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
  const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
  const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
  const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
  const [overridePrep, setOverridePrep] = useState<string | null>(null);

  return {
    name, setName,
    description, setDescription,
    maker, setMaker,
    abv, setAbv,
    price, setPrice,
    selectedCategories, setSelectedCategories,
    localImages, setLocalImages,
    barId, setBarId,
    overrideVisibility, setOverrideVisibility,
    overrideGeneric, setOverrideGeneric,
    overrideSpecific, setOverrideSpecific,
    overrideMeasurement, setOverrideMeasurement,
    overridePrep, setOverridePrep,
  };
}

export type DrinkFormState = ReturnType<typeof useDrinkFormState>;

/** The item's columns, from the form (shared by create and update). */
export function drinkColumns(form: DrinkFormState) {
  const level = (value: string | null) => (value ? parseInt(value) : null);
  return {
    name: capitalize(form.name),
    description: form.description,
    brand_maker: capitalize(form.maker) || null,
    abv: form.abv ? parseFloat(form.abv) : null,
    price: form.price ? parseFloat(form.price) : null,
    bar_id: form.barId || null,
    override_visibility_level: level(form.overrideVisibility),
    override_generic_ingredient_level: level(form.overrideGeneric),
    override_specific_brand_level: level(form.overrideSpecific),
    override_measurement_level: level(form.overrideMeasurement),
    override_prep_level: level(form.overridePrep),
  };
}

const inputProps = {
  size: '$4',
  placeholderTextColor: '$color11',
  backgroundColor: '$backgroundStrong',
  borderColor: '$borderColor',
  focusStyle: { borderColor: '$color8' },
} as const;

/** The fields below the photos on the add and edit screens, plus the tag picker. */
export function DrinkFormFields({ kind, form }: { kind: DrinkKindConfig; form: DrinkFormState }) {
  const { data: dropdowns } = useDropdowns();
  const categoryPickerRef = useRef<BottomSheetModal>(null);
  const { selectedCategories, setSelectedCategories } = form;

  return (
    <>
      <YStack gap="$2" marginBottom="$4">
        <Label color="$color11">Name *</Label>
        <Input
          {...inputProps}
          value={form.name}
          onChangeText={(val) => handleCapitalizedChange(val, form.name, form.setName)}
          onBlur={() => form.setName(capitalize(form.name))}
          placeholder={kind.placeholders.name}
        />
      </YStack>

      <YStack gap="$2" marginBottom="$4">
        <Label color="$color11">{kind.maker.label}</Label>
        <Input
          {...inputProps}
          value={form.maker}
          onChangeText={(val) => handleCapitalizedChange(val, form.maker, form.setMaker)}
          onBlur={() => form.setMaker(capitalize(form.maker))}
          placeholder={kind.maker.placeholder}
        />
      </YStack>

      <YStack gap="$2" marginBottom="$4">
        <XStack justifyContent="space-between" alignItems="center">
          <Label color="$color11">Tags (Style, Region)</Label>
          <TouchableOpacity onPress={() => categoryPickerRef.current?.present()}>
            <Text color="$color8" fontWeight="bold">
              + Add
            </Text>
          </TouchableOpacity>
        </XStack>
        <XStack flexWrap="wrap" gap="$2">
          {selectedCategories.length === 0 ? (
            <Text color="$color11" fontStyle="italic">
              No tags selected
            </Text>
          ) : (
            selectedCategories.map((catId) => {
              const cat = dropdowns?.categories?.find((c: any) => c.id === catId);
              if (!cat) return null;
              return (
                <XStack key={catId} backgroundColor="$backgroundStrong" paddingHorizontal={12} paddingVertical={6} borderRadius={16}>
                  <Text color="$color">{cat.name}</Text>
                </XStack>
              );
            })
          )}
        </XStack>
      </YStack>

      <XStack gap="$3" marginBottom="$4">
        <YStack flex={1} gap="$2">
          <Label color="$color11">ABV (%)</Label>
          <Input {...inputProps} value={form.abv} onChangeText={form.setAbv} keyboardType="numeric" placeholder={kind.placeholders.abv} />
        </YStack>
        <YStack flex={1} gap="$2">
          <Label color="$color11">Price ($)</Label>
          <Input {...inputProps} value={form.price} onChangeText={form.setPrice} keyboardType="numeric" placeholder={kind.placeholders.price} />
        </YStack>
      </XStack>

      <YStack gap="$2" marginBottom="$4">
        <Label color="$color11">Description / Notes</Label>
        <TextArea {...inputProps} value={form.description} onChangeText={form.setDescription} numberOfLines={4} />
      </YStack>

      <BarAssignmentAccordion
        barId={form.barId}
        setBarId={form.setBarId}
        overrideVisibility={form.overrideVisibility}
        setOverrideVisibility={form.setOverrideVisibility}
        overrideGeneric={form.overrideGeneric}
        setOverrideGeneric={form.setOverrideGeneric}
        overrideSpecific={form.overrideSpecific}
        setOverrideSpecific={form.setOverrideSpecific}
        overrideMeasurement={form.overrideMeasurement}
        setOverrideMeasurement={form.setOverrideMeasurement}
        overridePrep={form.overridePrep}
        setOverridePrep={form.setOverridePrep}
      />

      <CategoryPickerModal
        ref={categoryPickerRef}
        domains={[kind.kind]}
        selectedCategoryIds={selectedCategories}
        onToggleCategory={(cat) => {
          if (selectedCategories.includes(cat.id)) {
            setSelectedCategories((prev) => prev.filter((id) => id !== cat.id));
          } else {
            setSelectedCategories((prev) => [...prev, cat.id]);
          }
        }}
      />
    </>
  );
}
