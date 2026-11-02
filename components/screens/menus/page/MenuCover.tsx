import { View } from 'react-native';

import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { PhotoMirror } from '@/components/screens/drink/PhotoMirror';
import { space } from '@/constants/tokens';

/** A menu's cover photo at the top of its page, flipped and blurred on down under the list, as on a drink's photo page. */
export default function MenuCover({ url, name, height, bleed }: { url: string; name: string; height: number; bleed: number }) {
  return (
    <View style={{ marginHorizontal: -bleed }}>
      <PhotoMirror url={url} top={height - space.xxxl} />
      <DrinkHero name={name} pictures={[{ url, isSketch: false, isOutdated: false }]} glass={null} height={height} fade />
    </View>
  );
}
