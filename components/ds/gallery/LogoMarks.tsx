import { StyleSheet, View } from 'react-native';

import { backbar, DEFAULT_ACCENT, radius, space } from '@/constants/tokens';

import { LogoImage } from '../LogoImage';
import { Caption } from '../Text';

const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`;
const paper = backbar.light.surface;
const ink = backbar.dark.ground;

/** Made-up logos, the four kinds LogoImage meets: on white paper, on black, with a hole the paper's colour, and transparent. */
const SAMPLES = [
  { label: 'On white', uri: svg(`<rect width="64" height="64" fill="${paper}"/><circle cx="32" cy="32" r="22" fill="${ink}"/><circle cx="32" cy="32" r="9" fill="${DEFAULT_ACCENT}"/>`) },
  { label: 'On black', uri: svg(`<rect width="64" height="64" fill="${ink}"/><path d="M14 44 L32 16 L50 44 Z" fill="${DEFAULT_ACCENT}"/>`) },
  { label: 'With a hole', uri: svg(`<rect width="64" height="64" fill="${paper}"/><circle cx="32" cy="32" r="22" fill="${DEFAULT_ACCENT}"/><circle cx="32" cy="32" r="10" fill="${paper}"/>`) },
  { label: 'Transparent', uri: svg(`<rect x="14" y="14" width="36" height="36" rx="8" fill="${DEFAULT_ACCENT}"/>`) },
];

/** Logos as marks: round (BarMark, pins) and rounded square (the venue switcher), with no ring of their own background. */
export function LogoMarks() {
  return (
    <View style={styles.wrap}>
      {SAMPLES.map((s) => (
        <View key={s.label} style={styles.sample}>
          <View style={styles.marks}>
            <LogoImage uri={s.uri} size={44} radius={22} />
            <LogoImage uri={s.uri} size={32} radius={32 * 0.28} />
          </View>
          <Caption tone="muted">{s.label}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  sample: { gap: space.xs, alignItems: 'flex-start' },
  marks: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.control },
});
