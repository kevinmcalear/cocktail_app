import { requireOptionalNativeModule } from 'expo';

/**
 * A package whose native module only builds from this release on. Older
 * builds get this JS by update, where requiring the package throws at load
 * (its modules call requireNativeModule), so this asks whether the native
 * module exists first, the way lib/shake.ts does. Null there.
 * ponytail: import the package normally once no supported build predates it.
 */
export function optionalNative<T>(nativeName: string, load: () => T): T | null {
  if (!requireOptionalNativeModule(nativeName)) return null;
  try {
    return load();
  } catch {
    return null;
  }
}
