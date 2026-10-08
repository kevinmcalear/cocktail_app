import { useRouter } from "expo-router";
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { Input, Label, Text, XStack, YStack, useTheme } from "tamagui";

import { IconSymbol } from "@/components/ui/icon-symbol";

import { IngredientPickerSheet, type IngredientPickerItem } from "@/components/IngredientPickerSheet";
import { nearIngredient, sameIngredient, type IngredientAlias, type IngredientRow } from "@/lib/ingredientNames";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";

interface Props {
    brandMaker: string;
    onBrandMaker: (value: string) => void;
    /** What this ingredient is a kind of ("Tanqueray" is a kind of "Gin"). */
    generic: { id: string; name: string } | null;
    onGeneric: (generic: { id: string; name: string } | null) => void;
    /** Ingredients to pick the generic from. */
    ingredients: IngredientPickerItem[];
    /** Left out of the list: the ingredient itself. */
    excludeId?: string | null;
    /** The name being typed, to say when it's already an ingredient (and where it lives). */
    sameAs?: { name: string; barId?: string | null; rows: readonly IngredientRow[]; aliases?: readonly IngredientAlias[] };
}

/**
 * The two fields that say what an ingredient is: who makes it, and the
 * generic ingredient it's a kind of. The generic drives brand masking (staff
 * below the brand level see "Gin"), spirit search and flavor profiles.
 */
export function BrandAndKindFields({ brandMaker, onBrandMaker, generic, onGeneric, ingredients, excludeId, sameAs }: Props) {
    const [picking, setPicking] = useState(false);
    return (
        <>
            {sameAs ? <SameIngredientNotice {...sameAs} excludeId={excludeId} generic={generic} onGeneric={onGeneric} /> : null}
            <YStack gap="$2">
                <Label color="$color11">Brand / Maker</Label>
                <Input
                    value={brandMaker}
                    onChangeText={(val) => handleCapitalizedChange(val, brandMaker, onBrandMaker)}
                    onBlur={() => onBrandMaker(capitalize(brandMaker))}
                    placeholderTextColor="$color11"
                    placeholder="e.g. Campari, Buffalo Trace"
                    size="$4"
                    backgroundColor="transparent"
                    borderWidth={0}
                    borderBottomWidth={1}
                    borderColor="$borderColor"
                    focusStyle={{ borderColor: "$color8" }}
                    paddingHorizontal={0}
                />
            </YStack>
            <YStack gap="$2">
                <Label color="$color11">Kind of</Label>
                <XStack alignItems="center" gap="$3" borderBottomWidth={1} borderColor="$borderColor" paddingVertical="$2">
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setPicking(true)} role="button" aria-label="Choose the generic ingredient">
                        <Text color={generic ? "$color" : "$color11"} textAlign="left">
                            {generic?.name || "e.g. Gin, Sweet Vermouth (what this is a kind of)"}
                        </Text>
                    </TouchableOpacity>
                    {generic ? (
                        <TouchableOpacity onPress={() => onGeneric(null)} role="button" aria-label="Clear the generic ingredient">
                            <Text color="$color11">Clear</Text>
                        </TouchableOpacity>
                    ) : null}
                </XStack>
            </YStack>
            <IngredientPickerSheet
                visible={picking}
                onClose={() => setPicking(false)}
                ingredients={ingredients}
                excludeId={excludeId}
                title="Kind of ingredient"
                onSelect={(item) => onGeneric({ id: item.id, name: capitalize(item.name) })}
            />
        </>
    );
}

/**
 * One of each ingredient: when the name typed is already an ingredient (by
 * another spelling or name), say so before saving. A venue can keep its own
 * version under that name as a kind of it; anywhere else it needs its own name,
 * because the shared list holds one of each.
 */
function SameIngredientNotice({
    name,
    barId,
    rows,
    aliases,
    excludeId,
    generic,
    onGeneric,
}: NonNullable<Props["sameAs"]> & Pick<Props, "excludeId" | "generic" | "onGeneric">) {
    const router = useRouter();
    const same = sameIngredient(name, rows, aliases);
    const match = same && same.id !== excludeId ? same : null;
    const near = match ? null : nearIngredient(name, rows, aliases);
    const shown = match ?? (near && near.id !== excludeId ? near : null);
    if (!shown || generic?.id === shown.id) return null;
    const label = capitalize(shown.name ?? "");
    return (
        <YStack gap="$2" padding="$3" borderRadius="$4" borderWidth={1} borderColor="$borderColor" role="alert">
            <Text color="$color" fontWeight="600">
                {match ? `Already here: ${label}` : `Did you mean ${label}?`}
            </Text>
            <Text color="$color11">
                {match && !barId
                    ? `Use it in your drinks. Making your own version? Give it its own name, like "House ${label}", and it'll be a kind of ${label}.`
                    : `Use it, or keep this as your own version: a kind of ${label}.`}
            </Text>
            <TouchableOpacity onPress={() => router.push(`/ingredient/${shown.id}`)} role="link" aria-label={`Open ${label}`} style={{ alignSelf: "flex-start" }}>
                <Text color="$color8" fontWeight="600" fontSize="$4" textAlign="left">Open {label}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onGeneric({ id: shown.id, name: label })} role="button" aria-label={`Make this a kind of ${label}`} style={{ alignSelf: "flex-start" }}>
                <Text color="$color8" fontWeight="600" fontSize="$4" textAlign="left">Make this a kind of {label}</Text>
            </TouchableOpacity>
        </YStack>
    );
}

/** On an ingredient's page: "A kind of Gin", opening the generic's page. */
export function KindOfLink({ generic }: { generic: { id: string; name: string } }) {
    const router = useRouter();
    const theme = useTheme();
    return (
        <TouchableOpacity
            role="link"
            aria-label={`A kind of ${generic.name}, open`}
            onPress={() => router.push(`/ingredient/${generic.id}`)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
            <IconSymbol name="link" size={18} color={theme.color11?.get() as string} />
            <Text color="$color11">A kind of </Text>
            <Text color="$color" fontWeight="600">
                {generic.name}
            </Text>
        </TouchableOpacity>
    );
}
