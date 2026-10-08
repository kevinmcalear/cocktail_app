import { useMutation } from '@tanstack/react-query';

import { readBottlePhoto } from '@/lib/readBottle';

/** Reads a label photo (read-bottle, one AI unit): its name, maker, kind and strength. */
export const useReadLabel = () => useMutation({ mutationFn: readBottlePhoto });
