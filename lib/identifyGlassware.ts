import * as ImagePicker from "expo-image-picker";

import type { GlassModel } from "@/hooks/useGlassModels";
import { ensureAiConsent } from "@/lib/aiConsent";
import { uriToBase64 } from "@/lib/imageBase64";
import { invokeFunction } from "@/lib/invokeFunction";
import { canUseCamera } from "@/lib/photoAccess";
import { AI_DECLINED } from "@/lib/readMenu";
import type { SketchGlass } from "@/lib/sketch/types";

export interface GlasswareIdentifyResult {
    suggestedName: string;
    matchedIcon: string | null;
    iconUrl: string | null;
    confidence?: number;
    reason?: string | null;
}

export async function identifyGlasswareFromPhoto(
    imageBase64: string,
    mimeType: string
): Promise<GlasswareIdentifyResult> {
    const data = await invokeFunction<GlasswareIdentifyResult>("identify-glassware", {
        image_base64: imageBase64,
        mime_type: mimeType,
    });

    if (!data?.suggestedName?.trim()) {
        throw new Error("Could not identify this glass. Try a clearer photo.");
    }

    return data;
}

/** What "Snap the glass" read from a photo, and the real glasses closest to it (identify-glassware, suggest_models). */
export interface GlassSuggestions {
    glass: SketchGlass | null;
    makerMark: string | null;
    capacityMl: number | null;
    confidence: number;
    /** Three at most, closest in size first. */
    models: GlassModel[];
}

/** A photo of the glass from the camera (a file on the web). Null when cancelled. */
export async function takeGlassPhoto(): Promise<{ uri: string; mimeType: string } | null> {
    if (!(await canUseCamera())) return null;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
    return result.canceled || !result.assets[0] ? null : { uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? "image/jpeg" };
}

/** Reads the glass in the photo (one AI unit) and finds the makers' glasses it could be. */
export async function suggestGlassModels(photo: { uri: string; mimeType: string }): Promise<GlassSuggestions> {
    if (!(await ensureAiConsent())) throw new Error(AI_DECLINED);
    const base64 = await uriToBase64(photo.uri);
    return invokeFunction<GlassSuggestions>("identify-glassware", { image_base64: base64, mime_type: photo.mimeType, suggest_models: true });
}
