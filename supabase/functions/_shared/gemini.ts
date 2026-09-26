import { isLocalStack } from "./localStack.ts";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return key;
}

export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Google shut Imagen down in 2026; images now come from Nano Banana 2 Lite
// through the Interactions API.
const IMAGE_MODEL_ID = "gemini-3.1-flash-lite-image";

// A 16x16 sheet of sketch paper, returned instead of calling the image model
// on a local stack, so local runs and tests never spend real AI quota.
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mN4//IuSYhhVMOohuGrAQB7O7UfT213LwAAAABJRU5ErkJggg==";

/**
 * Whether image generation is mocked: always on a local stack unless
 * IMAGE_MODEL=live (in supabase/functions/.env), never in production.
 */
export function mockImages(): boolean {
  const model = Deno.env.get("IMAGE_MODEL");
  if (model === "live") return false;
  if (isLocalStack()) return true;
  if (model === "mock") throw new Error("IMAGE_MODEL=mock is only allowed on a local stack");
  return false;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  /** File extension to store it under. */
  ext: "png" | "jpg";
}

interface InteractionContent {
  type?: string;
  mime_type?: string;
  data?: string;
}

/** Generates one square image (1K) from a text prompt. */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  if (mockImages()) {
    console.log(`[mock image] ${prompt.slice(0, 160)}`);
    return { bytes: decodeBase64(MOCK_PNG_BASE64), mimeType: "image/png", ext: "png" };
  }

  const res = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify({
      model: IMAGE_MODEL_ID,
      input: [{ type: "text", text: prompt }],
      response_format: { type: "image", mime_type: "image/png", aspect_ratio: "1:1", image_size: "1K" },
      // Nothing to keep on Google's side: each drawing is one-off.
      store: false,
    }),
  });
  if (!res.ok) throw new Error(`Image model failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const contents: InteractionContent[] = (data.steps ?? []).flatMap((step: { content?: InteractionContent[] }) => step.content ?? []);
  const image = contents.find((c) => c.type === "image" && c.data) ?? (data.output_image as InteractionContent | undefined);
  if (!image?.data) throw new Error(`Image model returned no image (status ${data.status ?? "unknown"})`);

  const jpeg = image.mime_type === "image/jpeg" || image.mime_type === "image/jpg";
  return { bytes: decodeBase64(image.data), mimeType: jpeg ? "image/jpeg" : "image/png", ext: jpeg ? "jpg" : "png" };
}

/** Asks Gemini Flash about an image and returns its JSON reply as text. */
export async function describeImageAsJson(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no answer");
  return text;
}
