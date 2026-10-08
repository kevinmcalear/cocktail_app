import { useBarDetail } from '@/hooks/useBarDetail';
import { useBars } from '@/hooks/useBars';
import { extractBrandColorsFromUri } from '@/lib/extractBrandColors';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

// Alert.alert shows the in-app dialog on web (lib/dialogs installWebAlert).
function showAlert(title: string, message: string) {
    Alert.alert(title, message);
}

type BarLogoResponse = {
    imageUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
};

export async function extractColors(barId: string, uri: string, base64: string) {
    const local = await extractBrandColorsFromUri(uri);
    if (local) return local;

    return invokeFunction<BarLogoResponse>('upload-bar-logo', {
        bar_id: barId,
        image_base64: base64,
        extract_only: true,
    });
}

export async function uploadLogo(barId: string, base64: string) {
    return invokeFunction<BarLogoResponse>('upload-bar-logo', {
        bar_id: barId,
        image_base64: base64,
        extract_only: false,
    });
}

type Form = Record<'name' | 'visibilityLevel' | 'genericLevel' | 'specificLevel' | 'measurementLevel' | 'prepLevel', string>;

function formFromBar(bar: {
    name: string;
    default_visibility_level: number;
    default_generic_ingredient_level: number;
    default_specific_brand_level: number;
    default_measurement_level: number;
    default_prep_level: number;
}): Form {
    return {
        name: bar.name,
        visibilityLevel: String(bar.default_visibility_level),
        genericLevel: String(bar.default_generic_ingredient_level),
        specificLevel: String(bar.default_specific_brand_level),
        measurementLevel: String(bar.default_measurement_level),
        prepLevel: String(bar.default_prep_level),
    };
}

function patchBarCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    barId: string,
    patch: {
        name: string;
        default_visibility_level: number;
        default_generic_ingredient_level: number;
        default_specific_brand_level: number;
        default_measurement_level: number;
        default_prep_level: number;
    },
) {
    queryClient.setQueryData(['bar', barId], (current: any) => {
        if (!current?.bar) return current;
        return { ...current, bar: { ...current.bar, ...patch } };
    });

    queryClient.setQueriesData({ queryKey: ['bars'] }, (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((row: any) => {
            if (row.bar_id !== barId) return row;
            const bars = row.bars;
            if (Array.isArray(bars)) return { ...row, bars: [{ ...bars[0], name: patch.name }] };
            return { ...row, bars: { ...bars, name: patch.name } };
        });
    });
}

/**
 * A venue's name and who-sees-what defaults, for its settings page. Changes
 * stay a draft until handleSave. The logo and colours belong to the Brand
 * screen, so a save here sends back whatever the venue has now.
 */
export function useBarEditor(barId: string) {
    const queryClient = useQueryClient();
    const { data: detailData, isLoading } = useBarDetail(barId);
    const { data: userBars } = useBars();

    const roleLevel = userBars?.find((b) => b.bar_id === barId)?.role_level ?? 10;
    const canEdit = roleLevel >= 40;
    const bar = detailData?.bar ?? null;
    // Only what's been changed; everything else follows the saved venue.
    const [draft, setDraft] = useState<Partial<Form>>({});
    const [saving, setSaving] = useState(false);

    const saved = bar ? formFromBar(bar) : null;
    const form: Form | null = saved ? { ...saved, ...draft } : null;
    const isDirty = !!saved && (Object.keys(draft) as (keyof Form)[]).some((k) => draft[k] !== saved[k]);
    const setter = (key: keyof Form) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

    const discardChanges = useCallback(() => setDraft({}), []);

    const handleSave = async (): Promise<boolean> => {
        if (!bar || !form) return false;
        if (!canEdit) {
            showAlert('Cannot save', "Only the venue's Admins can edit its settings.");
            return false;
        }
        if (!form.name.trim()) {
            showAlert('Cannot save', 'Venue name is required.');
            return false;
        }
        const levels = {
            default_visibility_level: parseInt(form.visibilityLevel, 10),
            default_generic_ingredient_level: parseInt(form.genericLevel, 10),
            default_specific_brand_level: parseInt(form.specificLevel, 10),
            default_measurement_level: parseInt(form.measurementLevel, 10),
            default_prep_level: parseInt(form.prepLevel, 10),
        };
        setSaving(true);
        try {
            const { error } = await supabase.rpc('update_bar_settings', {
                p_bar_id: barId,
                p_name: form.name.trim(),
                p_visibility: levels.default_visibility_level,
                p_generic: levels.default_generic_ingredient_level,
                p_specific: levels.default_specific_brand_level,
                p_measurement: levels.default_measurement_level,
                p_prep: levels.default_prep_level,
                p_logo_url: bar.logo_url ?? null,
                p_primary_color: bar.primary_color ?? null,
                p_secondary_color: bar.secondary_color ?? null,
            });
            if (error) throw error;
            patchBarCaches(queryClient, barId, { name: form.name.trim(), ...levels });
            setDraft({});
            return true;
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to save venue.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        loading: isLoading || !form,
        saving,
        canEdit,
        roleLevel,
        slug: bar?.slug ?? null,
        logoUrl: bar?.logo_url ?? null,
        name: form?.name ?? '',
        setName: setter('name'),
        visibilityLevel: form?.visibilityLevel ?? '10',
        setVisibilityLevel: setter('visibilityLevel'),
        genericLevel: form?.genericLevel ?? '20',
        setGenericLevel: setter('genericLevel'),
        specificLevel: form?.specificLevel ?? '30',
        setSpecificLevel: setter('specificLevel'),
        measurementLevel: form?.measurementLevel ?? '30',
        setMeasurementLevel: setter('measurementLevel'),
        prepLevel: form?.prepLevel ?? '40',
        setPrepLevel: setter('prepLevel'),
        isDirty,
        handleSave,
        discardChanges,
    };
}
