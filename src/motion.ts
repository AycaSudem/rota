import { Accelerometer, Pedometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Rota ekranına son dokunuş: kullanıcı Rota'yı kullanıyorsa telefonu elinde tutması normaldir. */
export const touch = { last: 0 };
export const markTouch = () => {
  touch.last = Date.now();
};

export type MoveKind = 'steps' | 'pickup';

let permAsked = false;
export async function ensureMotionPermission(): Promise<boolean> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    const p = await Pedometer.getPermissionsAsync();
    if (p.granted) return true;
    if (permAsked && !p.canAskAgain) return false;
    permAsked = true;
    const r = await Pedometer.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

/** Yalnızca iOS: uygulama arka plandayken atılan adımlar. */
export async function stepsBetween(from: number, to: number): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const r = await Pedometer.getStepCountAsync(new Date(from), new Date(to));
    return r.steps;
  } catch {
    return null;
  }
}

/**
 * Hareket bekçisi.
 * - Adım: odaktayken `stepThreshold` adım atılırsa (≈ 4 adım ≈ 2 m) onMove('steps').
 * - Telefon kalktı: telefon bir yerde sabit dururken açısı 35°'den fazla değişip
 *   4 saniye öyle kalırsa onMove('pickup'). Rota'ya son 10 sn içinde dokunulduysa sayılmaz.
 * `blocked()` true iken (ekranda bir soru açıkken) sayaçlar sıfırlanır.
 */
export function useMotionGuard(opts: {
  enabled: boolean;
  steps: boolean;
  pickup: boolean;
  stepThreshold: number;
  blocked: () => boolean;
  onMove: (kind: MoveKind, steps: number) => void;
}) {
  const o = useRef(opts);
  o.current = opts;
  const { enabled, steps, pickup } = opts;

  /* Adım sayarı */
  useEffect(() => {
    if (!enabled || !steps) return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    let base: number | null = null;
    ensureMotionPermission().then((ok) => {
      if (!ok || !alive) return;
      try {
        sub = Pedometer.watchStepCount((r) => {
        if (base === null || o.current.blocked()) {
          base = r.steps;
          return;
        }
        const d = r.steps - base;
        if (d >= o.current.stepThreshold) {
          base = r.steps;
          o.current.onMove('steps', d);
        }
        });
      } catch {
        // adım sayar bu cihazda yok
      }
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [enabled, steps]);

  /* Telefon kalktı mı? (ivmeölçer) */
  useEffect(() => {
    if (!enabled || !pickup) return;
    let base: [number, number, number] | null = null;
    let prev: [number, number, number] | null = null;
    let stableSince = 0;
    let deviateSince = 0;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    const listen = ({ x, y, z }: { x: number; y: number; z: number }) => {
      const now = Date.now();
      const m = Math.hypot(x, y, z) || 1;
      const v: [number, number, number] = [x / m, y / m, z / m];
      const reset = () => {
        base = null;
        deviateSince = 0;
        stableSince = 0;
      };
      if (now - touch.last < 10000 || o.current.blocked()) {
        reset();
        prev = v;
        return;
      }
      if (!base) {
        // 3 saniye sabit kalırsa "bırakıldı" kabul et
        const still = prev && Math.hypot(v[0] - prev[0], v[1] - prev[1], v[2] - prev[2]) < 0.04 && Math.abs(m - 1) < 0.15;
        if (still) {
          if (!stableSince) stableSince = now;
          if (now - stableSince > 3000) base = v;
        } else stableSince = 0;
        prev = v;
        return;
      }
      const dot = Math.max(-1, Math.min(1, v[0] * base[0] + v[1] * base[1] + v[2] * base[2]));
      const angle = (Math.acos(dot) * 180) / Math.PI;
      if (angle > 35) {
        if (!deviateSince) deviateSince = now;
        if (now - deviateSince > 4000) {
          reset();
          o.current.onMove('pickup', 0);
        }
      } else deviateSince = 0;
      prev = v;
    };
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || !alive) return;
        try {
          Accelerometer.setUpdateInterval(250);
          sub = Accelerometer.addListener(listen);
        } catch {
          // ivmeölçer bu cihazda yok
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [enabled, pickup]);
}
