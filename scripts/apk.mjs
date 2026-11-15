// `npm run apk`: Rota'nın Android uygulamasını Expo'nun bulut sunucusunda derler.
// EAS_NO_VCS=1 → projenin git deposu olmasına gerek kalmaz.
// EAS_PROJECT_ROOT → Expo'ya proje klasörünü açıkça söyler. Yoksa üst klasörlerden birinde
// (ör. kullanıcı klasörü) bir git deposu varsa onun tamamını paketlemeye çalışır.
import { spawn } from 'node:child_process';

console.log('\n🌱 Rota Android uygulaması derleniyor (bulutta, 10-20 dk sürer)...\n');
const p = spawn('npx', ['--yes', 'eas-cli@latest', 'build', '-p', 'android', '--profile', 'preview'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: process.cwd() },
});
p.on('exit', (code) => {
  if (code === 0) console.log('\n🎉 Bitti! Yukarıdaki bağlantıyı (ya da QR kodu) arkadaşlarına gönder.\n');
  else console.log('\n⚠️  Derleme tamamlanamadı. Yukarıdaki hata mesajının ekran görüntüsünü gönder.\n');
  process.exit(code ?? 1);
});
