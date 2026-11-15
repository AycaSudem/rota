import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import type { Place } from './store';

/** İki konum arası mesafe (metre). */
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Çalışma yerini (şu anki konum) alır. İzin yoksa null döner. */
export async function capturePlace(): Promise<Place | null> {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: Math.round(pos.coords.accuracy ?? 30) };
  } catch {
    return null;
  }
}

/**
 * Çalışma yeri bekçisi: GPS'in kendi hata payını hesaba katarak, çalışma yerinden
 * gerçekten uzaklaştıysan (bina/kafe dışına çıkış) onLeave çağırır.
 * Ev içindeki 2 metrelik hareketler adım sayarla yakalanır; GPS bunun için yeterince hassas değil.
 */
export function usePlaceGuard(opts: { enabled: boolean; place: Place | null; blocked: () => boolean; onLeave: (meters: number) => void }) {
  const o = useRef(opts);
  o.current = opts;
  const { enabled, place } = opts;
  const key = place ? `${place.lat.toFixed(5)},${place.lon.toFixed(5)}` : '';
  useEffect(() => {
    if (!enabled || !place) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    let strikes = 0;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 15000 }, (pos) => {
      const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const acc = pos.coords.accuracy ?? 30;
      const d = distance(place, cur);
      // Eşik: en az 40 m, ya da iki ölçümün hata payının toplamı kadar
      const limit = Math.max(40, (place.acc + acc) * 1.2);
      if (d > limit && acc < 60) strikes++;
      else strikes = 0;
      if (strikes >= 2 && !o.current.blocked()) {
        strikes = 0;
        o.current.onLeave(Math.round(d));
      }
    })
      .then((s) => {
        if (alive) sub = s;
        else s.remove();
      })
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}
