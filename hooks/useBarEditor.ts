import { useBarDetail } from '@/hooks/useBarDetail';
import { useBars } from '@/hooks/useBars';
import { extractBrandColorsFromUri } from '@/lib/extractBrandColors';
import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

const ROLE_OPTIONS = [
    { name: 'Guest (10)', value: '10' },
    { name: 'Employee (20)', value: '20' },
    { name: 'Bartender (30)', value: '30' },
    { name: 'Drink Creator (35)', value: '35' },
    { name: 'Admin (40)', value: '40' },
];

function normalizeHex(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function isValidHex(value: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
        window.alert(message);
        return;
    }
    Alert.alert(title, message);
}

type BarLogoResponse = {
    imageUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
};

async function extractColors(barId: string, uri: string, base64: string) {
    const local = await extractBrandColorsFromUri(uri);
    if (local) return local;

    return invokeFunction<BarLogoResponse>('upload-bar-logo', {
        bar_id: barId,
        image_base64: base64,
        extract_only: true,
    });
}

async function uploadLogo(barId: string, base64: string) {
    return invokeFunction<BarLogoResponse>('upload-bar-logo', {
        bar_id: barId,
        image_base64: base64,
        extract_only: false,
    });
}

function hydrateFormFromBar(
    bar: {
        name: string;
        default_visibility_level: number;
        default_generic_ingredient_level: number;
        default_specific_brand_level: number;
        default_measurement_level: number;
        default_prep_level: number;
        logo_url?: string | null;
        primary_color?: string | null;
        secondary_color?: string | null;
    },
    setters: {
        setName: (value: string) => void;
        setVisibilityLevel: (value: string) => void;
        setGenericLevel: (value: string) => void;
        setSpecificLevel: (value: string) => void;
        setMeasurementLevel: (value: string) => void;
        setPrepLevel: (value: string) => void;
        setLogoUrl: (value: string | null) => void;
        setPrimaryColor: (value: string) => void;
        setSecondaryColor: (value: string) => void;
    },
) {
    setters.setName(bar.name);
    setters.setVisibilityLevel(bar.default_visibility_level.toString());
    setters.setGenericLevel(bar.default_generic_ingredient_level.toString());
    setters.setSpecificLevel(bar.default_specific_brand_level.toString());
    setters.setMeasurementLevel(bar.default_measurement_level.toString());
    setters.setPrepLevel(bar.default_prep_level.toString());
    setters.setLogoUrl(bar.logo_url ?? null);
    setters.setPrimaryColor(bar.primary_color ?? '');
    setters.setSecondaryColor(bar.secondary_color ?? '');
}

function patchBarCaches(
    queryClient: ReturnType<typeof useQueryClient>,
    barId: string,
    patch: {
        name: string;
        logo_url: string | null;
        primary_color: string | null;
        secondary_color: string | null;
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
            const branding = {
                name: patch.name,
                logo_url: patch.logo_url,
                primary_color: patch.primary_color,
                secondary_color: patch.secondary_color,
            };
            if (Array.isArray(bars)) {
                return { ...row, bars: [{ ...bars[0], ...branding }] };
            }
            return { ...row, bars: { ...bars, ...branding } };
        });
    });
}

