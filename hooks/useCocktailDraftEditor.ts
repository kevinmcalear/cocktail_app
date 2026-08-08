import { decode } from "base64-arraybuffer";
import * as FilePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import type { ImageItem } from "@/components/cocktail/SortableImageList";
import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { useDrafts } from "@/hooks/useDrafts";
import { DROPDOWNS_QUERY_KEY, useDropdowns } from "@/hooks/useDropdowns";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import {
    resolveIngredientId,
    updateMenuDraftsWithPublishedId,
    updateParentDraftsWithPublishedId,
} from "@/lib/drafts";
import { identifyGlasswareFromPhoto } from "@/lib/identifyGlassware";
import { imageExtFromUri, uriToBase64 } from "@/lib/imageBase64";
import { withDrinkInSection } from "@/lib/menuDrinkAttach";
import { capitalize } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { useCreatorNavStore } from "@/store/useCreatorNavStore";
import { useRecentActivityStore } from "@/store/useRecentActivityStore";
import type { SpecCategory, SpecDbField } from "@/hooks/useCocktailEditor";

const SPEC_DB_FIELD: Record<SpecCategory, SpecDbField> = {
    method: "method_id",
    glassware: "glassware_id",
    family: "family_id",
    ice: "ice_id",
};

export interface UseCocktailDraftEditorOptions {
    draftId?: string | null;
    barId?: string | null;
    menuDraftId?: string | null;
    menuSectionId?: string | null;
    initialName?: string | null;
    enabled?: boolean;
}

