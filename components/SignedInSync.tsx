import { useDraftSync } from '@/hooks/useDraftSync';
import { useSpecBooks } from '@/hooks/useSpecBook';

/**
 * Background work for someone signed in, mounted once at the root
 * (components/nav/RootLazy.tsx): drinks half made in the wizard, kept in
 * the account (hooks/useDraftSync), and the spec book of every venue they
 * work at, on this phone (hooks/useSpecBook). Signed out, neither does
 * anything, so a public page doesn't load their code.
 */
export default function SignedInSync() {
  useDraftSync();
  useSpecBooks();
  return null;
}
