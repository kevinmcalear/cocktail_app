import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { DsText } from '@/components/ds';
import { eightBall, fontFamilies } from '@/constants/tokens';
import { DIE_BOX, FACE, faceLines, neighbours, scaled, toPath } from '@/lib/eightBallFace';

const FACE_PATH = toPath(FACE);
const NEIGHBOURS = neighbours().map(toPath);
const GLOW = [toPath(scaled(FACE, 1.14)), toPath(scaled(FACE, 1.3))];

/**
 * One face of the die as the real toy shows it (lib/eightBallFace.ts): a
 * glowing blue triangle with no outline, its neighbours dim in the dark
 * around it, and the answer in small white capitals, each word's first
 * letter a little bigger. `up` turns the triangle to point up; the words stay
 * upright and centred either way. A still drawing: BallArt moves the view.
 */
export function DieFace({ text, up }: { text: string; up: boolean }) {
  const { lines, small } = faceLines(text);
  const size = small ? eightBall.type.small : eightBall.type.normal;
  return (
    <View style={styles.box}>
      <Svg width={DIE_BOX} height={DIE_BOX} style={[StyleSheet.absoluteFill, up ? styles.up : null]}>
        <Defs>
          <RadialGradient id="eightBallFace" cx="50%" cy="45%" r="50%">
            <Stop offset="0" stopColor={eightBall.faceCore} />
            <Stop offset="0.55" stopColor={eightBall.face} />
            <Stop offset="1" stopColor={eightBall.faceEdge} />
          </RadialGradient>
        </Defs>
        {NEIGHBOURS.map((d) => (
          <Path key={d} d={d} fill={eightBall.neighbour} opacity={0.3} />
        ))}
        <Path d={GLOW[1]} fill={eightBall.glow} opacity={0.05} />
        <Path d={GLOW[0]} fill={eightBall.glow} opacity={0.13} />
        <Path d={FACE_PATH} fill="url(#eightBallFace)" />
      </Svg>
      <View style={[styles.words, up ? styles.wordsUp : styles.wordsDown]}>
        {lines.map((line, i) => (
          // Decorative and sized to the face (the ball is aria-hidden; the title under it has the name), so it doesn't scale with text size.
          <DsText
            key={`${i}-${line}`}
            allowFontScaling={false}
            color={eightBall.text}
            align="center"
            style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: size.rest, lineHeight: size.lineHeight, letterSpacing: size.letterSpacing }}
          >
            {line.split(' ').map((word, w) => (
              <Text key={w}>
                {w > 0 ? ' ' : ''}
                <Text style={{ fontSize: size.lead }}>{word.charAt(0)}</Text>
                {word.slice(1)}
              </Text>
            ))}
          </DsText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: DIE_BOX, height: DIE_BOX, alignItems: 'center', justifyContent: 'center' },
  up: { transform: [{ rotate: '180deg' }] },
  // Nudged towards the face's wide edge, where there's room for the longest line.
  words: { width: 70, alignItems: 'center' },
  wordsDown: { transform: [{ translateY: -5 }] },
  wordsUp: { transform: [{ translateY: 5 }] },
});