export function useBarEditor(barId: string) {
    const queryClient = useQueryClient();
    const { data: detailData, isLoading } = useBarDetail(barId);
    const { data: userBars } = useBars();

    const roleLevel = userBars?.find((b) => b.bar_id === barId)?.role_level ?? 10;
    const canEdit = roleLevel >= 35;

    const [name, setName] = useState('');
    const [visibilityLevel, setVisibilityLevel] = useState('10');
    const [genericLevel, setGenericLevel] = useState('20');
    const [specificLevel, setSpecificLevel] = useState('30');
    const [measurementLevel, setMeasurementLevel] = useState('30');
    const [prepLevel, setPrepLevel] = useState('40');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState('');
    const [secondaryColor, setSecondaryColor] = useState('');
    const [localLogoUri, setLocalLogoUri] = useState<string | null>(null);
    const [pendingLogoBase64, setPendingLogoBase64] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [saving, setSaving] = useState(false);
    const [extractingColors, setExtractingColors] = useState(false);

    useEffect(() => {
        setInitialized(false);
        setLocalLogoUri(null);
        setPendingLogoBase64(null);
    }, [barId]);

    useEffect(() => {
        if (!detailData?.bar || initialized) return;
        hydrateFormFromBar(detailData.bar, {
            setName,
            setVisibilityLevel,
            setGenericLevel,
            setSpecificLevel,
            setMeasurementLevel,
            setPrepLevel,
            setLogoUrl,
            setPrimaryColor,
            setSecondaryColor,
        });
        setInitialized(true);
    }, [detailData?.bar, initialized]);

    const initialSnapshot = useMemo(() => {
        if (!detailData?.bar) return null;
        const bar = detailData.bar;
        return {
            name: bar.name,
            visibilityLevel: bar.default_visibility_level.toString(),
            genericLevel: bar.default_generic_ingredient_level.toString(),
            specificLevel: bar.default_specific_brand_level.toString(),
            measurementLevel: bar.default_measurement_level.toString(),
            prepLevel: bar.default_prep_level.toString(),
            logoUrl: bar.logo_url ?? null,
            primaryColor: bar.primary_color ?? '',
            secondaryColor: bar.secondary_color ?? '',
        };
    }, [detailData?.bar]);

    const isDirty = useMemo(() => {
        if (!initialSnapshot) return false;
        return (
            name !== initialSnapshot.name ||
            visibilityLevel !== initialSnapshot.visibilityLevel ||
            genericLevel !== initialSnapshot.genericLevel ||
            specificLevel !== initialSnapshot.specificLevel ||
            measurementLevel !== initialSnapshot.measurementLevel ||
            prepLevel !== initialSnapshot.prepLevel ||
            primaryColor !== initialSnapshot.primaryColor ||
            secondaryColor !== initialSnapshot.secondaryColor ||
            logoUrl !== initialSnapshot.logoUrl ||
            !!localLogoUri
        );
    }, [
        initialSnapshot,
        name,
        visibilityLevel,
        genericLevel,
        specificLevel,
        measurementLevel,
        prepLevel,
        primaryColor,
        secondaryColor,
        logoUrl,
        localLogoUri,
    ]);

    useEffect(() => {
        if (!detailData?.bar || isDirty || localLogoUri) return;
        hydrateFormFromBar(detailData.bar, {
            setName,
            setVisibilityLevel,
            setGenericLevel,
            setSpecificLevel,
            setMeasurementLevel,
            setPrepLevel,
            setLogoUrl,
            setPrimaryColor,
            setSecondaryColor,
        });
    }, [detailData?.bar, isDirty, localLogoUri]);

    const pickLogo = useCallback(async () => {
        if (!canEdit) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;

        const uri = result.assets[0].uri;
        setLocalLogoUri(uri);
        setExtractingColors(true);

        try {
            const base64 = await uriToBase64(uri);
            setPendingLogoBase64(base64);

            const colors = await extractColors(barId, uri, base64);
            if (colors.primaryColor) setPrimaryColor(colors.primaryColor);
            if (colors.secondaryColor) setSecondaryColor(colors.secondaryColor);
        } catch (err: any) {
            showAlert('Logo preview', err.message || 'Could not analyze logo colors.');
        } finally {
            setExtractingColors(false);
        }
    }, [barId, canEdit]);

    const discardChanges = useCallback(() => {
        if (!initialSnapshot) return;
        setName(initialSnapshot.name);
        setVisibilityLevel(initialSnapshot.visibilityLevel);
        setGenericLevel(initialSnapshot.genericLevel);
        setSpecificLevel(initialSnapshot.specificLevel);
        setMeasurementLevel(initialSnapshot.measurementLevel);
        setPrepLevel(initialSnapshot.prepLevel);
        setLogoUrl(initialSnapshot.logoUrl);
        setPrimaryColor(initialSnapshot.primaryColor);
        setSecondaryColor(initialSnapshot.secondaryColor);
        setLocalLogoUri(null);
        setPendingLogoBase64(null);
    }, [initialSnapshot]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!canEdit) {
            showAlert('Cannot save', 'You need Drink Creator access or higher to edit this venue.');
            return false;
        }
        if (!name.trim()) {
            showAlert('Cannot save', 'Venue name is required.');
            return false;
        }

        let normalizedPrimary = normalizeHex(primaryColor);
        let normalizedSecondary = normalizeHex(secondaryColor);
        if (normalizedPrimary && !isValidHex(normalizedPrimary)) {
            showAlert('Invalid color', 'Primary color must be a hex value like #AABBCC.');
            return false;
        }
        if (normalizedSecondary && !isValidHex(normalizedSecondary)) {
            showAlert('Invalid color', 'Secondary color must be a hex value like #AABBCC.');
            return false;
        }

        setSaving(true);
        try {
            let nextLogoUrl = logoUrl;

            if (localLogoUri) {
                const base64 = pendingLogoBase64 ?? await uriToBase64(localLogoUri);
                const uploaded = await uploadLogo(barId, base64);
                if (!uploaded.imageUrl) throw new Error('Logo upload did not return a URL.');
                nextLogoUrl = uploaded.imageUrl;
                if (uploaded.primaryColor) normalizedPrimary = uploaded.primaryColor;
                if (uploaded.secondaryColor) normalizedSecondary = uploaded.secondaryColor;
            }

            const { error } = await supabase.rpc('update_bar_settings', {
                p_bar_id: barId,
                p_name: name.trim(),
                p_visibility: parseInt(visibilityLevel, 10),
                p_generic: parseInt(genericLevel, 10),
                p_specific: parseInt(specificLevel, 10),
                p_measurement: parseInt(measurementLevel, 10),
                p_prep: parseInt(prepLevel, 10),
                p_logo_url: nextLogoUrl,
                p_primary_color: normalizedPrimary || null,
                p_secondary_color: normalizedSecondary || null,
            });
            if (error) throw error;

            const savedPatch = {
                name: name.trim(),
                logo_url: nextLogoUrl,
                primary_color: normalizedPrimary || null,
                secondary_color: normalizedSecondary || null,
                default_visibility_level: parseInt(visibilityLevel, 10),
                default_generic_ingredient_level: parseInt(genericLevel, 10),
                default_specific_brand_level: parseInt(specificLevel, 10),
                default_measurement_level: parseInt(measurementLevel, 10),
                default_prep_level: parseInt(prepLevel, 10),
            };

            patchBarCaches(queryClient, barId, savedPatch);
            setLogoUrl(nextLogoUrl);
            setPrimaryColor(normalizedPrimary);
            setSecondaryColor(normalizedSecondary);
            setLocalLogoUri(null);
            setPendingLogoBase64(null);
            return true;
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to save venue.');
            return false;
        } finally {
            setSaving(false);
        }
    }, [
        barId,
        canEdit,
        genericLevel,
        localLogoUri,
        logoUrl,
        measurementLevel,
        name,
        pendingLogoBase64,
        prepLevel,
        primaryColor,
        queryClient,
        secondaryColor,
        specificLevel,
        visibilityLevel,
    ]);

    return {
        loading: isLoading || !initialized,
        saving,
        extractingColors,
        canEdit,
        roleLevel,
        roleOptions: ROLE_OPTIONS,
        members: detailData?.members ?? [],
        items: detailData?.items ?? [],
        name,
        setName,
        visibilityLevel,
        setVisibilityLevel,
        genericLevel,
        setGenericLevel,
        specificLevel,
        setSpecificLevel,
        measurementLevel,
        setMeasurementLevel,
        prepLevel,
        setPrepLevel,
        logoUrl,
        localLogoUri,
        primaryColor,
        setPrimaryColor,
        secondaryColor,
        setSecondaryColor,
        pickLogo,
        isDirty,
        handleSave,
        discardChanges,
    };
}
