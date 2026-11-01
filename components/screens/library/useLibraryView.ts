import { useGlobalSearchParams, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useState } from 'react';

// A type, not an interface, so expo-router's params accept it.
export type LibraryView = { show?: string; menu?: string; kind?: string };

/**
 * Which view of Library is up (?show=, ?menu=, ?kind=). It lives in the URL,
 * so a link opens the same view. Beside a drink on a desktop (`beside`,
 * hooks/useDrinksSplit.ts) the URL is the drink's (/cocktail/<id>), so the
 * list holds its view itself, starting from the link it opened on, and keeps
 * /drinks in step while no drink is open.
 */
export function useLibraryView(beside: boolean): { view: LibraryView; setView: (next: LibraryView) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const url = useLocalSearchParams<LibraryView>();
  const opened = useGlobalSearchParams<LibraryView>();
  const [held, setHeld] = useState<LibraryView>(() => ({ show: opened.show, menu: opened.menu, kind: opened.kind }));
  if (!beside) return { view: url, setView: (next) => router.setParams(next) };
  return {
    view: held,
    setView: (next) => {
      setHeld((v) => ({ ...v, ...next }));
      if (pathname === '/drinks') router.setParams(next);
    },
  };
}
