// Web toasts: burnt and its Toaster load lazily (WebToaster.web.tsx), and
// sonner drops a toast no Toaster is listening for. A toast made before the
// Toaster has mounted (an unsent write's error replayed at launch) must still
// show, in order.
import { render, waitFor } from '@testing-library/react-native';

import { ListeningToaster } from './ListeningToaster.web';
import { toast } from '@/lib/systemToast.web';

// sonner, as it behaves: a toast goes to the Toasters listening now, or nowhere.
const mockShown: string[] = [];
const mockListeners = new Set<(title: string) => void>();
jest.mock('burnt', () => ({ toast: ({ title }: { title: string }) => mockListeners.forEach((l) => l(title)) }));
jest.mock('burnt/web', () => ({
  Toaster: () => {
    // sonner subscribes in an effect.
    jest.requireActual<typeof import('react')>('react').useEffect(() => {
      const l = (title: string) => mockShown.push(title);
      mockListeners.add(l);
      return () => void mockListeners.delete(l);
    }, []);
    return null;
  },
}));

test('a toast made before the Toaster mounts still shows, in order', async () => {
  toast({ title: 'First' });
  toast({ title: 'Second', preset: 'done' });
  render(<ListeningToaster />);
  await waitFor(() => expect(mockShown).toEqual(['First', 'Second']));
  toast({ title: 'Third' });
  await waitFor(() => expect(mockShown).toEqual(['First', 'Second', 'Third']));
});
