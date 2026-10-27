import { decode } from "base64-arraybuffer";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { useCocktail } from "@/hooks/useCocktails";
import { saveItemNotes } from "@/hooks/useItemNotes";
import { dropdownKeys, useDropdowns } from "@/hooks/useDropdowns";
import { GLASS_MODEL_SELECT, type GlassModel } from "@/hooks/useGlassModels";
import { identifyGlasswareFromPhoto } from "@/lib/identifyGlassware";
import { imageExtFromUri, uriToBase64 } from "@/lib/imageBase64";
import { readIceBuild, saysMore, type IceLayer } from "@/lib/iceBuild";
import { isHeroLink } from "@/lib/itemImages";
import { plainDbMessage } from "@/lib/dbError";
import { findByName, orderedMethodIds, toggleId } from "@/lib/drinkMethods";
import { kindColumns } from "@/lib/glassware";
import { capitalize } from "@/lib/stringUtils";
import { fetchEditableRecipes } from "@/lib/editableRecipes";
import { mapPresentationRecipeToEditItem } from "@/lib/recipeUtils";
import { supabase, UPLOAD_CACHE_SECONDS } from "@/lib/supabase";
import { saveDrinkSpec } from "@/hooks/useVersions";
import { resolveEditItems } from "@/hooks/specLineSave";
import { refreshIngredients } from "@/hooks/useDropdowns";
import { showMessage } from "@/lib/dialogs";
import { amountOf, type WizardPick } from "@/lib/drinkWizard";
import { orderByPart, linePart, partsMethods, readParts, startParts, storedParts, type DraftPart } from "@/lib/drinkParts";
import type { ImageItem } from "@/components/cocktail/SortableImageList";
import { pickDrinkPhotos, setItemImages } from "@/components/drink/drinkImages";

export type SpecCategory = "method" | "glassware" | "family" | "ice";

import { toLine, type SortableRecipeItem } from '@/lib/recipeItem';

/** A method list's ids (a method picked in the editor always has one). */
const idsOf = (picks: readonly WizardPick[]) => picks.flatMap((m) => (m.id ? [m.id] : []));
/** A line's key, as the spec list knows it. */
const keyOf = (item: SortableRecipeItem, i: number) => toLine(item, i).key;