export function useCocktailDraftEditor({
    draftId: initialDraftId,
    barId: initialBarId,
    menuDraftId,
    menuSectionId,
    initialName,
    enabled = true,
}: UseCocktailDraftEditorOptions = {}) {
    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();

    const [currentDraftId, setCurrentDraftId] = useState<string | null>(initialDraftId || null);
    const draftLoadedRef = useRef<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const [name, setName] = useState(initialName ? capitalize(initialName) : "");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [notes, setNotes] = useState("");
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);
    const [barId, setBarId] = useState<string | null>(initialBarId || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);
    const [recipeItems, setRecipeItems] = useState<SortableRecipeItem[]>([]);
    const [localImages, setLocalImages] = useState<ImageItem[]>([]);

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    useTrackRecent(
        enabled && !!trackedDraft,
        trackedDraft
            ? recentEntry(
                  'cocktail',
                  trackedDraft.id,
                  trackedDraft.draft_data?.name || name || 'Untitled Cocktail',
                  {
                      isDraft: true,
                      imageUrl: trackedDraft.draft_data?.localImages?.[0]?.url,
                      barId: trackedDraft.bar_id ?? barId ?? null,
                  }
              )
            : null
    );

    const markDirty = useCallback(() => setIsDirty(true), []);
    const wrap = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        markDirty();
    };

    const methods = dropdowns?.methods || [];
    const glassware = dropdowns?.glassware || [];
    const families = dropdowns?.families || [];
    const iceTypes = dropdowns?.iceTypes || [];

    const allIngredients = useMemo(() => {
        const published = (dropdowns?.ingredients || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            item_images: i.item_images,
        }));
        const draftIngredients = drafts
            .filter((d: any) => d.entity_type === "ingredient")
            .map((d: any) => {
                const url = d.draft_data?.localImages?.[0]?.url;
                return {
                    id: d.id,
                    name: d.draft_data?.name || "Untitled Ingredient Draft",
                    item_images: url ? [{ images: { url } }] : undefined,
                };
            });
        const combined = [...draftIngredients, ...published];
        const seen = new Set<string>();
        return combined.filter((i) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });
    }, [dropdowns?.ingredients, drafts]);

    const draftDataSnapshot = useMemo(
        () =>
            JSON.stringify({
                name,
                description,
                origin,
                notes,
                methodId,
                glasswareId,
                familyId,
                iceId,
                barId,
                recipeItems,
                localImages,
                overrideVisibility,
                overrideGeneric,
                overrideSpecific,
                overrideMeasurement,
                overridePrep,
            }),
        [
            name,
            description,
            origin,
            notes,
            methodId,
            glasswareId,
            familyId,
            iceId,
            barId,
            recipeItems,
            localImages,
            overrideVisibility,
            overrideGeneric,
            overrideSpecific,
            overrideMeasurement,
            overridePrep,
        ]
    );

    const cleanSnapshotRef = useRef(draftDataSnapshot);

    useEffect(() => {
        if (!enabled || !currentDraftId || drafts.length === 0 || draftLoadedRef.current === currentDraftId) {
            if (!currentDraftId && enabled) draftLoadedRef.current = "__new__";
            return;
        }
        if (isFetching) return;

        const draft = drafts.find((d: any) => d.id === currentDraftId);
        if (draft?.draft_data) {
            const data = draft.draft_data;
            setName(data.name || "");
            setDescription(data.description || "");
            setOrigin(data.origin || "");
            setNotes(data.notes || "");
            setMethodId(data.methodId || null);
            setGlasswareId(data.glasswareId || null);
            setFamilyId(data.familyId || null);
            setIceId(data.iceId || null);
            setBarId(data.barId || initialBarId || null);
            setRecipeItems(data.recipeItems || []);
            setLocalImages(
                (data.localImages || []).map((img: any) => ({
                    id: img.id,
                    url: img.url,
                    isNew: false,
                }))
            );
            setOverrideVisibility(data.overrideVisibility || null);
            setOverrideGeneric(data.overrideGeneric || null);
            setOverrideSpecific(data.overrideSpecific || null);
            setOverrideMeasurement(data.overrideMeasurement || null);
            setOverridePrep(data.overridePrep || null);
            draftLoadedRef.current = currentDraftId;
            cleanSnapshotRef.current = JSON.stringify({
                name: data.name || "",
                description: data.description || "",
                origin: data.origin || "",
                notes: data.notes || "",
                methodId: data.methodId || null,
                glasswareId: data.glasswareId || null,
                familyId: data.familyId || null,
                iceId: data.iceId || null,
                barId: data.barId || initialBarId || null,
                recipeItems: data.recipeItems || [],
                localImages: data.localImages || [],
                overrideVisibility: data.overrideVisibility || null,
                overrideGeneric: data.overrideGeneric || null,
                overrideSpecific: data.overrideSpecific || null,
                overrideMeasurement: data.overrideMeasurement || null,
                overridePrep: data.overridePrep || null,
            });
            setIsDirty(false);
        } else {
            draftLoadedRef.current = currentDraftId;
        }
    }, [currentDraftId, drafts, enabled, initialBarId, isFetching]);

    const persistDraft = useCallback(
        async (silent = true) => {
            const draftData = {
                name,
                description,
                origin,
                notes,
                methodId,
                glasswareId,
                familyId,
                iceId,
                barId,
                recipeItems,
                localImages: localImages.map((img) => ({ id: img.id, url: img.url })),
                overrideVisibility,
                overrideGeneric,
                overrideSpecific,
                overrideMeasurement,
                overridePrep,
            };
            const result = await saveDraft({
                id: currentDraftId || undefined,
                entityType: "cocktail",
                draftData,
            });
            if (!currentDraftId && result?.id) {
                setCurrentDraftId(result.id);
                draftLoadedRef.current = result.id;
            }
            if (menuSectionId && result?.id) {
                if (menuDraftId) {
                    const menuDraft = drafts.find((d: any) => d.id === menuDraftId);
                    if (menuDraft) {
                        const selections = withDrinkInSection(
                            menuDraft.draft_data?.selections || {},
                            menuSectionId,
                            result.id
                        );
                        await saveDraft({
                            id: menuDraft.id,
                            entityType: "menu",
                            draftData: { ...menuDraft.draft_data, selections },
                        });
                    }
                }
                // notify picker host so UI updates even if menu remounts without draftId
                useCreatorNavStore.getState().deliverMenuDrink(menuSectionId, result.id);
            }
            cleanSnapshotRef.current = draftDataSnapshot;
            setIsDirty(false);
            if (!silent && Platform.OS === "web") {
                window.alert("Draft saved.");
            } else if (!silent) {
                Alert.alert("Success", "Draft saved.");
            }
            return result?.id ?? currentDraftId;
        },
        [
            name,
            description,
            origin,
            notes,
            methodId,
            glasswareId,
            familyId,
            iceId,
            barId,
            recipeItems,
            localImages,
            overrideVisibility,
            overrideGeneric,
            overrideSpecific,
            overrideMeasurement,
            overridePrep,
            currentDraftId,
            saveDraft,
            menuDraftId,
            menuSectionId,
            drafts,
            draftDataSnapshot,
        ]
    );

    // ponytail: debounced draft persist so workspace edits survive navigation
    useEffect(() => {
        if (!enabled || !isDirty || draftDataSnapshot === cleanSnapshotRef.current) return;
        const timer = setTimeout(() => {
            void persistDraft(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, [draftDataSnapshot, enabled, isDirty, persistDraft]);

    const addImages = useCallback(
        (uris: string[]) => {
            if (!uris.length) return;
            setLocalImages((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
            markDirty();
        },
        [markDirty]
    );

    const pickImage = async () => {
        const { status } = await FilePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
            return;
        }
        const result = await FilePicker.launchImageLibraryAsync({
            mediaTypes: FilePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });
        if (!result.canceled) {
            addImages(result.assets.map((asset) => asset.uri));
        }
    };

    const uploadImage = async (uri: string, cocktailId: string): Promise<string | null> => {
        try {
            if (uri.startsWith("http")) {
                const { data: imgData } = await supabase
                    .from("images")
                    .select("id")
                    .eq("url", uri)
                    .limit(1)
                    .single();
                if (imgData) return imgData.id;

                const { data: newImgData, error: newImgError } = await supabase
                    .from("images")
                    .insert({ url: uri })
                    .select()
                    .single();
                if (!newImgError && newImgData) return newImgData.id;
                return null;
            }

            const ext = imageExtFromUri(uri);
            const fileName = `cocktails/${cocktailId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await uriToBase64(uri);
            const arrayBuffer = decode(base64);
            const { error: uploadError } = await supabase.storage
                .from("drinks")
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                    upsert: false,
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

    const handleAddPill = async (type: SpecCategory, newItemName: string): Promise<string> => {
        if (!newItemName.trim()) throw new Error("Name is required");
        const { data, error } = await supabase
            .from("items")
            .insert({
                name: capitalize(newItemName.trim()),
                item_type: type,
            })
            .select("id")
            .single();
        if (error || !data) throw error || new Error(`Failed to create ${type}`);
        await queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
        ({
            method: setMethodId,
            glassware: setGlasswareId,
            family: setFamilyId,
            ice: setIceId,
        })[type](data.id);
        markDirty();
        return data.id;
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
        await queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
        setGlasswareId(data.id);
        markDirty();
        return data.id;
    };

    const confirmDeletePill = async (field: SpecDbField, pillId: string) => {
        await supabase.from("items").update({ [field]: null }).eq(field, pillId);
        const { error } = await supabase.from("items").delete().eq("id", pillId);
        if (error) throw error;
        if (field === "method_id" && methodId === pillId) setMethodId(null);
        if (field === "glassware_id" && glasswareId === pillId) setGlasswareId(null);
        if (field === "family_id" && familyId === pillId) setFamilyId(null);
        if (field === "ice_id" && iceId === pillId) setIceId(null);
        markDirty();
        await queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
    };

    const handleDeletePill = async (category: SpecCategory, item: { id: string; name: string }) => {
        const field = SPEC_DB_FIELD[category];
        try {
            const { data: affected, error } = await supabase
                .from("items")
                .select("id, name")
                .eq(field, item.id)
                .eq("item_type", "cocktail");
            if (error) throw error;

            const confirm = () => confirmDeletePill(field, item.id);
            if (affected && affected.length > 0) {
                const names = affected.map((c: any) => c.name).join(", ");
                Alert.alert(
                    "Warning",
                    `Deleting this item will remove it from ${affected.length} cocktail(s):\n\n${names}\n\nAre you sure?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: confirm },
                    ]
                );
            } else {
                Alert.alert("Confirm Delete", `Delete "${item.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: confirm },
                ]);
            }
        } catch {
            Alert.alert("Error", "Could not check affected cocktails.");
        }
    };

    const setSpecId = (category: SpecCategory, value: string | null) => {
        const setters = {
            method: setMethodId,
            glassware: setGlasswareId,
            family: setFamilyId,
            ice: setIceId,
        };
        setters[category](value);
        markDirty();
    };

    const getSpecId = (category: SpecCategory) => {
        const ids = { method: methodId, glassware: glasswareId, family: familyId, ice: iceId };
        return ids[category];
    };

    const performPublish = async (): Promise<boolean> => {
        setSaving(true);
        try {
            const resolvedRecipeItems = [];
            for (const item of recipeItems) {
                const resolvedId = await resolveIngredientId(item.ingredient_id, drafts);
                if (resolvedId !== item.ingredient_id) {
                    await updateParentDraftsWithPublishedId(item.ingredient_id, resolvedId, drafts, saveDraft);
                }
                resolvedRecipeItems.push({ ...item, ingredient_id: resolvedId });
            }

            const { data: cocktail, error: cocktailError } = await supabase
                .from("items")
                .insert({
                    name: capitalize(name),
                    description,
                    origin: capitalize(origin) || null,
                    notes: notes || null,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                    item_type: "cocktail",
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .select()
                .single();

            if (cocktailError || !cocktail) throw cocktailError;
            const cocktailId = cocktail.id;

            for (let i = 0; i < localImages.length; i++) {
                const imgId = await uploadImage(localImages[i].url, cocktailId);
                if (imgId) {
                    await supabase.from("item_images").insert({
                        item_id: cocktailId,
                        image_id: imgId,
                        sort_order: i,
                    });
                }
            }

            for (const [index, item] of resolvedRecipeItems.entries()) {
                await supabase.from("recipes").insert({
                    recipe_item_id: cocktailId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
                    sort_order: index,
                });
            }

            if (methodId) {
                await supabase.from("item_methods").insert({
                    item_id: cocktailId,
                    method_item_id: methodId,
                    sort_order: 0,
                });
            }

            queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            await queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });

            const activeDraftId = currentDraftId;
            if (menuSectionId) {
                if (menuDraftId) {
                    const menuDraft = drafts.find((d: any) => d.id === menuDraftId);
                    if (menuDraft) {
                        const selections = withDrinkInSection(
                            menuDraft.draft_data?.selections || {},
                            menuSectionId,
                            cocktailId,
                            activeDraftId
                        );
                        await saveDraft({
                            id: menuDraft.id,
                            entityType: "menu",
                            draftData: { ...menuDraft.draft_data, selections },
                        });
                    }
                }
                useCreatorNavStore
                    .getState()
                    .deliverMenuDrink(menuSectionId, cocktailId, activeDraftId || undefined);
            }

            if (activeDraftId) {
                await updateMenuDraftsWithPublishedId(activeDraftId, cocktailId, drafts, saveDraft);
                await deleteDraft(activeDraftId);
            }

            useRecentActivityStore.getState().push(
                recentEntry('cocktail', cocktailId, name || 'Untitled Cocktail', {
                    barId: barId ?? null,
                    imageUrl: localImages[0]?.url,
                })
            );

            if (barId) {
                queryClient.invalidateQueries({ queryKey: ["bar", barId] });
            }

            setIsDirty(false);
            return true;
        } catch {
            Alert.alert("Error", "Failed to publish cocktail.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = async (silent = false): Promise<string | null> => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return null;
        }
        setSaving(true);
        try {
            return (await persistDraft(silent)) ?? null;
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async (): Promise<boolean> => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }

        const proceed = async () => performPublish();

        if (Platform.OS === "web") {
            if (window.confirm("Publish this cocktail?")) {
                return proceed();
            }
            return false;
        }

        return new Promise((resolve) => {
            Alert.alert("Publish Cocktail", "Are you sure you want to publish this cocktail?", [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Publish", onPress: () => void proceed().then(resolve) },
            ]);
        });
    };

    // ponytail: handleSave kept as publish alias for older call sites
    const handleSave = handlePublish;

    const handleDelete = async (): Promise<boolean> => {
        const proceed = async () => {
            if (currentDraftId) {
                await deleteDraft(currentDraftId);
            }
            return true;
        };

        if (!currentDraftId && !isDirty && !name.trim()) {
            return true;
        }

        if (Platform.OS === "web") {
            if (window.confirm("Delete this cocktail draft?")) {
                return proceed();
            }
            return false;
        }

        return new Promise((resolve) => {
            Alert.alert("Delete Draft", "Are you sure you want to delete this draft?", [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => void proceed().then(resolve) },
            ]);
        });
    };

    const discardChanges = useCallback(() => {
        try {
            const snap = JSON.parse(cleanSnapshotRef.current);
            setName(snap.name || "");
            setDescription(snap.description || "");
            setOrigin(snap.origin || "");
            setNotes(snap.notes || "");
            setMethodId(snap.methodId || null);
            setGlasswareId(snap.glasswareId || null);
            setFamilyId(snap.familyId || null);
            setIceId(snap.iceId || null);
            setBarId(snap.barId || initialBarId || null);
            setRecipeItems(snap.recipeItems || []);
            setLocalImages(
                (snap.localImages || []).map((img: any) => ({
                    id: img.id,
                    url: img.url,
                    isNew: false,
                }))
            );
            setOverrideVisibility(snap.overrideVisibility || null);
            setOverrideGeneric(snap.overrideGeneric || null);
            setOverrideSpecific(snap.overrideSpecific || null);
            setOverrideMeasurement(snap.overrideMeasurement || null);
            setOverridePrep(snap.overridePrep || null);
            setIsDirty(false);
        } catch {
            /* noop */
        }
    }, [initialBarId]);

    const loading =
        loadingDropdowns ||
        (!!currentDraftId && draftLoadedRef.current !== currentDraftId && isFetching);

    return {
        loading,
        saving,
        isDirty,
        draftId: currentDraftId,
        dropdowns,
        methods,
        glassware,
        families,
        iceTypes,
        allIngredients,
        name,
        setName: wrap(setName),
        description,
        setDescription: wrap(setDescription),
        origin,
        setOrigin: wrap(setOrigin),
        notes,
        setNotes: wrap(setNotes),
        methodId,
        glasswareId,
        familyId,
        iceId,
        setSpecId,
        getSpecId,
        barId,
        setBarId: wrap(setBarId),
        overrideVisibility,
        setOverrideVisibility: wrap(setOverrideVisibility),
        overrideGeneric,
        setOverrideGeneric: wrap(setOverrideGeneric),
        overrideSpecific,
        setOverrideSpecific: wrap(setOverrideSpecific),
        overrideMeasurement,
        setOverrideMeasurement: wrap(setOverrideMeasurement),
        overridePrep,
        setOverridePrep: wrap(setOverridePrep),
        recipeItems,
        setRecipeItems: useCallback(
            (items: SortableRecipeItem[] | ((prev: SortableRecipeItem[]) => SortableRecipeItem[])) => {
                setRecipeItems(items);
                markDirty();
            },
            [markDirty]
        ),
        localImages,
        setLocalImages: useCallback(
            (images: ImageItem[] | ((prev: ImageItem[]) => ImageItem[])) => {
                setLocalImages(images);
                markDirty();
            },
            [markDirty]
        ),
        addImages,
        pickImage,
        handleAddPill,
        handleAddGlassware,
        identifyGlassware,
        handleDeletePill,
        handleSave,
        handleSaveDraft,
        handlePublish,
        handleDelete,
        persistDraft,
        discardChanges,
    };
}
