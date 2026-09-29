import { useState } from 'react';
import { View } from 'react-native';

import { useNewFromBars, barName } from '@/hooks/usePublished';
import { dayLabel } from '@/lib/collection';
import { plural } from '@/lib/menus';

import { Rail, RailCard } from './FlavorRails';

/**
 * "New from bars": live releases, then drinks bars have just published. Each
 * opens its public page, where you can collect it. Hidden until a bar
 * publishes something.
 */
export function NewFromBars() {
  const { data } = useNewFromBars();
  const [now] = useState(() => Date.now());
  if (!data || (!data.releases.length && !data.drinks.length)) return null;
  return (
    <Rail title="New from bars" note="Releases and drinks bars have just shared. Collect the ones you've had.">
      {data.releases.map((r) => (
        <View role="listitem" key={r.id}>
          <RailCard
            id={r.id}
            href={`/r/${r.id}`}
            name={r.name}
            imageUrl={r.coverUrl}
            badge={['Release', barName(data.bars, r.barId)].filter(Boolean).join(' · ')}
            reason={`${dayLabel(r.releaseDate, now)} · ${plural(r.itemIds.length, 'drink')}`}
          />
        </View>
      ))}
      {data.drinks.map((d) => (
        <View role="listitem" key={d.id}>
          <RailCard
            id={d.id}
            href={`/d/${d.id}`}
            name={d.name}
            imageUrl={d.imageUrl}
            badge={barName(data.bars, d.barId) ?? 'Shared'}
            reason={d.description ?? (d.publishMode === 'spec' ? 'With the spec' : 'On the menu')}
          />
        </View>
      ))}
    </Rail>
  );
}
