// ───────────────────────────────────────────────────────────────
//  SUPABASE BAĞLANTISI: sadece bu iki satırı doldur.
//  Supabase panelinde: Project Settings → API Keys
//   • SUPABASE_URL  : "Project URL" (https://xxxx.supabase.co)
//   • SUPABASE_KEY  : "Publishable key" (sb_publishable_ ile başlar)
//  Bu anahtar uygulamanın içinde durması için tasarlanmıştır, gizli değildir.
//  ASLA "secret" (sb_secret_) ya da "service_role" anahtarını buraya yazma.
// ───────────────────────────────────────────────────────────────
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ofujuqxkwulfhjxifrqh.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_lE4mP7ICJOYHWFk7j6yWRg_SqWCjed2';
