import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type Native = { lastScreenOffAt(): number; isScreenOn(): boolean };
const M = requireOptionalNativeModule<Native>('ScreenState');

/** Kalıcı kurulumda true; Expo Go'da yerel modül olmadığı için false. */
export const precise = !!M;

/** Uygulamadan çıkış: ekran mı kapandı, başka uygulamaya mı geçildi? */
export type Leave = 'screen' | 'app' | 'unknown';

export function classifyLeave(hiddenAt: number, now = Date.now()): Leave {
  if (!M) return 'unknown';
  try {
    const off = M.lastScreenOffAt();
    // Ekran kapanma anı, çıkıştan hemen önce/sonra ise ekran kapatılmıştır.
    // iOS'ta kilit bildirimi biraz gecikebildiği için pencere daha geniş.
    const windowMs = Platform.OS === 'ios' ? 15000 : 3000;
    if (off && off >= hiddenAt - 3000 && off <= Math.min(now, hiddenAt + windowMs)) return 'screen';
    if (Platform.OS === 'android' && !M.isScreenOn()) return 'screen';
    return 'app';
  } catch {
    return 'unknown';
  }
}
