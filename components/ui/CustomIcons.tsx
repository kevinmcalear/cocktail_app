import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

interface CustomIconProps {
  name: string;
  size?: number;
  color?: string;
}

// A helper dictionary that maps our names to functions returning SVG content
const ICON_MAP: Record<string, (color: string) => React.ReactNode> = {
  // --- GLASSWARE ---
  Coupette: (c) => (
    <Path
      d="M6 4 L18 4 M6 4 C 8 13, 16 13, 18 4 M12 11 L12 21 M8 21 L16 21"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  Coupe: (c) => ( // Keeping original just in case
    <Path
      d="M3 6 Q12 18 21 6 M12 14 L12 21 M8 21 L16 21"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  Martini: (c) => (
    <Path
      d="M2 5 L12 15 L22 5 Z M12 15 L12 22 M8 22 L16 22 M16 7 L12 12" // with a little olive pick
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  Rocks: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 L5 19 Q5 20 6 20 L18 20 Q19 20 19 19 L20 6 Z" />
      <Path d="M7 16 L17 16" />
      <Rect x="10" y="10" width="4" height="4" />
    </G>
  ),
  Highball: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 4 L6 21 C6 21.5 6.5 22 7 22 L17 22 C17.5 22 18 21.5 18 21 L19 4 Z" />
      <Path d="M7 10 L17 10 M7 15 L17 15" />
    </G>
  ),
  Fizz: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 6 L6 21 C6 21.5 6.5 22 7 22 L17 22 C17.5 22 18 21.5 18 21 L18 6 Z" />
      <Path d="M8 12 L16 12" />
    </G>
  ),
  Ceramic: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 C4 20 20 20 20 6 L4 6 Z" />
      <Path d="M20 9 C22 9 23 11 23 13 C23 15 22 17 20 17" />
    </G>
  ),
  "Tall Spirit Mixer": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 2 L6 22 L18 22 L18 2 Z" />
      <Path d="M6 10 L18 10 M6 16 L18 16" />
    </G>
  ),
  Spritz: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 C4 16 12 20 12 20 C12 20 20 16 20 6 L4 6 Z" />
      <Path d="M12 20 L12 22 M8 22 L16 22" />
      <Circle cx="10" cy="9" r="1" />
      <Circle cx="14" cy="13" r="1" />
    </G>
  ),
  Custom: (c) => (
    <Path
      d="M12 2 Q16 6 18 12 Q20 18 12 22 Q4 18 6 12 Q8 6 12 2 Z"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  Flute: (c) => (
    <Path
      d="M8 4 L9 13 Q12 17 15 13 L16 4 M12 15 L12 21 M9 21 L15 21"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  "Nick & Nora": (c) => (
    <Path
      d="M4 6 C4 18 20 18 20 6 M12 14 L12 21 M8 21 L16 21"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  "Small Rocks": (c) => (
     <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 8 L6 19 C6 19.5 6.5 20 7 20 L17 20 C17.5 20 18 19.5 18 19 L19 8 Z" />
      <Path d="M8 15 L16 15" />
    </G>
  ),
  "Rocks & Crushed ice": (c) => (
     <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 L5 19 C5 19.5 5.5 20 6 20 L18 20 C18.5 20 19 19.5 19 19 L20 6 Z" />
      <Path d="M6 6 Q12 1 18 6" strokeDasharray="2 3" />
      <Circle cx="12" cy="12" r="2" />
      <Circle cx="8" cy="15" r="1.5" />
      <Circle cx="16" cy="14" r="2" />
    </G>
  ),
  Mug: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 5 L5 19 C5 20.6 6.3 22 8 22 L16 22 C17.7 22 19 20.6 19 19 L19 5 Z" />
      <Path d="M19 8 C21 8 22 10 22 12 C22 14 21 16 19 16" />
    </G>
  ),
  Snifter: (c) => (
    <Path
      d="M7 6 C3 12 5 20 12 20 C19 20 21 12 17 6 Z M12 20 L12 22 M9 22 L15 22"
      stroke={c}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  Tiki: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 4 L5 20 L19 20 L19 4 Z" />
      <Path d="M9 10 L11 10 M15 10 L13 10 M9 15 Q12 17 15 15" />
    </G>
  ),

  // --- METHODS ---
  Shaken: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(45 12 12)">
        <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
        <Path d="M7 8 L9 2 L15 2 L17 8" />
    </G>
  ),
  Stirred: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d="M6 6 L7 20 C7 21 8 22 9 22 L15 22 C16 22 17 21 17 20 L18 6 Z" />
        <Path d="M14 2 L12 20" />
        <Circle cx="12" cy="12" r="2" />
    </G>
  ),
  Built: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 10 L6 20 C6 21 7 22 8 22 L16 22 C17 22 18 21 18 20 L19 10 Z" />
      <Path d="M12 2 L12 8 M9 5 L15 5" />
      <Path d="M8 14 L16 14 M9 18 L15 18" />
    </G>
  ),
  Build: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 10 L6 20 C6 21 7 22 8 22 L16 22 C17 22 18 21 18 20 L19 10 Z" />
      <Path d="M12 2 L12 8 M9 5 L15 5" /> 
      <Path d="M8 14 L16 14 M9 18 L15 18" /> 
    </G>
  ),
  "muddle and shake": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
       <Path d="M6 2 L6 16 M4 16 L8 16 L8 18 L4 18 Z" />
       <G transform="translate(6, 2) rotate(45 12 12) scale(0.65)">
           <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
           <Path d="M7 8 L9 2 L15 2 L17 8" />
       </G>
    </G>
  ),
  Shake: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(45 12 12)">
        <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
        <Path d="M7 8 L9 2 L15 2 L17 8" />
    </G>
  ),
  "shake and top": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <G transform="translate(-3, 0) rotate(45 12 12) scale(0.8)">
            <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
            <Path d="M7 8 L9 2 L15 2 L17 8" />
        </G>
        <Path d="M19 4 L19 12 M16 7 L22 7" />
    </G>
  ),
  Stir: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d="M6 6 L7 20 C7 21 8 22 9 22 L15 22 C16 22 17 21 17 20 L18 6 Z" />
        <Path d="M14 2 L12 20" />
        <Circle cx="12" cy="12" r="2" />
    </G>
  ),
  "dry shake and shake": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <G transform="translate(-4, 2) rotate(45 12 12) scale(0.7)">
            <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
            <Path d="M7 8 L9 2 L15 2 L17 8" />
        </G>
        <G transform="translate(6, -2) rotate(45 12 12) scale(0.7)">
            <Path d="M8 22 L16 22 L18 8 L6 8 Z" />
        </G>
    </G>
  ),
  Blitz: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M12 4 L12 20 M8 8 L16 16 M8 16 L16 8" />
      <Circle cx="12" cy="12" r="3" />
    </G>
  ),
  Thrown: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
       <Path d="M4 14 L6 22 L12 22 L14 14 Z" />
       <Path d="M10 2 L12 10 L18 10 L20 2 Z" />
       <Path d="M14 10 C14 12 12 12 10 14" strokeWidth={1} strokeDasharray="2 2" />
    </G>
  ),
  Blended: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d="M7 4 L6 16 C6 17 7 18 8 18 L16 18 C17 18 18 17 18 16 L17 4 Z" />
        <Path d="M8 18 L6 22 L18 22 L16 18" />
        <Path d="M8 4 L8 2 L16 2 L16 4" />
        <Path d="M12 13 L10 16 M12 13 L14 16" />
    </G>
  ),
  Swizzled: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 6 L6 20 C6 21 7 22 8 22 L16 22 C17 22 18 21 18 20 L19 6 Z" />
      <Path d="M12 2 L12 20" />
      <Path d="M10 18 L14 18 M11 16 L13 16 M9 20 L15 20" />
    </G>
  ),

  // --- ICE ---
  Cube: (c) => (
    <Rect x="6" y="6" width="12" height="12" rx="2" stroke={c} strokeWidth={1.5} fill="none" />
  ),
  Cubes: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Rect x="4" y="10" width="8" height="8" rx="1" />
      <Rect x="12" y="6" width="8" height="8" rx="1" />
    </G>
  ),
  "Large Cube": (c) => (
    <Rect x="4" y="4" width="16" height="16" rx="3" stroke={c} strokeWidth={1.5} fill="none" />
  ),
  Spear: (c) => (
    <Rect x="8" y="2" width="8" height="20" rx="1" stroke={c} strokeWidth={1.5} fill="none" />
  ),
  Block: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M5 8 L12 4 L19 8 L19 16 L12 20 L5 16 Z" />
      <Path d="M5 8 L12 12 L19 8 M12 12 L12 20" />
    </G>
  ),
  Crushed: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx="8" cy="8" r="2" />
      <Circle cx="16" cy="10" r="2.5" />
      <Circle cx="11" cy="15" r="3" />
      <Circle cx="6" cy="16" r="1.5" />
      <Circle cx="18" cy="17" r="2" />
      <Circle cx="12" cy="7" r="1.5" />
    </G>
  ),
  Pebble: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 10 C6 8 10 8 10 10 C10 12 6 12 6 10 Z" />
      <Path d="M14 8 C12 8 12 12 15 12 C17 12 17 8 14 8 Z" />
      <Path d="M7 16 C5 15 7 13 9 14 C11 15 9 17 7 16 Z" />
      <Path d="M15 17 C13 18 12 15 14 14 C16 13 17 16 15 17 Z" />
      <Path d="M11 12 C10 11 12 9 13 10 C14 11 12 13 11 12 Z" />
    </G>
  ),
  None: (c) => (
    <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
  ),

  // --- FAMILIES (CATEGORIES) ---
  Sour: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 12 C4 18 10 22 16 22 L20 18 C14 18 8 12 8 6 Z" />
      <Path d="M6 14 A 8 8 0 0 0 14 20" />
    </G>
  ),
  Sipper: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 L20 6 L16 22 L8 22 Z" />
      <Path d="M14 6 L12 2" />
      <Path d="M6 14 L18 14" />
    </G>
  ),
  Daiquiri: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M3 6 Q12 18 21 6 M12 14 L12 21 M8 21 L16 21" />
      <Path d="M12 14 Q16 10 18 6" />
    </G>
  ),
  "Low ABV": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
      <Path d="M8 12 L16 12" />
    </G>
  ),
  Aromatic: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
       <Path d="M10 6 L10 12 L14 16 C 14 18 12 18 10 18" />
       <Path d="M7 16 C 5 16 5 18 7 18" strokeDasharray="1 2" />
    </G>
  ),
  Aperitif: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M8 2 L16 2 L14 10 L10 10 Z" />
      <Path d="M12 10 L12 20 M8 20 L16 20" />
      <Circle cx="12" cy="6" r="1.5" />
    </G>
  ),
  "Spirit-Forward": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3 L12 7 M12 17 L12 21 M3 12 L7 12 M17 12 L21 12" />
    </G>
  ),
  Highball_Fam: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M8 2 L8 22 M16 2 L16 22" />
      <Path d="M8 8 L16 5 M8 16 L16 13" />
      <Circle cx="10" cy="11" r="1" />
      <Circle cx="14" cy="18" r="1" />
    </G>
  ),
  Tropical: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
       <Path d="M12 22 L12 14" />
       <Path d="M12 14 Q8 10 4 12 M12 14 Q16 10 20 12" />
       <Path d="M12 14 Q6 6 8 2 M12 14 Q18 6 16 2" />
       <Path d="M12 14 Q10 4 12 2 M12 14 Q14 4 12 2" />
    </G>
  ),
  Punch: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M2 10 Q12 22 22 10 Z" />
      <Path d="M2 10 Q12 14 22 10 M12 14 L12 6" />
    </G>
  ),
  "Dessert/Cream": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 14 Q12 22 18 14 Z" />
      <Path d="M4 14 C4 8 10 8 12 4 C14 8 20 8 20 14" />
    </G>
  ),
  Manhatten: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M3 6 Q12 18 21 6 M12 14 L12 21 M8 21 L16 21" />
      <Circle cx="12" cy="10" r="2" />
    </G>
  ),
  Negroni: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M4 6 L5 19 Q5 20 6 20 L18 20 Q19 20 19 19 L20 6 Z" />
      <Path d="M4.5 10 L19.5 10" />
      <Path d="M14 6 C14 10 10 10 8 10" />
    </G>
  ),
  Champagne: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M8 2 L9 13 Q12 17 15 13 L16 2 M12 15 L12 21 M9 21 L15 21" />
      <Circle cx="12" cy="6" r="0.5" />
      <Circle cx="11" cy="9" r="0.5" />
      <Circle cx="13" cy="11" r="0.5" />
    </G>
  ),

  // --- ORIGINS (HISTORY) ---
  "Modern Classic": (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M12 2 L12 22" strokeDasharray="2 3" />
      <Path d="M5 4 L12 4 M5 4 L5 6 L7 6 L7 8 L12 8" /> 
      <Path d="M7 8 L7 16" /> 
      <Path d="M9.5 8 L9.5 16" /> 
      <Path d="M7 16 L6 16 L6 18 L4 18 L4 20 L12 20" />
      <Path d="M12 4 L20 4 L20 20 L12 20" />
    </G>
  ),
  Classic: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 4 h12 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 v-12 a2 2 0 0 1 2 -2 z" />
      <Path d="M6 8 h12" />
    </G>
  ),
  Original: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
    </G>
  ),
  Varient: (c) => (
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 12 L18 12 M14 8 L18 12 L14 16" />
      <Path d="M6 12 Q8 6 12 6" strokeDasharray="2 2" />
    </G>
  ),
  Poop: (c) => ( // Fun easter egg for the "Poop" category
    <G stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
       <Path d="M8 18 C ৪ 22 16 22 16 18 C 16 14 12 14 12 10 C 12 6 8 6 8 10 C 8 14 8 14 8 18 Z" />
       <Path d="M6 18 L18 18" />
    </G>
  )
};

export function CustomIcon({ name, size = 24, color = '#000' }: CustomIconProps) {
  // Try to find the icon, or fall back to an elegant "sparkle/star"
  const renderIcon = ICON_MAP[name] || ((c) => (
      <Path
        d="M12 2 L14 9 L21 11 L14 13 L12 20 L10 13 L3 11 L10 9 Z"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
  ));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon(color)}
    </Svg>
  );
}
