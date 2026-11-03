import { useGlobalSearchParams, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useState } from 'react';

// A type, not an interface, so expo-router's params accept it.
export type DrinksView = { show?: string; menu?: string; kind?: string };

/**
 * Which view of the Drinks tab is up (?show=, ?menu=, ?kind=). It lives in the URL,
 * so a link opens the same view. Beside a drink on a desktop (`beside`,
 * hooks/useDrinksSplit.ts) the URL is the drink's (/cocktail/<id>), so the
 * list holds its view itself, starting from the link it opened on, and keeps
 * /drinks in step while no drink is open.
 */
export function useDrinksView(beside: boolean): { view: DrinksView; setView: (next: DrinksView) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const url = useLocalSearchParams<DrinksView>();
  const opened = useGlobalSearchParams<DrinksView>();
  const [held, setHeld] = useState<DrinksView>(() => ({ show: opened.show, menu: opened.menu, kind: opened.kind }));
  if (!beside) return { view: url, setView: (next) => router.setParams(next) };
  return {
    view: held,
    setView: (next) => {
      setHeld((v) => ({ ...v, ...next }));
      if (pathname === '/drinks') router.setParams(next);
    },
  };
}
