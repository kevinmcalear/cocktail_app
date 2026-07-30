import { useDrafts } from '@/hooks/useDrafts';
import { useDropdowns } from '@/hooks/useDropdowns';
import { resolveBeerId, resolveCocktailId, resolveWineId, updateMenuDraftsWithPublishedId } from '@/lib/drafts';
import { uriToBase64 } from '@/lib/imageBase64';
import { capitalize } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

async function uploadMenuCover(uri: string, menuId?: string | null): Promise<string> {
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = menuId
        ? `menus/${menuId}/${Date.now()}.${safeExt}`
        : `menus/drafts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const base64 = await uriToBase64(uri);
    const { error } = await supabase.storage.from('drinks').upload(path, decode(base64), {
        contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
        upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from('drinks').getPublicUrl(path).data.publicUrl;
}

function selectionIdForItem(item: { id: string; item_type?: string | null }) {
    if (item.item_type === 'beer') return `beer-${item.id}`;
    if (item.item_type === 'wine') return `wine-${item.id}`;
    return item.id;
}

function itemUuidFromSelection(drinkId: string) {
    if (drinkId.startsWith('beer-')) return drinkId.replace('beer-', '');
    if (drinkId.startsWith('wine-')) return drinkId.replace('wine-', '');
    return drinkId;
}

export function useMenuEditor(menuId: string | null, enabled: boolean) {
    const queryClient = useQueryClient();
    const { drafts, saveDraft } = useDrafts();
    const { data: dropdowns } = useDropdowns();
    const allSections = dropdowns?.templateSections || [];

    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [menuName, setMenuName] = useState('');
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [coverPosition, setCoverPosition] = useState(50);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [barId, setBarId] = useState<string | null>(null);

    const cleanRef = useRef('');
    const stateStr = JSON.stringify({
        menuName,
        coverUrl,
        coverPosition,
        selectedTemplateId,
        selections,
        barId,
    });

    useEffect(() => {
        if (!enabled || !menuId) {
            setLoaded(false);
            return;
        }
        let cancelled = false;
        setLoaded(false);
        (async () => {
            try {
                const { data: menuData, error: menuErr } = await supabase
                    .from('menus')
                    .select('*')
                    .eq('id', menuId)
                    .single();
                if (menuErr || !menuData) throw menuErr || new Error('Menu not found');

                // ponytail: prod menu_drinks is item_id only (no cocktail_id/beer_id/wine_id)
                const { data: drinksData, error: drinksErr } = await supabase
                    .from('menu_drinks')
                    .select('template_section_id, item_id, item:items!item_id ( id, item_type )')
                    .eq('menu_id', menuId);
                if (drinksErr) throw drinksErr;

                const loadedSelections: Record<string, string[]> = {};
                for (const drink of drinksData || []) {
                    const sectionId = drink.template_section_id;
                    const item = Array.isArray(drink.item) ? drink.item[0] : drink.item;
                    if (!sectionId || !item?.id) continue;
                    if (!loadedSelections[sectionId]) loadedSelections[sectionId] = [];
                    loadedSelections[sectionId].push(selectionIdForItem(item));
                }

                if (cancelled) return;
                const nextName = menuData.name || '';
                const nextTemplate = menuData.template_id || null;
                const nextBar = menuData.bar_id || null;
                const nextCover = menuData.cover_url || null;
                const nextPos =
                    typeof menuData.cover_position === 'number' ? menuData.cover_position : 50;

                setMenuName(nextName);
                setSelectedTemplateId(nextTemplate);
                setBarId(nextBar);
                setCoverUrl(nextCover);
                setCoverPosition(nextPos);
                setSelections(loadedSelections);
                cleanRef.current = JSON.stringify({
                    menuName: nextName,
                    coverUrl: nextCover,
                    coverPosition: nextPos,
                    selectedTemplateId: nextTemplate,
                    selections: loadedSelections,
                    barId: nextBar,
                });
                setLoaded(true);
            } catch (e) {
                console.error('useMenuEditor load', e);
                Alert.alert('Error', 'Failed to load menu for editing.');
                if (!cancelled) setLoaded(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled, menuId]);

    const activeSections = useMemo(
        () =>
            allSections
                .filter((s: any) => s.template_id === selectedTemplateId)
                .sort((a: any, b: any) => a.sort_order - b.sort_order),
        [allSections, selectedTemplateId]
    );

    useEffect(() => {
        if (!selectedTemplateId || !loaded) return;
        setSelections((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const sec of activeSections) {
                if (next[sec.id] === undefined) {
                    next[sec.id] = [];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [selectedTemplateId, activeSections, loaded]);

    const isDirty = loaded && stateStr !== cleanRef.current;

    const discard = useCallback(() => {
        setLoaded(false);
        setMenuName('');
        setCoverUrl(null);
        setCoverPosition(50);
        setSelectedTemplateId(null);
        setSelections({});
        setBarId(null);
    }, []);

    const pickCover = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need access to your photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [5, 2],
            quality: 0.85,
        });
        if (result.canceled || !result.assets?.length) return;
        setUploadingCover(true);
        try {
            const url = await uploadMenuCover(result.assets[0].uri, menuId);
            setCoverUrl(url);
            setCoverPosition(50);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to upload cover image.');
        } finally {
            setUploadingCover(false);
        }
    }, [menuId]);

    const save = useCallback(async () => {
        if (!menuId || !selectedTemplateId || !menuName.trim()) return false;
        setSaving(true);
        try {
            const updatePayload: any = {
                name: capitalize(menuName),
                template_id: selectedTemplateId,
                is_active: true,
                bar_id: barId || null,
                cover_url: coverUrl || null,
                cover_position: coverPosition,
            };

            let { error: updateError } = await supabase.from('menus').update(updatePayload).eq('id', menuId);
            // ponytail: optional columns may not exist until migrations land
            for (const col of ['cover_position', 'cover_url', 'bar_id'] as const) {
                if (updateError?.code === '42703' && col in updatePayload) {
                    delete updatePayload[col];
                    ({ error: updateError } = await supabase
                        .from('menus')
                        .update(updatePayload)
                        .eq('id', menuId));
                }
            }
            if (updateError) throw updateError;

            const { error: deleteDrinksError } = await supabase
                .from('menu_drinks')
                .delete()
                .eq('menu_id', menuId);
            if (deleteDrinksError) throw deleteDrinksError;

            let globalSortOrder = 0;
            const drinksToInsert = [];
            for (const sec of activeSections) {
                for (const drinkId of selections[sec.id] || []) {
                    let item_id = itemUuidFromSelection(drinkId);

                    if (drinkId.startsWith('beer-')) {
                        const part = drinkId.replace('beer-', '');
                        const isDraft = drafts.some((d) => d.id === part && d.entity_type === 'beer');
                        if (isDraft) {
                            const resolvedId = await resolveBeerId(part, drafts);
                            await updateMenuDraftsWithPublishedId(
                                'beer-' + part,
                                'beer-' + resolvedId,
                                drafts,
                                saveDraft
                            );
                            item_id = resolvedId;
                        }
                    } else if (drinkId.startsWith('wine-')) {
                        const part = drinkId.replace('wine-', '');
                        const isDraft = drafts.some((d) => d.id === part && d.entity_type === 'wine');
                        if (isDraft) {
                            const resolvedId = await resolveWineId(part, drafts);
                            await updateMenuDraftsWithPublishedId(
                                'wine-' + part,
                                'wine-' + resolvedId,
                                drafts,
                                saveDraft
                            );
                            item_id = resolvedId;
                        }
                    } else {
                        const isDraft = drafts.some((d) => d.id === drinkId && d.entity_type === 'cocktail');
                        if (isDraft) {
                            const resolvedId = await resolveCocktailId(drinkId, drafts);
                            await updateMenuDraftsWithPublishedId(drinkId, resolvedId, drafts, saveDraft);
                            item_id = resolvedId;
                        }
                    }

                    drinksToInsert.push({
                        menu_id: menuId,
                        item_id,
                        template_section_id: sec.id,
                        sort_order: globalSortOrder++,
                    });
                }
            }
            if (drinksToInsert.length > 0) {
                const { error } = await supabase.from('menu_drinks').insert(drinksToInsert);
                if (error) throw error;
            }

            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v4'] });
            await queryClient.invalidateQueries({ queryKey: ['menu', menuId] });
            cleanRef.current = stateStr;
            return true;
        } catch (e) {
            console.error('useMenuEditor save', e);
            Alert.alert('Error', 'Failed to save menu.');
            return false;
        } finally {
            setSaving(false);
        }
    }, [
        menuId,
        selectedTemplateId,
        menuName,
        barId,
        coverUrl,
        coverPosition,
        activeSections,
        selections,
        drafts,
        saveDraft,
        queryClient,
        stateStr,
    ]);

    return {
        loaded,
        saving,
        uploadingCover,
        isDirty,
        menuName,
        setMenuName,
        coverUrl,
        setCoverUrl,
        coverPosition,
        setCoverPosition,
        selectedTemplateId,
        setSelectedTemplateId,
        selections,
        setSelections,
        barId,
        activeSections,
        pickCover,
        save,
        discard,
    };
}
