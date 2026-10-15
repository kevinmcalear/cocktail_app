import { useQuery } from '@tanstack/react-query';
import type { StyleSpecification } from 'maplibre-gl';

import { MAP_STYLE, readableLabels } from '@/lib/discoverMap';

/**
 * The native map's style: OpenFreeMap's, with readable street names
 * (readableLabels), fetched once a session. The web map patches the same
 * style as it loads instead (setStyle's transformStyle). Undefined while it
 * loads; the plain style URL if the fetch fails, so there's always a map.
 */
export function useMapStyle(scheme: keyof typeof MAP_STYLE): StyleSpecification | string | undefined {
  const { data } = useQuery({
    queryKey: ['map-style', scheme],
    queryFn: async (): Promise<StyleSpecification | string> => {
      try {
        const res = await fetch(MAP_STYLE[scheme]);
        if (!res.ok) return MAP_STYLE[scheme];
        return readableLabels((await res.json()) as StyleSpecification, scheme);
      } catch {
        return MAP_STYLE[scheme];
      }
    },
    staleTime: Infinity,
    retry: false,
  });
  return data;
}
