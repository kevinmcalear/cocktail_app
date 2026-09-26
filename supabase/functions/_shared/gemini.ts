const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

// A 16x16 sheet of sketch paper, returned instead of calling Imagen when
// IMAGE_MODEL=mock (set for the local stack in config.toml).
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mN4//IuSYhhVMOohuGrAQB7O7UfT213LwAAAABJRU5ErkJggg==";

/** Whether image generation is mocked. Only honoured against a local stack. */
function mockImages(): boolean {
  if (Deno.env.get("IMAGE_MODEL") !== "mock") return false;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  if (!/^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)) {
    throw new Error("IMAGE_MODEL=mock is only allowed on a local stack");
  }
  return true;
}

/** Generates one square PNG with Imagen 4. */
export async function generateImagenPng(prompt: string): Promise<Uint8Array> {
  if (mockImages()) {
    console.log(`[mock imagen] ${prompt.slice(0, 160)}`);
    return decodeBase64(MOCK_PNG_BASE64);
  }

  const res = await fetch(`${API_BASE}/imagen-4.0-generate-001:predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/png" } },
    }),
  });
  if (!res.ok) throw new Error(`Imagen failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) throw new Error("Imagen returned no image");
  return decodeBase64(base64);
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
