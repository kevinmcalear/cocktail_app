import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

/**
 * Whether writes go now or wait on the phone: the same answer the query
 * client acts on (lib/react-query.ts), so "offline" on screen and a write
 * waiting agree, wifi with no internet included.
 */
export function useOnline(): boolean {
  // A page rendered ahead of time (web) starts online, as the client does before NetInfo answers.
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
