import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const configured = !SUPABASE_URL.includes('YOUR-') && !SUPABASE_ANON_KEY.includes('YOUR-') && !SUPABASE_ANON_KEY.startsWith('sb_secret');

export const supabase = createClient(
  configured ? SUPABASE_URL : 'https://example.supabase.co',
  configured ? SUPABASE_ANON_KEY : 'public-anon-key',
  {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  },
);

if (configured) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Hesap gerekmez: Supabase'in anonim girişiyle cihaza kalıcı bir kimlik verilir. */
export async function ensureUser(): Promise<string | null> {
  if (!configured) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const r = await supabase.auth.signInAnonymously();
  if (r.error) throw new Error(explain(r.error.message));
  return r.data.user?.id ?? null;
}

/** Supabase hatalarını kullanıcının anlayacağı dile çevirir. */
export function explain(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('anonymous sign-ins are disabled'))
    return 'Supabase\'de anonim giriş kapalı. Panelde Authentication → Sign In / Providers → "Allow anonymous sign-ins" seçeneğini aç.';
  if (m.includes('invalid api key') || m.includes('no api key') || m.includes('jwt'))
    return 'Supabase anahtarı hatalı. src/config.ts içindeki Publishable key\'i kontrol et.';
  if (m.includes('could not find the table') || m.includes('does not exist') || m.includes('pgrst205') || m.includes('42p01'))
    return 'Veritabanı tabloları yok. Supabase SQL Editor\'da supabase/schema.sql dosyasını çalıştır.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Çok fazla deneme yapıldı (Supabase saatlik sınırı). Biraz bekleyip tekrar dene.';
  if (m.includes('network') || m.includes('fetch'))
    return 'İnternete bağlanılamadı. Bağlantını kontrol et.';
  return msg;
}