export function useCocktailEditor(id: string, { enabled = true }: { enabled?: boolean } = {}) {
    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns({ ingredients: enabled });
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(enabled ? id : undefined);

    const isLoaded = useRef(false);
    const loadedNotes = useRef("");
    const [rawLoaded, setRawLoaded] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [notes, setNotes] = useState("");

    const [methodIds, setMethodIds] = useState<string[]>([]);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);
    // The ice it's made with, and how the ice sits (20261029100000, 20261029500000). Saved only once changed here, so a database without them still saves.
    const [methodIceId, setMethodIceIdState] = useState<string | null>(null);
    const [iceBuild, setIceBuildState] = useState<IceLayer<string>[] | null>(null);
    const iceTouched = useRef(false);
    // How its glass is drawn (lib/sketch/geometry.ts GLASS_VARIANTS); null is the bar's glass or the default.
    const [sketchVariant, setSketchVariant] = useState<string | null>(null);
    // The real glass it's served in (items.glass_model_id); glasswareId stays its shape.
    const [glassModel, setGlassModelState] = useState<GlassModel | null>(null);

    const [barId, setBarId] = useState<string | null>(null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);

    const [recipeItems, setRecipeItems] = useState<SortableRecipeItem[]>([]);
    // Made in parts (20261123100000_drink_parts.sql): each part's name, join, lines (by key) and methods; null is one part. The lines stay in part order.
    const [parts, setPartsState] = useState<DraftPart[] | null>(null);
    // It had parts when it loaded: turned off, the save says so (one part again).
    const hadParts = useRef(false);
    // Each method's name as loaded with the drink, for part 1 when parts are turned on (the shared list may not have it yet).
    const methodNames = useRef<Record<string, string>>({});
    const [localImages, setLocalImages] = useState<ImageItem[]>([]);

    const markDirty = useCallback(() => setIsDirty(true), []);

    const wrap = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        markDirty();
    };

    const setNameDirty = wrap(setName);
    const setDescriptionDirty = wrap(setDescription);
    const setOriginDirty = wrap(setOrigin);
    const setNotesDirty = wrap(setNotes);
    const setMethodIdsDirty = wrap(setMethodIds);
    const setGlasswareIdDirty = wrap(setGlasswareId);
    const setFamilyIdDirty = wrap(setFamilyId);
    const setIceIdDirty = wrap(setIceId);
    const setSketchVariantDirty = wrap(setSketchVariant);
    const setBarIdDirty = wrap(setBarId);
    const setOverrideVisibilityDirty = wrap(setOverrideVisibility);
    const setOverrideGenericDirty = wrap(setOverrideGeneric);
    const setOverrideSpecificDirty = wrap(setOverrideSpecific);
    const setOverrideMeasurementDirty = wrap(setOverrideMeasurement);
    const setOverridePrepDirty = wrap(setOverridePrep);

    const setRecipeItemsDirty = useCallback((items: SortableRecipeItem[] | ((prev: SortableRecipeItem[]) => SortableRecipeItem[])) => {
        setRecipeItems(items);
        markDirty();
    }, [markDirty]);

    const setLocalImagesDirty = useCallback((images: ImageItem[] | ((prev: ImageItem[]) => ImageItem[])) => {
        setLocalImages(images);
        markDirty();
    }, [markDirty]);

    useEffect(() => {
        if (!enabled || !cocktail || isLoaded.current) return;
        isLoaded.current = true;
        const c = cocktail as any;

        setName(c.name || "");
        setDescription(c.description || "");
        setOrigin(c.origin || "");
        setNotes(c.notes || "");
        loadedNotes.current = c.notes || "";
        setMethodIds(orderedMethodIds(c.item_methods));
        setGlasswareId(c.glassware_id);
        setFamilyId(c.family_id);
        setIceId(c.ice_id);

        if (c.item_images) {
            // Service photos (side, top, ...) are managed on the drink page, not here.
            const sorted = c.item_images.filter(isHeroLink).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
            setLocalImages(
                sorted
                    .map((ci: any) => ({ id: ci.images?.id, url: ci.images?.url, isNew: false }))
                    .filter((img: ImageItem) => img.url)
            );
        }

        // Recipe rows and bar settings come from the raw tables, not the role-masked
        // presentation views: a save writes every field back, so masked values
        // would overwrite real ones. Saving waits until both have loaded.
        setRawLoaded(false);
        Promise.all([
            fetchEditableRecipes(id),
            supabase
                .from("items")
                .select(
                    // Every column: method_ice_id and ice_build only exist once their migrations are in.
                    // The methods too, each with its part: the cached drink can be older than the parts it saves back.
                    `*, glass_model:glass_models!items_glass_model_id_fkey(${GLASS_MODEL_SELECT}), item_methods!item_methods_item_id_fkey(method_item_id, sort_order, part, method:items!item_methods_method_item_id_fkey(name))`
                )
                .eq("id", id)
                .single(),
        ])
            .then(([recipes, { data, error }]) => {
                if (error || !data) throw error ?? new Error("Cocktail not found");
                // Keyed by row, so each part can name its lines.
                const items = recipes.map((r: any) => ({
                    ...mapPresentationRecipeToEditItem(r, { includeCocktailFields: true }),
                    key: r.id,
                })) as SortableRecipeItem[];
                const stored = readParts((data as { parts?: unknown }).parts);
                const methodRows = [...(data.item_methods ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                methodNames.current = Object.fromEntries(methodRows.map((m) => [m.method_item_id, m.method?.name ?? ""]));
                const loaded: DraftPart[] | null = stored
                    ? stored.map((p, i) => ({
                          name: p.name,
                          join: p.join ?? null,
                          // Made fresh for each serve (20261126200000): kept, or a save here would make it ahead again.
                          ...(p.fresh ? { fresh: true } : {}),
                          lines: recipes.filter((r) => (r.part ?? 1) === i + 1).map((r) => r.id),
                          methods: methodRows.filter((m) => m.part === i + 1).map((m) => ({ id: m.method_item_id, name: m.method?.name ?? "" })),
                      }))
                    : null;
                hadParts.current = !!loaded;
                // In parts, the drink's one list of methods is read from them (methodIds below); a method changed while this loaded isn't overwritten in one part.
                if (loaded) setMethodIds(orderedMethodIds(methodRows));
                setPartsState(loaded);
                setRecipeItems(orderByPart(loaded, items));
                setBarId(data.bar_id);
                setSketchVariant(data.sketch_variant ?? null);
                setGlassModelState((data as unknown as { glass_model: GlassModel | null }).glass_model ?? null);
                const ices = data as unknown as { method_ice_id?: string | null; ice_build?: unknown };
                // The ice from this read, not the cached drink's: a stale one saved back would move the build's top layer.
                setIceId(data.ice_id);
                setMethodIceIdState(ices.method_ice_id ?? null);
                setIceBuildState(readIceBuild(ices.ice_build));
                iceTouched.current = false;
                setOverrideVisibility(data.override_visibility_level?.toString() || null);
                setOverrideGeneric(data.override_generic_ingredient_level?.toString() || null);
                setOverrideSpecific(data.override_specific_brand_level?.toString() || null);
                setOverrideMeasurement(data.override_measurement_level?.toString() || null);
                setOverridePrep(data.override_prep_level?.toString() || null);
                setRawLoaded(true);
            })
            .catch(() => {
                Alert.alert("Error", "Could not load this cocktail for editing.");
            });
    }, [cocktail, enabled, id]);

    const resetLoaded = useCallback(() => {
        isLoaded.current = false;
        setIsDirty(false);
    }, []);

    const discardChanges = useCallback(() => {
        resetLoaded();
    }, [resetLoaded]);

    const addImages = useCallback((uris: string[]) => {
        if (!uris.length) return;
        setLocalImagesDirty((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
    }, []);

    const pickImage = async () => addImages(await pickDrinkPhotos({ cutout: true }));

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = imageExtFromUri(uri);
            const fileName = `cocktails/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await uriToBase64(uri);
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from("drinks")
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                    upsert: false,
                    cacheControl: UPLOAD_CACHE_SECONDS,
                });
            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage.from("drinks").getPublicUrl(fileName);
            const { data: imgData, error: imgError } = await supabase
                .from("images")
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();
            if (imgError || !imgData) return null;
            return imgData.id;
        } catch {
            return null;
        }
    };

    /** Finds or creates a shared method, glass, family or ice by name, a new glass or ice with its kind. The picker selects the id it returns. */
    const handleAddPill = async (type: SpecCategory, newItemName: string, kind?: string | null): Promise<string> => {
        if (!newItemName.trim()) throw new Error("Name is required");
        const lists = { method: "methods", glassware: "glassware", family: "families", ice: "iceTypes" } as const;
        let newId = findByName(dropdowns?.[lists[type]] ?? [], newItemName)?.id;
        if (!newId) {
            const { data, error } = await supabase
                .from("items")
                .insert({
                    name: capitalize(newItemName.trim()),
                    item_type: type,
                    ...kindColumns(type, kind),
                })
                .select("id")
                .single();
            if (error || !data) throw error || new Error(`Failed to create ${type}`);
            await queryClient.invalidateQueries({ queryKey: dropdownKeys.specs });
            newId = data.id;
        }
        return newId;
    };

    const identifyGlassware = identifyGlasswareFromPhoto;

    const handleAddGlassware = async (payload: {
        name: string;
        iconKey: string | null;
        iconUrl: string | null;
    }): Promise<string> => {
        const { data, error } = await supabase
            .from("items")
            .insert({
                name: capitalize(payload.name.trim()),
                item_type: "glassware",
                icon_key: payload.iconKey,
                icon_url: payload.iconUrl,
            })
            .select("id")
            .single();
        if (error || !data) throw error || new Error("Failed to create glassware");
        await queryClient.invalidateQueries({ queryKey: dropdownKeys.specs });
        setGlasswareIdDirty(data.id);
        return data.id;
    };

    function setSpecId(category: SpecCategory, value: string | null) {
        const setters = {
            method: (id: string | null) => setMethodIdsDirty(id ? [id] : []),
            // Another shape lets the model go (the database does the same).
            glassware: (id: string | null) => {
                setGlasswareIdDirty(id);
                setGlassModelState((m) => (m && m.shape_item_id === id ? m : null));
            },
            family: setFamilyIdDirty,
            // One plain ice: a build it had goes (the database keeps ice_id as a build's top layer).
            ice: (id: string | null) => {
                setIceIdDirty(id);
                iceTouched.current = true;
                setIceBuildState(null);
            },
        };
        setters[category](value);
    }

    const getSpecId = (category: SpecCategory) => {
        const ids = { method: methodIds[0] ?? null, glassware: glasswareId, family: familyId, ice: iceId };
        return ids[category];
    };

    /** Serves it in a maker's glass, and in that glass's shape; null keeps the shape. */
    const setGlassModel = (model: GlassModel | null) => {
        setGlassModelState(model);
        if (model?.shape_item_id) setGlasswareId(model.shape_item_id);
        markDirty();
    };

    const setMethodIceId = (value: string | null) => {
        iceTouched.current = true;
        setMethodIceIdState(value);
        markDirty();
    };
    /** How the ice sits, bottom first; its top layer is the drink's one ice. Empty clears both. */
    const setIceBuild = (layers: IceLayer<string>[]) => {
        iceTouched.current = true;
        setIceBuildState(layers.length ? layers : null);
        setIceIdDirty(layers.length ? layers[layers.length - 1].ice : null);
    };

    /** Adds a method to this drink, or takes it off. Never touches the method itself. */
    const toggleMethod = (methodItemId: string) => setMethodIdsDirty((prev) => toggleId(prev, methodItemId));

    /**
     * Made in parts changed: a name, a join, which lines or methods a part
     * has, a part added, moved or removed. The drink's one list of methods
     * is read from the parts while they're on (methodIds below), and the
     * lines stay in part order. Under two parts it's one part again, with
     * the first's methods.
     */
    const setParts = (next: DraftPart[] | null) => {
        const kept = next && next.length > 1 ? next : null;
        setPartsState(kept);
        if (next?.length && !kept) setMethodIds(idsOf(next[0].methods));
        // The same array when nothing moved, so renaming a part doesn't redraw every line.
        if (kept) setRecipeItems((prev) => {
            const sorted = orderByPart(kept, prev);
            return sorted.every((item, i) => item === prev[i]) ? prev : sorted;
        });
        markDirty();
    };

    /** A method on or off in one part (its sheet). From the latest parts, so one added by name after a wait doesn't undo a tap made meanwhile. */
    const togglePartMethod = (at: number, id: string, name: string) => {
        const named = (dropdowns?.methods ?? []).find((m) => m.id === id)?.name ?? capitalize(name);
        setPartsState((prev) =>
            prev?.map((p, i) => (i === at ? { ...p, methods: p.methods.some((m) => m.id === id) ? p.methods.filter((m) => m.id !== id) : [...p.methods, { id, name: named }] } : p)) ?? prev
        );
        markDirty();
    };

    /** The Made in parts switch: on, the drink so far is part 1 and part 2 floats on it; off joins the lines and the methods in order. */
    const setMadeInParts = (on: boolean) => {
        if (on) {
            const named = (id: string) => (dropdowns?.methods ?? []).find((m) => m.id === id)?.name ?? methodNames.current[id] ?? "";
            return setParts(startParts({ lines: recipeItems.map(toLine), methods: methodIds.map((mid) => ({ id: mid, name: named(mid) })) }));
        }
        if (parts) setMethodIds(idsOf(partsMethods(parts)));
        setPartsState(null);
        markDirty();
    };

    const handleSave = async (): Promise<boolean> => {
        if (!rawLoaded) {
            Alert.alert("Still loading", "Wait for the recipe to finish loading, then save again.");
            return false;
        }
        if (!name?.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }

        setSaving(true);
        try {
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            await setItemImages(id, finalImageIds, { replace: true });

            const { error } = await supabase
                .from("items")
                .update({
                    name: capitalize(name),
                    description,
                    origin: capitalize(origin) || null,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                    ...(iceTouched.current ? { method_ice_id: methodIceId, ice_build: saysMore(iceBuild) ? iceBuild : null } : {}),
                    sketch_variant: sketchVariant,
                    glass_model_id: glassModel?.id ?? null,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .eq("id", id);
            if (error) throw error;
            // Only when changed: notes for a role above yours never reach the editor, so an empty box isn't a clear (E29).
            if (notes.trim() !== loadedNotes.current.trim()) await saveItemNotes(id, notes);

            // A line typed, combined or made in-house here is added the way New adds it.
            const spec = await resolveEditItems(recipeItems, barId || null);
            setRecipeItems(spec.items);
            // Made in parts: each line's part, each part's methods with its number (Build can be in two), and the parts.
            // Turned off here, everything goes back to one part; a drink that never had parts sends none, as before.
            const parted = parts && parts.length > 1 ? parts : null;
            const ordered = orderByPart(parted, spec.items);
            const partOf = (item: SortableRecipeItem, i: number) => (parted ? linePart(parted, keyOf(item, i), false) : 1);
            const byPartMethods = parted ? parted.flatMap((p, i) => idsOf(p.methods).map((mid) => ({ id: mid, part: i + 1 }))) : null;
            // Lines and method go through save_drink_spec: one transaction, and a
            // version of the spec written with it (History on the drink page).
            await saveDrinkSpec(
                id,
                ordered.map((item, i) => ({
                    id: item.id ?? null,
                    ingredient_item_id: item.ingredient_id,
                    amount: amountOf(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
                    ...(parted || hadParts.current ? { part: partOf(item, i) } : {}),
                })),
                byPartMethods ? byPartMethods.map((m) => m.id) : methodIds,
                null,
                parted && byPartMethods
                    ? { methodParts: byPartMethods.map((m) => m.part), parts: storedParts(parted) }
                    : hadParts.current
                      ? { methodParts: methodIds.map(() => 1), parts: [] }
                      : undefined
            );
            if (spec.created.length) void refreshIngredients(queryClient, spec.created);
            if (spec.warnings.length) showMessage("Saved", spec.warnings.join("\n\n"));

            await queryClient.invalidateQueries({ queryKey: ["cocktail", id] });
            await queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            // The database redraws it in the chosen glass as the row saves.
            await queryClient.invalidateQueries({ queryKey: ["item-sketch", id] });
            await queryClient.invalidateQueries({ queryKey: ["drink-glass-model", id] });
            setIsDirty(false);
            isLoaded.current = false;
            return true;
        } catch (error) {
            Alert.alert("Error", plainDbMessage(error) ?? "Failed to update cocktail.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        loading: loadingDropdowns || loadingCocktail || (enabled && !rawLoaded),
        /** The drink's own spec and settings are in (the ingredient catalogue may still be downloading). */
        specLoaded: rawLoaded,
        saving,
        isDirty,
        dropdowns,
        methods: dropdowns?.methods || [],
        glassware: dropdowns?.glassware || [],
        families: dropdowns?.families || [],
        iceTypes: dropdowns?.iceTypes || [],
        allIngredients: dropdowns?.ingredients || [],
        name,
        setName: setNameDirty,
        description,
        setDescription: setDescriptionDirty,
        origin,
        setOrigin: setOriginDirty,
        notes,
        setNotes: setNotesDirty,
        // In parts, every part's, each once (lib/drinkParts partsMethods): the ice line and anything else that reads one list.
        methodIds: parts ? idsOf(partsMethods(parts)) : methodIds,
        setMethodIds: setMethodIdsDirty,
        toggleMethod,
        glasswareId,
        familyId,
        iceId,
        methodIceId,
        setMethodIceId,
        iceBuild,
        setIceBuild,
        sketchVariant,
        setSketchVariant: setSketchVariantDirty,
        glassModel,
        setGlassModel,
        setSpecId,
        getSpecId,
        barId,
        setBarId: setBarIdDirty,
        overrideVisibility,
        setOverrideVisibility: setOverrideVisibilityDirty,
        overrideGeneric,
        setOverrideGeneric: setOverrideGenericDirty,
        overrideSpecific,
        setOverrideSpecific: setOverrideSpecificDirty,
        overrideMeasurement,
        setOverrideMeasurement: setOverrideMeasurementDirty,
        overridePrep,
        setOverridePrep: setOverridePrepDirty,
        recipeItems,
        setRecipeItems: setRecipeItemsDirty,
        parts,
        setParts,
        setMadeInParts,
        togglePartMethod,
        localImages,
        setLocalImages: setLocalImagesDirty,
        addImages,
        pickImage,
        handleAddPill,
        handleAddGlassware,
        identifyGlassware,
        handleSave,
        resetLoaded,
        discardChanges,
    };
}
