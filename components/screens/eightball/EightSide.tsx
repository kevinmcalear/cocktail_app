import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { eightBall } from '@/constants/tokens';

export const EIGHT_SIDE = 136;
const C = EIGHT_SIDE / 2;

/** The ball's other side, like a pool ball's: a white circle with a black 8. A still drawing; BallArt turns it. */
export function EightSide() {
  return (
    <Svg width={EIGHT_SIDE} height={EIGHT_SIDE}>
      <Defs>
        <RadialGradient id="eightBallSide" cx="40%" cy="35%" r="65%">
          <Stop offset="0.5" stopColor={eightBall.eightFace} />
          <Stop offset="1" stopColor={eightBall.eightShade} />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={C} fill="url(#eightBallSide)" />
      <Ellipse cx={C} cy={C - 17} rx={16} ry={14} stroke={eightBall.eightInk} strokeWidth={8} fill="none" />
      <Ellipse cx={C} cy={C + 16} rx={19} ry={17} stroke={eightBall.eightInk} strokeWidth={8} fill="none" />
    </Svg>
  );
}
