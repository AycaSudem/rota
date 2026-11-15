import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { C } from './theme';

/* ---------- Bitkiler ---------- */
// Tür: çiçek rengi + göbek rengi + ad
export const SPECIES: { name: string; petal: string; center: string }[] = [
  { name: 'Papatya', petal: '#F4F1E8', center: '#F0C23B' },
  { name: 'Lale', petal: '#F07A8C', center: '#F07A8C' },
  { name: 'Çan çiçeği', petal: '#8FA8F5', center: '#DCE4FF' },
  { name: 'Ayçiçeği', petal: '#F5C443', center: '#7A4E26' },
  { name: 'Lavanta', petal: '#B79CF0', center: '#B79CF0' },
  { name: 'Gelincik', petal: '#F0664E', center: '#2B2230' },
];
export const STAGE_NAMES = ['Tohum', 'Filiz', 'Fide', 'Tomurcuk', 'Çiçek'];

/** Odak dakikasına göre büyüme evresi (0-4). */
export function stageFor(min: number) {
  if (min >= 45) return 4;
  if (min >= 25) return 3;
  if (min >= 12) return 2;
  if (min >= 4) return 1;
  return 0;
}
/** Bir sonraki evreye kaç dakika kaldı. */
export function nextStageIn(min: number) {
  const t = [4, 12, 25, 45].find((x) => x > min);
  return t == null ? 0 : Math.ceil(t - min);
}

const LEAF = '#4CC08A';
const LEAF2 = '#3A9E6B';
const STEM = '#3FA672';

export function Plant({ stage, species = 0, size = 120 }: { stage: number; species?: number; size?: number }) {
  const sp = SPECIES[species % SPECIES.length];
  // 100x120 çizim alanı; saksı altta
  const stemTop = [96, 78, 62, 44, 34][stage];
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 100 120">
      {/* gölge */}
      <Ellipse cx={50} cy={116} rx={26} ry={3} fill="#000" opacity={0.25} />
      {/* saksı, toprak ve tohum */}
      <Path d="M27 98 L73 98 L67 116 L33 116 Z" fill="#B0673F" />
      <Rect x={25} y={95} width={50} height={6} rx={2} fill="#C47A4E" />
      <Ellipse cx={50} cy={95.5} rx={21} ry={3.2} fill="#4A3426" />
      {stage === 0 && <Ellipse cx={50} cy={93.5} rx={3.5} ry={2.5} fill="#C9A06A" />}
      {/* gövde ve yapraklar */}
      {stage >= 1 && <Path d={`M50 95 C50 ${(95 + stemTop) / 2} 49 ${stemTop + 8} 50 ${stemTop}`} stroke={STEM} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {stage === 1 && (
        <G>
          <Path d="M50 86 C42 82 38 78 40 74 C46 74 50 79 50 86 Z" fill={LEAF} />
          <Path d="M50 84 C58 80 62 76 60 72 C54 72 50 77 50 84 Z" fill={LEAF2} />
        </G>
      )}
      {stage >= 2 && (
        <G>
          <Path d="M50 88 C38 86 32 80 34 74 C42 73 49 79 50 88 Z" fill={LEAF} />
          <Path d="M50 82 C62 80 68 74 66 68 C58 67 51 73 50 82 Z" fill={LEAF2} />
          <Path d="M50 72 C40 70 36 64 38 59 C45 59 50 64 50 72 Z" fill={LEAF2} />
          {stage >= 3 && <Path d="M50 62 C60 60 64 55 62 50 C56 50 51 55 50 62 Z" fill={LEAF} />}
        </G>
      )}
      {/* tomurcuk */}
      {stage === 3 && <Ellipse cx={50} cy={stemTop - 3} rx={5} ry={7} fill={sp.petal} stroke={LEAF2} strokeWidth={2} />}
      {/* çiçek */}
      {stage >= 4 && (
        <G>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI * 2) / 8;
            return <Ellipse key={i} cx={50 + Math.cos(a) * 9} cy={stemTop + Math.sin(a) * 9} rx={6.5} ry={4.2} rotation={(a * 180) / Math.PI} origin={`${50 + Math.cos(a) * 9}, ${stemTop + Math.sin(a) * 9}`} fill={sp.petal} />;
          })}
          <Circle cx={50} cy={stemTop} r={5.5} fill={sp.center} />
        </G>
      )}
    </Svg>
  );
}

export function Butterfly({ size = 22, color = '#F5C443' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={8} cy={9} rx={6} ry={5} fill={color} opacity={0.9} />
      <Ellipse cx={16} cy={9} rx={6} ry={5} fill={color} opacity={0.9} />
      <Ellipse cx={9} cy={16} rx={4} ry={3.5} fill={color} opacity={0.75} />
      <Ellipse cx={15} cy={16} rx={4} ry={3.5} fill={color} opacity={0.75} />
      <Rect x={11.2} y={6} width={1.6} height={13} rx={0.8} fill="#2B2230" />
    </Svg>
  );
}

/** Evre değişince bitki yumuşakça "zıplar". */
export function GrowingPlant({ stage, species, size }: { stage: number; species: number; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(stage);
  useEffect(() => {
    if (stage === prev.current) return;
    prev.current = stage;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce) return;
        scale.setValue(0.85);
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
      })
      .catch(() => {});
  }, [stage, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Plant stage={stage} species={species} size={size} />
    </Animated.View>
  );
}

/* ---------- Nazik konfeti ---------- */
const COLORS = [C.accent, C.ok, '#F07A8C', '#8FA8F5', '#F4F1E8', '#B79CF0'];
type Piece = { x: number; drift: number; delay: number; color: string; w: number; h: number; spin: number };

const ConfettiCtx = createContext<() => void>(() => {});
export const useConfetti = () => useContext(ConfettiCtx);

export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const [burst, setBurst] = useState<{ id: number; pieces: Piece[] } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const reduce = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => (reduce.current = r))
      .catch(() => {});
  }, []);

  const fire = useCallback(() => {
    if (reduce.current) return;
    const { width } = Dimensions.get('window');
    const pieces: Piece[] = Array.from({ length: 26 }, () => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 80,
      delay: Math.random() * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 6 + Math.random() * 5,
      h: 8 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 720,
    }));
    progress.setValue(0);
    setBurst({ id: Date.now(), pieces });
    Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setBurst(null));
  }, [progress]);

  const H = Dimensions.get('window').height;
  return (
    <ConfettiCtx.Provider value={fire}>
      {children}
      {burst && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {burst.pieces.map((p, i) => {
            const t = progress.interpolate({ inputRange: [0, p.delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
            return (
              <Animated.View
                key={burst.id + '-' + i}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: -20,
                  width: p.w,
                  height: p.h,
                  borderRadius: 2,
                  backgroundColor: p.color,
                  opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.55] }) },
                    { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                    { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin + 'deg'] }) },
                  ],
                }}
              />
            );
          })}
        </View>
      )}
    </ConfettiCtx.Provider>
  );
}
