import { invokeFunction } from "@/lib/invokeFunction";

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
