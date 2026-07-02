import React, { useMemo, useState } from "react";
import { XStack } from "tamagui";

import { SpecBadge } from "@/components/cocktail/SpecBadge";
import { SpecPickerSheet } from "@/components/cocktail/SpecPickerSheet";
import type { SpecCategory, useCocktailEditor } from "@/hooks/useCocktailEditor";
import { buildOriginOptions } from "@/lib/cocktailOrigins";
import { capitalize } from "@/lib/stringUtils";

type Editor = ReturnType<typeof useCocktailEditor>;

const SPEC_FIELDS: { key: SpecCategory; label: string; allowDeselect?: boolean }[] = [
    { key: "method", label: "Method" },
    { key: "glassware", label: "Glassware" },
    { key: "family", label: "Family" },
    { key: "ice", label: "Ice", allowDeselect: true },
];

interface ViewSpec {
    method?: string | null;
    glassware?: string | null;
    family?: string | null;
    ice?: string | null;
    origin?: string | null;
}

interface SpecBadgeRowProps {
    isEditing: boolean;
    viewSpec: ViewSpec;
    editor?: Editor | null;
}

export function SpecBadgeRow({ isEditing, viewSpec, editor }: SpecBadgeRowProps) {
    const [activePicker, setActivePicker] = useState<SpecCategory | "origin" | null>(null);

    const getViewValue = (key: SpecCategory) => {
        const map: Record<SpecCategory, string | null | undefined> = {
            method: viewSpec.method,
            glassware: viewSpec.glassware,
            family: viewSpec.family,
            ice: viewSpec.ice,
        };
        return map[key] ?? null;
    };

    const getEditorName = (key: SpecCategory, id: string | null) => {
        if (!editor || !id) return null;
        const lists = {
            method: editor.methods,
            glassware: editor.glassware,
            family: editor.families,
            ice: editor.iceTypes,
        };
        return lists[key].find((o: any) => o.id === id)?.name ?? null;
    };

    const getEditorIconMeta = (key: SpecCategory, id: string | null) => {
        if (!editor || !id || key !== "glassware") return { iconKey: null, iconUrl: null };
        const item = editor.glassware.find((o: any) => o.id === id);
        return { iconKey: item?.icon_key ?? null, iconUrl: item?.icon_url ?? null };
    };

    const originValue = isEditing && editor ? editor.origin : viewSpec.origin;
    const originOptions = useMemo(() => buildOriginOptions(editor?.origin), [editor?.origin]);

    return (
        <>
            <XStack
                flexWrap="wrap"
                gap="$5"
                paddingHorizontal={24}
                marginBottom="$6"
                marginTop="$2"
                justifyContent="flex-start"
                alignItems="flex-start"
            >
                {SPEC_FIELDS.map(({ key, label, allowDeselect }) => {
                    const specId = isEditing && editor ? editor.getSpecId(key) : null;
                    const value =
                        isEditing && editor
                            ? getEditorName(key, specId)
                            : getViewValue(key);
                    const iconMeta = isEditing && editor ? getEditorIconMeta(key, specId) : { iconKey: null, iconUrl: null };

                    if (!isEditing && !value) return null;

                    return (
                        <SpecBadge
                            key={key}
                            label={label}
                            value={value}
                            emptyLabel={label}
                            isEditing={isEditing}
                            onPress={isEditing ? () => setActivePicker(key) : undefined}
                            iconKey={iconMeta.iconKey}
                            iconUrl={iconMeta.iconUrl}
                        />
                    );
                })}

                {(originValue || isEditing) && (
                    <SpecBadge
                        label="Origin"
                        value={originValue}
                        emptyLabel="Origin"
                        isEditing={isEditing}
                        onPress={isEditing ? () => setActivePicker("origin") : undefined}
                    />
                )}
            </XStack>

            {editor &&
                SPEC_FIELDS.map(({ key, label, allowDeselect }) => (
                    <SpecPickerSheet
                        key={key}
                        visible={activePicker === key}
                        title={label}
                        category={key}
                        options={
                            key === "method"
                                ? editor.methods
                                : key === "glassware"
                                  ? editor.glassware
                                  : key === "family"
                                    ? editor.families
                                    : editor.iceTypes
                        }
                        selectedId={editor.getSpecId(key)}
                        allowDeselect={allowDeselect}
                        onSelect={(id) => editor.setSpecId(key, id)}
                        onClose={() => setActivePicker(null)}
                        onDelete={(item) => editor.handleDeletePill(key, item)}
                        onAdd={(name) => editor.handleAddPill(key, name)}
                        onAddGlassware={key === "glassware" ? editor.handleAddGlassware : undefined}
                        onIdentifyGlassware={key === "glassware" ? editor.identifyGlassware : undefined}
                    />
                ))}

            {editor && (
                <SpecPickerSheet
                    visible={activePicker === "origin"}
                    title="Origin"
                    category="family"
                    options={originOptions}
                    selectedId={editor.origin || null}
                    allowDeselect
                    onSelect={(id) => editor.setOrigin(id || "")}
                    onClose={() => setActivePicker(null)}
                    onAdd={async (name) => {
                        editor.setOrigin(capitalize(name));
                        setActivePicker(null);
                    }}
                />
            )}
        </>
    );
}
