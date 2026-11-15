import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, R } from './theme';

/* ---------- Temel parçalar ---------- */
export function T({ style, muted, small, bold, ...p }: TextProps & { muted?: boolean; small?: boolean; bold?: boolean }) {
  return (
    <Text
      {...p}
      style={[
        { color: muted ? C.muted : C.ink, fontSize: small ? 14 : 16.5, lineHeight: small ? 20 : 23, fontFamily: bold ? FONT[700] : FONT[400] },
        style,
      ]}
    />
  );
}
export function H({ style, size = 22, ...p }: TextProps & { size?: number }) {
  return <Text {...p} style={[{ color: C.ink, fontSize: size, fontFamily: FONT[800], letterSpacing: -0.2 }, style]} />;
}
export function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={{ color: color ?? C.muted, fontSize: 12, fontFamily: FONT[800], letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</Text>;
}
export function Card({ style, tint, ...p }: ViewProps & { tint?: { bg: string; border: string } }) {
  return <View {...p} style={[s.card, tint && { backgroundColor: tint.bg, borderColor: tint.border }, style]} />;
}
export const TINT = {
  violet: { bg: C.accentSoft, border: '#D6CCFF' },
  mint: { bg: C.mintSoft, border: '#B9EBD5' },
  sun: { bg: C.sunSoft, border: '#FFDF94' },
  coral: { bg: C.coralSoft, border: '#FFC6BD' },
  sky: { bg: C.skySoft, border: '#BFE0FD' },
};

type BtnKind = 'default' | 'primary' | 'ok' | 'danger' | 'ghost' | 'sun' | 'soft';
export function Btn({
  label,
  onPress,
  kind = 'default',
  big,
  small,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  kind?: BtnKind;
  big?: boolean;
  small?: boolean;
  disabled?: boolean;
  style?: any;
}) {
  const bg = { default: C.surface, primary: C.accent, ok: C.mint, danger: 'transparent', ghost: 'transparent', sun: C.sun, soft: C.accentSoft }[kind];
  const fg = { default: C.ink, primary: C.onAccent, ok: '#fff', danger: C.danger, ghost: C.accentDeep, sun: '#3A2600', soft: C.accentDeep }[kind];
  const bd = { default: C.line, primary: C.accent, ok: C.mint, danger: '#F5B8BA', ghost: 'transparent', sun: C.sun, soft: '#D6CCFF' }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: bd, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        (kind === 'primary' || kind === 'ok') && s.lift,
        big && { minHeight: 60, paddingVertical: 16, borderRadius: 20 },
        small && { minHeight: 38, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontFamily: FONT[700], fontSize: big ? 19 : small ? 14.5 : 16.5, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}
export function Input(p: TextInputProps) {
  return <TextInput placeholderTextColor="#9C96BC" {...p} style={[s.input, p.multiline && { minHeight: 70, textAlignVertical: 'top' }, p.style]} />;
}
export function Seg<V extends string | number>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <View style={s.seg}>
      {options.map(([v, l]) => (
        <Pressable
          key={String(v)}
          onPress={() => onChange(v)}
          style={[s.segBtn, v === value && { backgroundColor: C.accent }]}
          accessibilityRole="button"
          accessibilityState={{ selected: v === value }}
        >
          <Text style={{ color: v === value ? C.onAccent : C.ink, fontFamily: FONT[700], fontSize: 14.5, textAlign: 'center' }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Pill({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <View style={{ backgroundColor: bg ?? 'transparent', borderWidth: bg ? 0 : 1, borderColor: color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 12.5, fontFamily: FONT[700] }}>{label}</Text>
    </View>
  );
}
export function Lantern({ size = 30, light }: { size?: number; light?: boolean }) {
  // Bekçi'nin feneri (ek bağımlılık olmadan, View'larla)
  const u = size / 34;
  const frame = light ? '#FFFFFF' : C.ink;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: 10 * u, height: 4 * u, borderRadius: 2 * u, backgroundColor: C.sun, marginTop: 2 * u }} />
      <View style={{ width: 16 * u, height: 18 * u, borderWidth: 2 * u, borderColor: frame, borderRadius: 4 * u, marginTop: 2 * u, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8 * u, height: 8 * u, borderRadius: 4 * u, backgroundColor: C.sun }} />
      </View>
      <View style={{ width: 16 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: frame, marginTop: 1 * u }} />
    </View>
  );
}

/* ---------- Sekme gezintisi ---------- */
export type Tab = 'calis' | 'oda' | 'park' | 'ben';
const NavCtx = createContext<{ tab: Tab; setTab: (t: Tab) => void }>({ tab: 'calis', setTab: () => {} });
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('calis');
  return <NavCtx.Provider value={{ tab, setTab }}>{children}</NavCtx.Provider>;
}
export const useNav = () => useContext(NavCtx);

/* ---------- Bildirim balonu (toast) ---------- */
type ToastItem = { id: number; text: string; action?: { label: string; onPress: () => void } };
const ToastCtx = createContext<(text: string, action?: ToastItem['action'], ms?: number) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const show = useCallback((text: string, action?: ToastItem['action'], ms = 6000) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, action }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: insets.top + 8, paddingHorizontal: 12, gap: 8 }]}>
        {items.map((i) => (
          <View key={i.id} style={s.toast}>
            <Text style={{ color: '#fff', flex: 1, fontSize: 15, fontFamily: FONT[500] }}>{i.text}</Text>
            {i.action && (
              <Pressable
                onPress={() => {
                  setItems((x) => x.filter((y) => y.id !== i.id));
                  i.action!.onPress();
                }}
                style={{ backgroundColor: C.sun, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }}
              >
                <Text style={{ color: '#3A2600', fontFamily: FONT[700] }}>{i.action.label}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Alt sayfa (sheet) ---------- */
export type SheetBtn = { label: string; kind?: BtnKind; onPress?: () => void; keep?: boolean };
export type SheetSpec = { title?: string; body?: React.ReactNode; buttons?: SheetBtn[]; dismissable?: boolean };
const SheetCtx = createContext<{ show: (s: SheetSpec) => void; close: () => void; isOpen: () => boolean }>({
  show: () => {},
  close: () => {},
  isOpen: () => false,
});
export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const open = useRef(false);
  const insets = useSafeAreaInsets();
  const close = useCallback(() => {
    open.current = false;
    setSpec(null);
  }, []);
  const show = useCallback((sp: SheetSpec) => {
    open.current = true;
    setSpec(sp);
  }, []);
  const isOpen = useCallback(() => open.current, []);
  return (
    <SheetCtx.Provider value={{ show, close, isOpen }}>
      {children}
      <Modal
        visible={!!spec}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (spec?.dismissable !== false) close();
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable
            style={s.sheetBg}
            onPress={() => {
              if (spec?.dismissable !== false) close();
            }}
          >
            <Pressable style={[s.sheet, { paddingBottom: 18 + insets.bottom }]} onPress={() => {}}>
              <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 10 }} />
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
                {spec?.title ? <H>{spec.title}</H> : null}
                {spec?.body}
                {(spec?.buttons ?? []).map((b, i) => (
                  <Btn
                    key={i}
                    label={b.label}
                    kind={b.kind}
                    onPress={() => {
                      if (!b.keep) close();
                      b.onPress?.();
                    }}
                  />
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SheetCtx.Provider>
  );
}
export const useSheet = () => useContext(SheetCtx);

export const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: R, padding: 18, gap: 12 },
  lift: { shadowColor: '#5B43E0', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btn: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: C.surface2, borderColor: C.line, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.ink, fontSize: 16.5, fontFamily: FONT[400] },
  seg: { flexDirection: 'row', backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, overflow: 'hidden', padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  toast: { backgroundColor: C.ink, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetBg: { flex: 1, backgroundColor: 'rgba(42,35,70,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10, maxHeight: '88%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderColor: C.line, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
});
