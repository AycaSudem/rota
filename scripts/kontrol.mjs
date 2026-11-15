// Rota kurulum kontrolü: `npm run kontrol`
// Supabase bağlantısını, anonim girişi ve tabloları sırayla dener; sorun varsa nasıl düzeltileceğini söyler.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log('  ✅ ' + m);
const bad = (m, fix) => {
  console.log('  ❌ ' + m);
  if (fix) console.log('     👉 ' + fix);
  process.exitCode = 1;
};

console.log('\n🌱 Rota kurulum kontrolü\n');

const cfg = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
const pick = (name, env) => process.env[env] || (cfg.match(new RegExp(name + "\\s*=\\s*[^']*'([^']+)'")) || [])[1] || '';
const url = pick('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const key = pick('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_KEY');

console.log('1) src/config.ts');
if (!url || url.includes('YOUR-')) {
  bad('Project URL yazılmamış.', 'Supabase → Project Settings → API Keys sayfasındaki "Project URL"i src/config.ts dosyasına yapıştır.');
  process.exit(1);
}
if (!key || key.includes('YOUR-')) {
  bad('Anahtar yazılmamış.', 'Aynı sayfadaki "Publishable key"i (sb_publishable_...) src/config.ts dosyasına yapıştır.');
  process.exit(1);
}
if (key.startsWith('sb_secret') || key.includes('service_role')) {
  bad('Yanlış anahtar: bu GİZLİ (secret) anahtar!', 'Bunu hemen sil ve yerine "Publishable key"i yaz. Secret anahtarı asla uygulamaya koyma.');
  process.exit(1);
}
ok('URL ve anahtar yazılmış: ' + url);

const sb = createClient(url, key, { auth: { persistSession: false } });

console.log('\n2) Anonim giriş');
const auth = await sb.auth.signInAnonymously();
if (auth.error) {
  const m = auth.error.message.toLowerCase();
  if (m.includes('anonymous')) bad('Anonim giriş kapalı.', 'Authentication → Sign In / Providers → "Allow anonymous sign-ins" seçeneğini aç ve kaydet.');
  else if (m.includes('api key') || m.includes('jwt')) bad('Anahtar hatalı: ' + auth.error.message, 'src/config.ts içindeki anahtarı tekrar kopyala.');
  else if (m.includes('fetch') || m.includes('network') || m.includes('enotfound'))
    bad('Supabase\'e ulaşılamadı.', 'İnternet bağlantını ve src/config.ts içindeki Project URL\'yi kontrol et (https://xxxx.supabase.co biçiminde olmalı).');
  else bad('Giriş başarısız: ' + auth.error.message);
  process.exit(1);
}
ok('Anonim giriş çalışıyor.');

console.log('\n3) Veritabanı tabloları');
for (const t of ['rooms', 'focus_logs', 'room_members']) {
  const { error } = await sb.from(t).select('*').limit(1);
  if (error) bad(`"${t}" tablosuna ulaşılamadı: ${error.message}`, 'SQL Editor → New query → supabase/schema.sql dosyasının tamamını yapıştır → Run.');
  else ok(`"${t}" tablosu hazır.`);
}

await sb.auth.signOut().catch(() => {});
console.log(process.exitCode ? '\n⚠️  Yukarıdaki sorunları düzeltip tekrar çalıştır: npm run kontrol\n' : '\n🎉 Her şey hazır! Şimdi: npm run baslat  (ya da Android uygulaması için: npm run apk)\n');
