import { GlassButton } from '@/components/ds';

import { useCollectToggle } from './useCollectToggle';

/** The round Save on a public drink row: keeps it to make at home (signed out, asks you to sign in). */
export function SaveToMake({ itemId, name }: { itemId: string; name: string }) {
  const { saved, toggle, sheet } = useCollectToggle({ kind: 'drink', itemId }, name);
  return (
    <>
      <GlassButton accessibilityLabel={saved ? `${name} is saved to make at home. Remove it` : `Save ${name} to make at home`} icon={saved ? 'bookmark.fill' : 'bookmark'} onPress={toggle} />
      {sheet}
    </>
  );
}
